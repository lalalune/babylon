import { CHAIN } from '@/constants/chains';
import db from '@/lib/database-service';
import { logger } from '@/lib/logger';
import { getReadyPerpsEngine } from '@/lib/perps-service';
import { prisma } from '@/lib/prisma';
import { broadcastToChannel } from '@/lib/sse/event-broadcaster';
import { PRICE_STORAGE_FACET_ABI } from '@/lib/web3/abis';
import type { JsonValue } from '@/types/common';
import { createPublicClient, createWalletClient, encodePacked, http, keccak256 } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export type PriceUpdateSource = 'user_trade' | 'npc_trade' | 'event' | 'system';

export interface PriceUpdateInput {
  organizationId: string;
  newPrice: number;
  source: PriceUpdateSource;
  reason?: string;
  metadata?: Record<string, JsonValue>;
}

export interface AppliedPriceUpdate {
  organizationId: string;
  oldPrice: number;
  newPrice: number;
  change: number;
  changePercent: number;
  source: PriceUpdateSource;
  reason?: string;
  metadata?: Record<string, JsonValue>;
  timestamp: string;
}

/**
 * Derive perpetual market ID from organization ID
 * Market IDs are keccak256(symbol + timestamp + blockNumber) in contract,
 * but for price storage we use a deterministic hash based on symbol
 */
function deriveMarketId(organizationId: string): `0x${string}` {
  // Convert organization ID to ticker symbol (e.g., "ORG-123" -> "ORG123PERP")
  const ticker = organizationId.toUpperCase().replace(/-/g, '') + 'PERP';
  // Use deterministic hash (without timestamp/block for consistency)
  // In production, you may want to store actual market IDs when markets are created
  return keccak256(encodePacked(['string'], [ticker]));
}

/**
 * Convert price to Chainlink format (8 decimals)
 */
function toChainlinkFormat(price: number): bigint {
  return BigInt(Math.round(price * 1e8));
}

export class PriceUpdateService {
  /**
   * Apply a batch of price updates, ensuring persistence + engine sync + SSE broadcast + on-chain storage
   */
  static async applyUpdates(
    updates: PriceUpdateInput[]
  ): Promise<AppliedPriceUpdate[]> {
    if (updates.length === 0) return [];

    const perpsEngine = await getReadyPerpsEngine();

    const appliedUpdates: AppliedPriceUpdate[] = [];
    const priceMap = new Map<string, number>();

    for (const update of updates) {
      if (!Number.isFinite(update.newPrice) || update.newPrice <= 0) {
        logger.warn(
          'Skipping invalid price update',
          { update },
          'PriceUpdateService'
        );
        continue;
      }

      const organization = await prisma.organization.findUnique({
        where: { id: update.organizationId },
        select: { id: true, currentPrice: true },
      });

      if (!organization) {
        logger.warn(
          'Organization not found for price update',
          { organizationId: update.organizationId },
          'PriceUpdateService'
        );
        continue;
      }

      const oldPrice = Number(organization.currentPrice ?? update.newPrice);
      const change = update.newPrice - oldPrice;
      const changePercent = oldPrice === 0 ? 0 : (change / oldPrice) * 100;

      await prisma.organization.update({
        where: { id: organization.id },
        data: { currentPrice: update.newPrice },
      });

      await db().recordPriceUpdate(
        organization.id,
        update.newPrice,
        change,
        changePercent
      );

      priceMap.set(organization.id, update.newPrice);
      appliedUpdates.push({
        organizationId: organization.id,
        oldPrice,
        newPrice: update.newPrice,
        change,
        changePercent,
        source: update.source,
        reason: update.reason,
        metadata: update.metadata,
        timestamp: new Date().toISOString(),
      });
    }

    if (priceMap.size > 0) {
      perpsEngine.updatePositions(priceMap);

      // Write prices to blockchain
      await this.writePricesToChain(appliedUpdates);

      broadcastToChannel('markets', {
        type: 'price_update',
        updates: appliedUpdates as unknown as JsonValue,
      });

      logger.info(
        `Applied ${appliedUpdates.length} organization price updates`,
        { count: appliedUpdates.length },
        'PriceUpdateService'
      );
    }

    return appliedUpdates;
  }

  /**
   * Write prices to blockchain using PriceStorageFacet
   */
  private static async writePricesToChain(
    updates: AppliedPriceUpdate[]
  ): Promise<void> {
    const { getContractAddresses, getRpcUrl } = await import('@/lib/deployment/addresses');
    const { diamond: diamondAddress } = getContractAddresses();
    const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
    const rpcUrl = getRpcUrl();

    if (!diamondAddress || !deployerPrivateKey || !rpcUrl) {
      logger.debug(
        'Skipping on-chain price update - missing configuration',
        { hasDiamond: !!diamondAddress, hasKey: !!deployerPrivateKey, hasRpc: !!rpcUrl },
        'PriceUpdateService'
      );
      return;
    }
    
    logger.info('Publishing prices to blockchain', {
      network: getContractAddresses().network,
      diamond: diamondAddress,
      rpcUrl,
      count: updates.length
    }, 'PriceUpdateService');

    const publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(rpcUrl),
    });

    const account = privateKeyToAccount(deployerPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: CHAIN,
      transport: http(rpcUrl),
    });

    // Get current tick counter with fallback
    let currentTick: bigint;
    try {
      currentTick = await publicClient.readContract({
        address: diamondAddress,
        abi: PRICE_STORAGE_FACET_ABI,
        functionName: 'getGlobalTickCounter',
      }) as bigint;
    } catch (error) {
      logger.warn(
        'Failed to get tick counter, using timestamp-based tick',
        { error },
        'PriceUpdateService'
      );
      // Fallback: use timestamp-based tick
      currentTick = BigInt(Math.floor(Date.now() / 1000));
    }

    // Prepare market IDs and prices
    const marketIds: `0x${string}`[] = [];
    const prices: bigint[] = [];

    for (const update of updates) {
      const marketId = deriveMarketId(update.organizationId);
      const price = toChainlinkFormat(update.newPrice);
      marketIds.push(marketId);
      prices.push(price);
    }

    // Batch update prices
    const txHash = await walletClient.writeContract({
      address: diamondAddress,
      abi: PRICE_STORAGE_FACET_ABI,
      functionName: 'updatePrices',
      args: [marketIds, currentTick, prices],
    });

    // Wait for confirmation
    await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });

    logger.info(
      `Successfully wrote ${updates.length} prices to chain`,
      { txHash, tick: currentTick.toString(), count: updates.length },
      'PriceUpdateService'
    );
  }
}
