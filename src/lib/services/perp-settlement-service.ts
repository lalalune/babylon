/**
 * Perpetuals Settlement Service
 *
 * Bridges off-chain trading engine (PR #128) with on-chain contracts (PR #129)
 *
 * Modes:
 * - offchain: No blockchain settlement (fast MVP)
 * - onchain: Every trade settles to blockchain (decentralized)
 * - hybrid: Periodic batch settlement (best of both)
 */

import { logger } from '@/lib/logger';
import { prisma, prismaBase } from '@/lib/prisma';
import { PERP_CONFIG, isOnChainEnabled, isHybridMode } from '@/lib/config/perp-modes';
import type { Prisma } from '@prisma/client';
import { createPublicClient, createWalletClient, http, type Address, type Hash } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

import type { PerpPosition } from '@/shared/perps-types';

// Perpetual Market Facet ABI (minimal)
const PERP_FACET_ABI = [
  {
    name: 'openPosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_marketId', type: 'bytes32' },
      { name: '_side', type: 'uint8' },
      { name: '_size', type: 'uint256' },
      { name: '_collateral', type: 'uint256' },
      { name: '_maxPrice', type: 'uint256' }
    ],
    outputs: []
  },
  {
    name: 'closePosition',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_marketId', type: 'bytes32' }
    ],
    outputs: []
  }
] as const;

export interface SettlementResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
  gasUsed?: bigint;
}

export class PerpSettlementService {
  private static batchTimer: NodeJS.Timeout | null = null;
  private static unsettledPositions: Set<string> = new Set();

  /**
   * Initialize settlement service (for hybrid mode)
   */
  static initialize(): void {
    if (!isHybridMode()) {
      return;
    }

    // Start periodic batch settlement
    this.batchTimer = setInterval(
      () => this.executeBatchSettlement(),
      PERP_CONFIG.hybridBatchInterval
    );

    logger.info('Hybrid settlement service initialized', {
      batchInterval: PERP_CONFIG.hybridBatchInterval,
      batchSize: PERP_CONFIG.hybridBatchSize,
    }, 'PerpSettlementService');
  }

  /**
   * Shutdown settlement service
   */
  static shutdown(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Settle position opening to blockchain
   */
  static async settleOpenPosition(
    position: PerpPosition
  ): Promise<SettlementResult> {
    if (!isOnChainEnabled()) {
      return { success: true }; // Skip settlement in offchain mode
    }

    // In hybrid mode, queue for batch settlement
    if (isHybridMode()) {
      this.unsettledPositions.add(position.id);
      await this.markPositionUnsettled(position.id);
      return { success: true }; // Queued successfully
    }

    // In onchain mode, settle immediately
    return await this.settleToContract('open', position);
  }

  /**
   * Settle position closing to blockchain
   */
  static async settleClosePosition(
    position: PerpPosition
  ): Promise<SettlementResult> {
    if (!isOnChainEnabled()) {
      return { success: true }; // Skip settlement in offchain mode
    }

    // In hybrid mode, queue for batch settlement
    if (isHybridMode()) {
      this.unsettledPositions.add(position.id);
      await this.markPositionUnsettled(position.id);
      return { success: true }; // Queued successfully
    }

    // In onchain mode, settle immediately
    return await this.settleToContract('close', position);
  }

  /**
   * Execute batch settlement (hybrid mode)
   */
  private static async executeBatchSettlement(): Promise<void> {
    if (!isHybridMode()) {
      return;
    }

    // Get unsettled positions from database
    const positions = await this.getUnsettledPositionsFromDb(
      PERP_CONFIG.hybridBatchSize
    );

    if (positions.length === 0) {
      logger.debug('No unsettled positions to settle', undefined, 'PerpSettlementService');
      return;
    }

    logger.info('Starting batch settlement', {
      count: positions.length,
    }, 'PerpSettlementService');

    // Settle each position
    const results = await Promise.allSettled(
      positions.map((pos) =>
        this.settleToContract(
          pos.closedAt ? 'close' : 'open',
          pos as unknown as PerpPosition
        )
      )
    );

    // Track successes and failures
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result, index) => {
      const position = positions[index];
      if (!position) return;

      if (result.status === 'fulfilled' && result.value.success) {
        successCount++;
        this.unsettledPositions.delete(position.id);
        this.markPositionSettled(position.id, result.value.transactionHash);
      } else {
        failureCount++;
        logger.error('Position settlement failed', {
          positionId: position.id,
          error: result.status === 'rejected' ? result.reason : result.value.error,
        }, 'PerpSettlementService');
      }
    });

