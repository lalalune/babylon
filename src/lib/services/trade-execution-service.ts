/**
 * Trade Execution Service
 *
 * Executes LLM-generated trading decisions for NPCs.
 * Creates positions, updates balances, records trades.
 */
import { Prisma } from '@prisma/client';

import { invalidateAfterPredictionTrade } from '@/lib/cache/trade-cache-invalidation';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import { PredictionMarketEventService } from '@/lib/services/prediction-market-event-service';
import { PredictionPriceHistoryService } from '@/lib/services/prediction-price-history-service';
import { FeeService } from '@/lib/services/fee-service';
import { PredictionPricing } from '@/lib/prediction-pricing';

import type {
  ExecutedTrade,
  TradingDecision,
} from '@/types/market-decisions';
import type { TradingExecutionResult } from '@/types/market-decisions';

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
  ): Promise<TradingExecutionResult> {
    const startTime = Date.now();

    const result: TradingExecutionResult = {
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

        // Use warn level for expected failures (non-existent organizations, insufficient balance)
        // Use error level for unexpected system failures
        const isExpectedFailure = 
          errorMessage.includes('Organization not found') ||
          errorMessage.includes('Insufficient pool balance') ||
          errorMessage.includes('Market not found') ||
          errorMessage.includes('Market already resolved') ||
          errorMessage.includes('Market expired');
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

    const pool = actor.Pool[0]
    if (!pool) {
      throw new Error(`No active pool found for ${decision.npcName}`)
    }

    // Pre-check pool balance before attempting trade
    const availableBalance = parseFloat(pool.availableBalance.toString());
    
    // For prediction markets, estimate total cost (amount + fee)
    if (decision.action === 'buy_yes' || decision.action === 'buy_no') {
      if (decision.marketId) {
        const market = await prisma.market.findUnique({
          where: { id: decision.marketId.toString() },
        });
        
        if (market) {
          const side = decision.action === 'buy_yes' ? 'yes' : 'no';
          const calculation = PredictionPricing.calculateBuyWithFees(
            Number(market.yesShares),
            Number(market.noShares),
            side,
            decision.amount
          );
          const totalWithFee = calculation.totalWithFee ?? decision.amount;
          
          if (availableBalance < totalWithFee) {
            logger.warn(
              `Insufficient pool balance for ${decision.npcName}: ${availableBalance} < ${totalWithFee} (requested: ${decision.amount})`,
              {
                npcId: decision.npcId,
                npcName: decision.npcName,
                availableBalance,
                requestedAmount: decision.amount,
                totalWithFee,
                marketId: decision.marketId,
              },
              'TradeExecutionService'
            );
            throw new Error(
              `Insufficient pool balance: ${availableBalance} < ${totalWithFee} (amount: ${decision.amount}, fee: ${calculation.fee})`
            );
          }
        }
      }
    }
    
    // For perp positions, estimate total cost (margin + fee)
    if (decision.action === 'open_long' || decision.action === 'open_short') {
      const leverage = 5; // Standard leverage
      const positionSize = decision.amount * leverage;
      const feeCalc = FeeService.calculateFee(positionSize);
      const totalCost = decision.amount + feeCalc.feeAmount;
      
      if (availableBalance < totalCost) {
        logger.warn(
          `Insufficient pool balance for ${decision.npcName}: ${availableBalance} < ${totalCost} (requested margin: ${decision.amount})`,
          {
            npcId: decision.npcId,
            npcName: decision.npcName,
            availableBalance,
            requestedMargin: decision.amount,
            totalCost,
            ticker: decision.ticker,
          },
          'TradeExecutionService'
        );
        throw new Error(
          `Insufficient pool balance: ${availableBalance} < ${totalCost} (margin: ${decision.amount}, fee: ${feeCalc.feeAmount})`
        );
      }
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

    if (market.resolved) {
      throw new Error(`Market already resolved: ${decision.marketId}`);
    }

    if (new Date() > market.endDate) {
      throw new Error(`Market expired: ${decision.marketId}`);
    }

    const side = decision.action === 'buy_yes' ? 'YES' : 'NO';
    const sideLabel: 'yes' | 'no' = side === 'YES' ? 'yes' : 'no';

    const calculation = PredictionPricing.calculateBuyWithFees(
      Number(market.yesShares),
      Number(market.noShares),
      side === 'YES' ? 'yes' : 'no',
      decision.amount
    );

    if (calculation.netAmount <= 0) {
      throw new Error('Trade amount too low after fees');
    }

    const totalWithFee = calculation.totalWithFee ?? decision.amount;
    const entryPrice = calculation.avgPrice * 100;
    const postTradePrice =
      (side === 'YES' ? calculation.newYesPrice : calculation.newNoPrice) * 100;

    // Execute in transaction
    const position = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Check and deduct from pool balance (amount + fee)
      const pool = await tx.pool.findUnique({ where: { id: poolId } });
      if (!pool) throw new Error(`Pool not found: ${poolId}`);

      const availableBalance = parseFloat(pool.availableBalance.toString());
      if (availableBalance < totalWithFee) {
        throw new Error(
          `Insufficient pool balance: ${availableBalance} < ${totalWithFee} (amount: ${decision.amount}, fee: ${calculation.fee})`
        );
      }

      // Deduct amount + fee from pool and track fee
      await tx.pool.update({
        where: { id: poolId },
        data: {
          availableBalance: { decrement: totalWithFee },
          totalFeesCollected: { increment: calculation.fee },
        },
      });

      // Update market shares with CPMM output
      await tx.market.update({
        where: { id: decision.marketId!.toString() },
        data: {
          yesShares: new Prisma.Decimal(calculation.newYesShares),
          noShares: new Prisma.Decimal(calculation.newNoShares),
          liquidity: {
            increment: new Prisma.Decimal(calculation.netAmount),
          },
        },
      });

      const now = new Date();

      // Create position
      const pos = await tx.poolPosition.create({
        data: {
          id: await generateSnowflakeId(),
          poolId,
          marketType: 'prediction',
          marketId: decision.marketId!.toString(),
          side,
          entryPrice,
          currentPrice: postTradePrice,
          size: calculation.netAmount,
          shares: calculation.sharesBought,
          unrealizedPnL: 0,
          openedAt: now,
          updatedAt: now,
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
          amount: totalWithFee,
          price: entryPrice,
          sentiment: decision.confidence * (side === 'YES' ? 1 : -1),
          reason: decision.reasoning,
        },
      });

      return pos;
    });

    const liquidityAfter = Number(market.liquidity ?? 0) + calculation.netAmount;

    await PredictionPriceHistoryService.recordSnapshot({
      marketId: decision.marketId!.toString(),
      yesPrice: calculation.newYesPrice,
      noPrice: calculation.newNoPrice,
      yesShares: calculation.newYesShares,
      noShares: calculation.newNoShares,
      liquidity: liquidityAfter,
      eventType: 'trade',
      source: 'npc_trade',
    }).catch((error) => {
      logger.warn('Failed to record price history for NPC buy', { error, marketId: decision.marketId }, 'TradeExecutionService');
    });

    await invalidateAfterPredictionTrade(decision.marketId).catch((error) => {
      logger.warn('Failed to invalidate cache after NPC prediction buy', { error, marketId: decision.marketId }, 'TradeExecutionService');
    });

    PredictionMarketEventService.emitTradeUpdate({
      marketId: decision.marketId!.toString(),
      yesPrice: calculation.newYesPrice,
      noPrice: calculation.newNoPrice,
      yesShares: calculation.newYesShares,
      noShares: calculation.newNoShares,
      liquidity: liquidityAfter,
      trade: {
        actorType: 'npc',
        actorId: decision.npcId,
        action: 'buy',
        side: sideLabel,
        shares: calculation.sharesBought,
        amount: calculation.netAmount,
        price: entryPrice,
        source: 'npc_trade',
        timestamp: new Date().toISOString(),
      },
    });

    return {
      npcId: decision.npcId,
      npcName: decision.npcName,
      poolId,
      marketType: 'prediction',
      marketId: decision.marketId,
      action: decision.action,
      side,
      amount: totalWithFee,
      size: calculation.netAmount,
      shares: calculation.sharesBought,
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

    const now = new Date();

    if (position.marketType === 'prediction') {
      if (!position.marketId) {
        throw new Error(`Prediction position missing marketId: ${position.id}`);
      }

      const shares = position.shares ?? 0;
      if (shares <= 0) {
        throw new Error(`Prediction position has no shares to close: ${position.id}`);
      }

      const side = position.side === 'YES' || position.side === 'NO' ? position.side : null;
      if (!side) {
        throw new Error(`Invalid prediction position side: ${position.side}`);
      }

      const market = await prisma.market.findUnique({
        where: { id: position.marketId },
      });

      if (!market) {
        throw new Error(`Market not found: ${position.marketId}`);
      }

      const calculation = PredictionPricing.calculateSellWithFees(
        Number(market.yesShares),
        Number(market.noShares),
        side === 'YES' ? 'yes' : 'no',
        shares
      );

      const grossProceeds = calculation.totalCost;
      const netProceeds = calculation.netProceeds ?? calculation.netAmount;

      if (netProceeds <= 0) {
        throw new Error(`Calculated net proceeds must be positive (position ${position.id})`);
      }

      const exitPrice = calculation.avgPrice * 100;
      const postTradePrice =
        (side === 'YES' ? calculation.newYesPrice : calculation.newNoPrice) * 100;
      const realizedPnL = netProceeds - position.size;
      const liquidityAfter = Math.max(
        0,
        Number(market.liquidity ?? 0) - grossProceeds
      );
      const sideLabel: 'yes' | 'no' = side === 'YES' ? 'yes' : 'no';

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.poolPosition.update({
          where: { id: position.id },
          data: {
            closedAt: now,
            currentPrice: postTradePrice,
            unrealizedPnL: 0,
            realizedPnL,
            updatedAt: now,
          },
        });

        await tx.market.update({
          where: { id: position.marketId! },
          data: {
            yesShares: new Prisma.Decimal(calculation.newYesShares),
            noShares: new Prisma.Decimal(calculation.newNoShares),
            liquidity: {
              decrement: new Prisma.Decimal(grossProceeds),
            },
          },
        });

        await tx.pool.update({
          where: { id: poolId },
          data: {
            availableBalance: { increment: netProceeds },
            lifetimePnL: { increment: realizedPnL },
            totalFeesCollected: { increment: calculation.fee },
          },
        });

        await tx.nPCTrade.create({
          data: {
            id: await generateSnowflakeId(),
            npcActorId: decision.npcId,
            poolId,
            marketType: 'prediction',
            marketId: position.marketId,
            action: 'close',
            side,
            amount: netProceeds,
            price: exitPrice,
            sentiment: 0,
            reason: decision.reasoning,
          },
        });
      });

      await PredictionPriceHistoryService.recordSnapshot({
        marketId: position.marketId,
        yesPrice: calculation.newYesPrice,
        noPrice: calculation.newNoPrice,
        yesShares: calculation.newYesShares,
        noShares: calculation.newNoShares,
        liquidity: liquidityAfter,
        eventType: 'trade',
        source: 'npc_trade',
      }).catch((error) => {
        logger.warn('Failed to record price history for NPC close', { error, marketId: position.marketId }, 'TradeExecutionService');
      });

      await invalidateAfterPredictionTrade(position.marketId).catch((error) => {
        logger.warn('Failed to invalidate cache after NPC prediction close', { error, marketId: position.marketId }, 'TradeExecutionService');
      });

      PredictionMarketEventService.emitTradeUpdate({
        marketId: position.marketId,
        yesPrice: calculation.newYesPrice,
        noPrice: calculation.newNoPrice,
        yesShares: calculation.newYesShares,
        noShares: calculation.newNoShares,
        liquidity: liquidityAfter,
        trade: {
          actorType: 'npc',
          actorId: decision.npcId,
          action: 'sell',
          side: sideLabel,
          shares,
          amount: netProceeds,
          price: calculation.avgPrice,
          source: 'npc_trade',
          timestamp: now.toISOString(),
        },
      });

      return {
        npcId: decision.npcId,
        npcName: decision.npcName,
        poolId,
        marketType: 'prediction',
        marketId: position.marketId ?? undefined,
        action: 'close_position',
        side,
        amount: netProceeds,
        size: position.size,
        shares: position.shares ?? undefined,
        executionPrice: exitPrice,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        positionId: position.id,
        timestamp: now.toISOString(),
      };
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
          closedAt: now,
          currentPrice,
          unrealizedPnL: 0,
          realizedPnL,
          updatedAt: now,
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
