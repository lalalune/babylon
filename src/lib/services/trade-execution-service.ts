/**
 * Trade Execution Service
 *
 * Executes LLM-generated trading decisions for NPCs.
 * Creates positions, updates balances, records trades.
 */
import type { Prisma } from '@prisma/client';

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import { FeeService } from '@/lib/services/fee-service';

import type {
  ExecutedTrade,
  ExecutionResult,
  TradingDecision,
} from '@/types/market-decisions';

import {
  type AggregatedImpact,
  type TradeImpactInput,
  aggregateTradeImpacts,
} from './market-impact-service';
import { getReadyPerpsEngine } from '@/lib/perps-service';

export class TradeExecutionService {
  /**
   * Execute a batch of trading decisions
   */
  async executeDecisionBatch(
    decisions: TradingDecision[]
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    const result: ExecutionResult = {
      totalDecisions: decisions.length,
      successfulTrades: 0,
      failedTrades: 0,
      holdDecisions: 0,
      totalVolumePerp: 0,
      totalVolumePrediction: 0,
      errors: [],
      executedTrades: [],
    };

    for (const decision of decisions) {
      if (decision.action === 'hold') {
        result.holdDecisions++;
        continue;
      }

      try {
        const executedTrade = await this.executeSingleDecision(decision);
        result.executedTrades.push(executedTrade);
        result.successfulTrades++;

        if (executedTrade.marketType === 'perp') {
          result.totalVolumePerp += executedTrade.size;
        } else {
          result.totalVolumePrediction += executedTrade.size;
        }
      } catch (error) {
        result.failedTrades++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          npcId: decision.npcId,
          decision,
          error: errorMessage,
        });

        // Use warn level for expected failures (non-existent organizations)
        // Use error level for unexpected system failures
        const isExpectedFailure = errorMessage.includes('Organization not found');
        const logLevel = isExpectedFailure ? 'warn' : 'error';
        
        logger[logLevel](
          `Failed to execute trade for ${decision.npcName}`,
          {
            error,
            decision,
          },
          'TradeExecutionService'
        );
      }
    }

    const duration = Date.now() - startTime;

    logger.info(
      `Executed ${result.successfulTrades} trades in ${duration}ms`,
      {
        ...result,
        durationMs: duration,
      },
      'TradeExecutionService'
    );

    return result;
  }

  /**
   * Execute a single trading decision
   */
  async executeSingleDecision(
    decision: TradingDecision
  ): Promise<ExecutedTrade> {
    // Get NPC's pool
    const actor = await prisma.actor.findUnique({
      where: { id: decision.npcId },
      include: {
        Pool: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!actor) {
      throw new Error(`Actor not found: ${decision.npcId}`);
    }

    const pool = actor.Pool[0];
    if (!pool) {
      throw new Error(`No active pool found for ${decision.npcName}`);
    }

    // Handle close position
    if (decision.action === 'close_position') {
      return await this.closePosition(decision, pool.id);
    }

    // Handle open position
    if (decision.action === 'open_long' || decision.action === 'open_short') {
      return await this.openPerpPosition(decision, pool.id);
    }

    if (decision.action === 'buy_yes' || decision.action === 'buy_no') {
      return await this.openPredictionPosition(decision, pool.id);
    }

    throw new Error(`Unknown action: ${decision.action}`);
  }

  /**
   * Open a perpetual position
   */
  private async openPerpPosition(
    decision: TradingDecision,
    poolId: string
  ): Promise<ExecutedTrade> {
    if (!decision.ticker) {
      throw new Error('Ticker required for perp position');
    }

    // Get current price - try exact match first for test reliability
    let org = await prisma.organization.findUnique({
      where: { id: decision.ticker },
    });

    // If not found by exact ID, try lowercase contains match  
    if (!org) {
      org = await prisma.organization.findFirst({
      where: {
        id: { contains: decision.ticker.toLowerCase() },
      },
    });
    }

    if (!org?.currentPrice) {
      logger.warn(
        `NPC tried to trade non-existent organization`,
        {
          npcId: decision.npcId,
          npcName: decision.npcName,
          ticker: decision.ticker,
          action: decision.action,
        },
        'TradeExecutionService'
      );
      throw new Error(`Organization not found: ${decision.ticker}`);
    }

    const currentPrice = org.currentPrice;
    const leverage = 5; // Standard leverage
    const side = decision.action === 'open_long' ? 'long' : 'short';

    // Generate transformed ticker for PerpsEngine (matches PerpetualsEngine.generateTicker)
    // This removes dashes and uppercases the org ID, truncated to 12 chars
    let engineTicker = org.id.toUpperCase().replace(/-/g, '');
    if (engineTicker.length > 12) {
      engineTicker = engineTicker.substring(0, 12);
    }

    // Calculate trading fee (0.1% on position size)
    const positionSize = decision.amount * leverage;
    const feeCalc = FeeService.calculateFee(positionSize);
    const totalCost = decision.amount + feeCalc.feeAmount;

    // Calculate liquidation price
    const liquidationDistance = side === 'long' ? 0.8 : 1.2;
    const liquidationPrice = currentPrice * liquidationDistance;

    // Execute in transaction
    const position = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Check and deduct from pool balance (margin + fee)
      const pool = await tx.pool.findUnique({ where: { id: poolId } });
      if (!pool) throw new Error(`Pool not found: ${poolId}`);

      const availableBalance = parseFloat(pool.availableBalance.toString());
      if (availableBalance < totalCost) {
        throw new Error(
          `Insufficient pool balance: ${availableBalance} < ${totalCost} (margin: ${decision.amount}, fee: ${feeCalc.feeAmount})`
        );
      }

      // Deduct margin + fee from pool and track fee
      await tx.pool.update({
        where: { id: poolId },
        data: {
          availableBalance: { decrement: totalCost },
          totalFeesCollected: { increment: feeCalc.feeAmount },
        },
      });

      // Create position
      // Store the raw organization ID as ticker for database consistency
      const pos = await tx.poolPosition.create({
        data: {
          id: await generateSnowflakeId(),
          poolId,
          marketType: 'perp',
          ticker: org.id, // Use raw org ID for database storage
          side,
          entryPrice: currentPrice,
          currentPrice,
          size: positionSize,
          leverage,
          liquidationPrice,
          unrealizedPnL: 0,
          updatedAt: new Date(),
        },
      });

      // Record trade
      await tx.nPCTrade.create({
        data: {
          id: await generateSnowflakeId(),
          npcActorId: decision.npcId,
          poolId,
          marketType: 'perp',
          ticker: org.id, // Use raw org ID for database storage
          action: decision.action,
          side,
          amount: decision.amount,
          price: currentPrice,
          sentiment: decision.confidence * (side === 'long' ? 1 : -1),
          reason: decision.reasoning,
        },
      });

      return pos;
    });

    // Add position to perpetuals engine for real-time tracking
    // Use the transformed ticker that matches PerpsEngine's market indexing
    const engine = await getReadyPerpsEngine();
    engine.hydratePosition({
      id: position.id,
      userId: poolId,
      ticker: engineTicker, // Use transformed ticker for engine
      organizationId: org.id,
      side,
      entryPrice: currentPrice,
      currentPrice,
      size: positionSize,
      leverage,
      liquidationPrice,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      fundingPaid: 0,
      openedAt: position.updatedAt,
      lastUpdated: position.updatedAt,
    });
    logger.info('Added NPC position to perpetuals engine', {
      positionId: position.id,
      ticker: decision.ticker,
      poolId,
    });

    return {
      npcId: decision.npcId,
      npcName: decision.npcName,
      poolId,
      marketType: 'perp',
      ticker: decision.ticker,
      action: decision.action,
      side,
      amount: decision.amount,
      size: positionSize,
      executionPrice: currentPrice,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      positionId: position.id,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Open a prediction market position
   */
  private async openPredictionPosition(
    decision: TradingDecision,
    poolId: string
  ): Promise<ExecutedTrade> {
    if (!decision.marketId) {
      throw new Error('MarketId required for prediction position');
    }

    // Get market
    const market = await prisma.market.findUnique({
      where: { id: decision.marketId.toString() },
    });

    if (!market) {
      throw new Error(`Market not found: ${decision.marketId}`);
    }

    const yesShares = parseFloat(market.yesShares.toString());
    const noShares = parseFloat(market.noShares.toString());
    const totalShares = yesShares + noShares;

    const yesPrice = totalShares > 0 ? (yesShares / totalShares) * 100 : 50;
    const noPrice = totalShares > 0 ? (noShares / totalShares) * 100 : 50;

    const side = decision.action === 'buy_yes' ? 'YES' : 'NO';
    const entryPrice = side === 'YES' ? yesPrice : noPrice;

    // Calculate trading fee (0.1% on trade amount)
    const shares = decision.amount; // Direct 1:1
    const feeCalc = FeeService.calculateFee(decision.amount);
    const totalCost = decision.amount + feeCalc.feeAmount;

    // Execute in transaction
    const position = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Check and deduct from pool balance (amount + fee)
      const pool = await tx.pool.findUnique({ where: { id: poolId } });
      if (!pool) throw new Error(`Pool not found: ${poolId}`);

      const availableBalance = parseFloat(pool.availableBalance.toString());
      if (availableBalance < totalCost) {
        throw new Error(
          `Insufficient pool balance: ${availableBalance} < ${totalCost} (amount: ${decision.amount}, fee: ${feeCalc.feeAmount})`
        );
      }

      // Deduct amount + fee from pool and track fee
      await tx.pool.update({
        where: { id: poolId },
        data: {
          availableBalance: { decrement: totalCost },
          totalFeesCollected: { increment: feeCalc.feeAmount },
        },
      });

      // Update market shares
      await tx.market.update({
        where: { id: decision.marketId!.toString() },
        data: {
          [side === 'YES' ? 'yesShares' : 'noShares']: {
            increment: shares,
          },
        },
      });

      // Create position
      const pos = await tx.poolPosition.create({
        data: {
          id: await generateSnowflakeId(),
          poolId,
          marketType: 'prediction',
          marketId: decision.marketId!.toString(),
          side,
          entryPrice,
          currentPrice: entryPrice,
          size: decision.amount,
          shares,
          unrealizedPnL: 0,
          updatedAt: new Date(),
        },
      });

      // Record trade
      await tx.nPCTrade.create({
        data: {
          id: await generateSnowflakeId(),
          npcActorId: decision.npcId,
          poolId,
          marketType: 'prediction',
          marketId: decision.marketId!.toString(),
          action: decision.action,
          side,
          amount: decision.amount,
          price: entryPrice,
          sentiment: decision.confidence * (side === 'YES' ? 1 : -1),
          reason: decision.reasoning,
        },
      });

      return pos;
    });

    return {
      npcId: decision.npcId,
      npcName: decision.npcName,
      poolId,
      marketType: 'prediction',
      marketId: decision.marketId,
      action: decision.action,
      side,
      amount: decision.amount,
      size: decision.amount,
      shares,
      executionPrice: entryPrice,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      positionId: position.id,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Close an existing position
   */
  private async closePosition(
    decision: TradingDecision,
    poolId: string
  ): Promise<ExecutedTrade> {
    if (!decision.positionId) {
      throw new Error('PositionId required to close position');
    }

    const position = await prisma.poolPosition.findUnique({
      where: { id: decision.positionId },
    });

    if (!position) {
      throw new Error(`Position not found: ${decision.positionId}`);
    }

    if (position.closedAt) {
      throw new Error(`Position already closed: ${decision.positionId}`);
    }

    // Get current price
    let currentPrice = position.currentPrice;

    if (position.marketType === 'perp' && position.ticker) {
      const org = await prisma.organization.findFirst({
        where: { id: { contains: position.ticker, mode: 'insensitive' } },
      });
      if (org?.currentPrice) {
        currentPrice = org.currentPrice;
      }
    } else if (position.marketType === 'prediction' && position.marketId) {
      const market = await prisma.market.findUnique({
        where: { id: position.marketId },
      });
      if (market) {
        const yesShares = parseFloat(market.yesShares.toString());
        const noShares = parseFloat(market.noShares.toString());
        const totalShares = yesShares + noShares;
        if (totalShares > 0) {
          currentPrice =
            position.side === 'YES'
              ? (yesShares / totalShares) * 100
              : (noShares / totalShares) * 100;
        }
      }
    }

    // Calculate P&L
    const priceChange = currentPrice - position.entryPrice;
    const isLong = position.side === 'long' || position.side === 'YES';
    const pnlMultiplier = isLong ? 1 : -1;

    let realizedPnL: number;
    if (position.marketType === 'perp') {
      const percentChange = priceChange / position.entryPrice;
      realizedPnL = percentChange * position.size * pnlMultiplier;
    } else {
      const shares = position.shares || 0;
      realizedPnL = (priceChange / 100) * shares;
    }

    // Calculate trading fee (0.1% on position size)
    const feeCalc = FeeService.calculateFee(position.size);
    const grossReturn = position.size + realizedPnL;
    const netReturn = Math.max(0, grossReturn - feeCalc.feeAmount);

    // Execute in transaction
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Close position
      await tx.poolPosition.update({
        where: { id: decision.positionId! },
        data: {
          closedAt: new Date(),
          currentPrice,
          unrealizedPnL: 0,
          realizedPnL,
          updatedAt: new Date(),
        },
      });

      // Return capital + P&L to pool (after fee deduction) and track fee
      await tx.pool.update({
        where: { id: poolId },
        data: {
          availableBalance: { increment: netReturn },
          lifetimePnL: { increment: realizedPnL },
          totalFeesCollected: { increment: feeCalc.feeAmount },
        },
      });

      // Record trade
      await tx.nPCTrade.create({
        data: {
          id: await generateSnowflakeId(),
          npcActorId: decision.npcId,
          poolId,
          marketType: position.marketType,
          ticker: position.ticker,
          marketId: position.marketId,
          action: 'close',
          side: position.side,
          amount: position.size,
          price: currentPrice,
          sentiment: 0,
          reason: decision.reasoning,
        },
      });
    });

    // Remove position from perpetuals engine if it's a perp position
    if (position.marketType === 'perp') {
      const engine = await getReadyPerpsEngine();
      if (engine.hasPosition(position.id)) {
        engine.closePosition(position.id);
        logger.info('Removed NPC position from perpetuals engine', {
          positionId: position.id,
          ticker: position.ticker,
          poolId,
        });
      }
    }

    return {
      npcId: decision.npcId,
      npcName: decision.npcName,
      poolId,
      marketType: position.marketType as 'perp' | 'prediction',
      ticker: position.ticker || undefined,
      marketId: position.marketId ?? undefined,
      action: 'close_position',
      side: position.side,
      amount: position.size,
      size: position.size,
      shares: position.shares || undefined,
      executionPrice: currentPrice,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      positionId: position.id,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get total trade impact by ticker/market
   */
  async getTradeImpacts(
    executedTrades: ExecutedTrade[]
  ): Promise<Map<string, AggregatedImpact>> {
    const inputs: TradeImpactInput[] = executedTrades.map((trade: ExecutedTrade) => ({
      marketType: trade.marketType,
      ticker: trade.ticker,
      marketId: trade.marketId,
      side: trade.side,
      size: trade.size,
    }));

    return aggregateTradeImpacts(inputs);
  }
}