    logger.info('Batch settlement completed', {
      success: successCount,
      failed: failureCount,
      remainingInMemory: this.unsettledPositions.size,
    }, 'PerpSettlementService');
  }

  /**
   * Settle to on-chain contract
   * 
   * Executes blockchain transaction to settle position on Diamond contract
   */
  private static async settleToContract(
    action: 'open' | 'close',
    position: PerpPosition
  ): Promise<SettlementResult> {
    const diamondAddress = PERP_CONFIG.diamondAddress;
    if (!diamondAddress) {
      throw new Error('Diamond address not configured for on-chain settlement');
    }

    const privateKey = process.env.BABYLON_SETTLEMENT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('BABYLON_SETTLEMENT_PRIVATE_KEY not configured for settlement');
    }

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
    if (!rpcUrl) {
      throw new Error('RPC_URL not configured for blockchain settlement');
    }

    logger.info('Settling position to blockchain', {
      action,
      positionId: position.id,
      ticker: position.ticker,
      size: position.size,
      diamondAddress
    }, 'PerpSettlementService');

    const account = privateKeyToAccount(privateKey as Address);
    
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl)
    });

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl)
    });

    // Generate market ID from ticker (keccak256 hash)
    const marketId = `0x${Buffer.from(position.ticker).toString('hex').padEnd(64, '0')}` as Hash;

    if (action === 'open') {
      // Convert position side to contract enum (0 = LONG, 1 = SHORT)
      const side = position.side.toUpperCase() === 'LONG' ? 0 : 1;
      
      // Convert sizes to wei (18 decimals)
      const sizeWei = BigInt(Math.floor(position.size * 1e18));
      const collateralWei = BigInt(Math.floor((position.size / position.leverage) * 1e18));
      
      // Max price for slippage protection (10% slippage allowed)
      const maxPriceWei = BigInt(Math.floor(position.entryPrice * 1.1 * 1e8));

      const hash = await walletClient.writeContract({
        address: diamondAddress as Address,
        abi: PERP_FACET_ABI,
        functionName: 'openPosition',
        args: [marketId, side, sizeWei, collateralWei, maxPriceWei],
        chain: baseSepolia
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      logger.info('Position opened on-chain', {
        positionId: position.id,
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        status: receipt.status
      }, 'PerpSettlementService');

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed
      };
    } else {
      // Close position
      const hash = await walletClient.writeContract({
        address: diamondAddress as Address,
        abi: PERP_FACET_ABI,
        functionName: 'closePosition',
        args: [marketId],
        chain: baseSepolia
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      logger.info('Position closed on-chain', {
        positionId: position.id,
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed,
        status: receipt.status
      }, 'PerpSettlementService');

      return {
        success: receipt.status === 'success',
        transactionHash: receipt.transactionHash,
        gasUsed: receipt.gasUsed
      };
    }
  }

  /**
   * Mark position as unsettled in database
   */
  private static async markPositionUnsettled(positionId: string): Promise<void> {
    // Type assertion needed due to TypeScript language server cache issues
    // The fields exist in Prisma types but TS can't infer them through the proxy
    await prismaBase.perpPosition.update({
      where: { id: positionId },
      data: {
        settledToChain: false,
        settlementTxHash: null,
        settledAt: null,
      } as Prisma.PerpPositionUncheckedUpdateInput,
    });
  }

  /**
   * Mark position as settled in database
   */
  private static async markPositionSettled(
    positionId: string,
    transactionHash?: string
  ): Promise<void> {
    // Type assertion needed due to TypeScript language server cache issues
    // The fields exist in Prisma types but TS can't infer them through the proxy
    await prismaBase.perpPosition.update({
      where: { id: positionId },
      data: {
        settledToChain: true,
        settlementTxHash: transactionHash || null,
        settledAt: new Date(),
      } as Prisma.PerpPositionUncheckedUpdateInput,
    });

    logger.info('Position marked as settled', {
      positionId,
      transactionHash,
    }, 'PerpSettlementService');
  }

  /**
   * Get unsettled positions from database
   */
  private static async getUnsettledPositionsFromDb(limit: number): Promise<Array<{
    id: string;
    userId: string;
    ticker: string;
    side: string;
    size: number;
    leverage: number;
    entryPrice: number;
    closedAt: Date | null;
  }>> {
    // Type assertion needed due to TypeScript language server cache issues
    // The fields exist in Prisma types but TS can't infer them through the proxy
    return await prismaBase.perpPosition.findMany({
      where: {
        settledToChain: false,
      } as Prisma.PerpPositionWhereInput,
      take: limit,
      orderBy: {
        openedAt: 'asc',
      },
      select: {
        id: true,
        userId: true,
        ticker: true,
        side: true,
        size: true,
        leverage: true,
        entryPrice: true,
        closedAt: true,
      },
    });
  }

  /**
   * Get settlement stats
   */
  static async getSettlementStats(): Promise<{
    mode: string;
    unsettledCount: number;
    totalPositions: number;
    settlementRate: number;
  }> {
    const totalPositions = await prisma.perpPosition.count();
    
    // Type assertion needed due to TypeScript language server cache issues
    // The fields exist in Prisma types but TS can't infer them through the proxy
    const unsettledCount = await prismaBase.perpPosition.count({
      where: { settledToChain: false } as Prisma.PerpPositionWhereInput,
    });

    return {
      mode: PERP_CONFIG.settlementMode,
      unsettledCount,
      totalPositions,
      settlementRate: totalPositions > 0 ? ((totalPositions - unsettledCount) / totalPositions) * 100 : 100,
    };
  }
}

// Initialize service on module load (for hybrid mode)
if (typeof window === 'undefined') {
  // Server-side only
  PerpSettlementService.initialize();
}
