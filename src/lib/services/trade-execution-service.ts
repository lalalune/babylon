/**
 * Trade Execution Service
 * 
 * Executes LLM-generated trading decisions for NPCs.
 * Creates positions, updates balances, records trades.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { TradingDecision, ExecutedTrade, ExecutionResult } from '@/types/market-decisions';

export class TradeExecutionService {
  /**
   * Execute a batch of trading decisions
   */
  async executeDecisionBatch(decisions: TradingDecision[]): Promise<ExecutionResult> {
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
        result.errors.push({
          npcId: decision.npcId,
          decision,
          error: error instanceof Error ? error.message : String(error),
        });
        
        logger.error(`Failed to execute trade for ${decision.npcName}`, {
          error,
          decision,
        }, 'TradeExecutionService');
      }
    }
    
    const duration = Date.now() - startTime;
    
    logger.info(`Executed ${result.successfulTrades} trades in ${duration}ms`, {
      ...result,
      durationMs: duration,
    }, 'TradeExecutionService');
    
    return result;
  }
  
  /**
   * Execute a single trading decision
   */
  async executeSingleDecision(decision: TradingDecision): Promise<ExecutedTrade> {
    // Get NPC's pool
    const actor = await prisma.actor.findUnique({
      where: { id: decision.npcId },
      include: {
        pools: {
          where: { isActive: true },
          take: 1,
        },
      },
    });
    
    if (!actor) {
      throw new Error(`Actor not found: ${decision.npcId}`);
    }
    
    const pool = actor.pools[0];
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
    
    // Get current price
    const org = await prisma.organization.findFirst({
      where: {
        id: { contains: decision.ticker.toLowerCase() },
      },
    });
    
    if (!org?.currentPrice) {
      throw new Error(`Organization not found for ticker: ${decision.ticker}`);
    }
    
    const currentPrice = org.currentPrice;
    const leverage = 5; // Standard leverage
    const side = decision.action === 'open_long' ? 'long' : 'short';
    
    // NPC pool trades have NO trading fees (only 5% performance fee on withdrawal)
    const positionSize = decision.amount * leverage;
    
    // Calculate liquidation price
    const liquidationDistance = side === 'long' ? 0.8 : 1.2;
    const liquidationPrice = currentPrice * liquidationDistance;
    
    // Execute in transaction
    const position = await prisma.$transaction(async (tx) => {
      // Check and deduct from pool balance
      const pool = await tx.pool.findUnique({ where: { id: poolId } });
      if (!pool) throw new Error(`Pool not found: ${poolId}`);
      
      const availableBalance = parseFloat(pool.availableBalance.toString());
      if (availableBalance < decision.amount) {
        throw new Error(`Insufficient pool balance: ${availableBalance} < ${decision.amount}`);
      }
      
      // Deduct from pool
      await tx.pool.update({
        where: { id: poolId },
        data: {
          availableBalance: { decrement: decision.amount },
        },
      });
      
      // Create position
      const pos = await tx.poolPosition.create({
        data: {
          poolId,
          marketType: 'perp',
          ticker: decision.ticker!,
          side,
          entryPrice: currentPrice,
          currentPrice,
          size: positionSize,
          leverage,
          liquidationPrice,
          unrealizedPnL: 0,
        },
      });
      
      // Record trade
      await tx.nPCTrade.create({
        data: {
          npcActorId: decision.npcId,
          poolId,
          marketType: 'perp',
          ticker: decision.ticker!,
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
    
    // NPC pool trades have NO trading fees (only 5% performance fee on withdrawal)
    const shares = decision.amount; // Direct 1:1
    
    // Execute in transaction
    const position = await prisma.$transaction(async (tx) => {
      // Check and deduct from pool balance
      const pool = await tx.pool.findUnique({ where: { id: poolId } });
      if (!pool) throw new Error(`Pool not found: ${poolId}`);
      
      const availableBalance = parseFloat(pool.availableBalance.toString());
      if (availableBalance < decision.amount) {
        throw new Error(`Insufficient pool balance: ${availableBalance} < ${decision.amount}`);
      }
      
      // Deduct from pool
      await tx.pool.update({
        where: { id: poolId },
        data: {
          availableBalance: { decrement: decision.amount },
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
          poolId,
          marketType: 'prediction',
          marketId: decision.marketId!.toString(),
          side,
          entryPrice,
          currentPrice: entryPrice,
          size: decision.amount,
          shares,
          unrealizedPnL: 0,
        },
      });
      
      // Record trade
      await tx.nPCTrade.create({
        data: {
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
        where: { id: { contains: position.ticker.toLowerCase() } },
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
          currentPrice = position.side === 'YES'
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
    
    // NPC pool trades have NO trading fees (only 5% performance fee on withdrawal)
    
    // Execute in transaction
    await prisma.$transaction(async (tx) => {
      // Close position
      await tx.poolPosition.update({
        where: { id: decision.positionId! },
        data: {
          closedAt: new Date(),
          currentPrice,
          unrealizedPnL: 0,
          realizedPnL,
        },
      });
      
      // Return capital + P&L to pool (no trading fee)
      const returnAmount = position.size + realizedPnL;
      
      await tx.pool.update({
        where: { id: poolId },
        data: {
          availableBalance: { increment: returnAmount },
          lifetimePnL: { increment: realizedPnL },
        },
      });
      
      // Record trade
      await tx.nPCTrade.create({
        data: {
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
    
    return {
      npcId: decision.npcId,
      npcName: decision.npcName,
      poolId,
      marketType: position.marketType as 'perp' | 'prediction',
      ticker: position.ticker || undefined,
      marketId: position.marketId ? parseInt(position.marketId) : undefined,
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
  async getTradeImpacts(executedTrades: ExecutedTrade[]): Promise<Map<string, {
    longVolume: number;
    shortVolume: number;
    yesVolume: number;
    noVolume: number;
    netSentiment: number;
  }>> {
    const impacts = new Map<string, {
      longVolume: number;
      shortVolume: number;
      yesVolume: number;
      noVolume: number;
      netSentiment: number;
    }>();
    
    for (const trade of executedTrades) {
      const key = trade.ticker || `market-${trade.marketId}`;
      
      const impact = impacts.get(key) || {
        longVolume: 0,
        shortVolume: 0,
        yesVolume: 0,
        noVolume: 0,
        netSentiment: 0,
      };
      
      if (trade.marketType === 'perp') {
        if (trade.side === 'long') {
          impact.longVolume += trade.size;
        } else {
          impact.shortVolume += trade.size;
        }
      } else {
        if (trade.side === 'YES') {
          impact.yesVolume += trade.size;
        } else {
          impact.noVolume += trade.size;
        }
      }
      
      impacts.set(key, impact);
    }
    
    // Calculate net sentiment for each
    for (const [, impact] of impacts) {
      const totalPerp = impact.longVolume + impact.shortVolume;
      const totalPred = impact.yesVolume + impact.noVolume;
      
      if (totalPerp > 0) {
        impact.netSentiment = (impact.longVolume - impact.shortVolume) / totalPerp;
      } else if (totalPred > 0) {
        impact.netSentiment = (impact.yesVolume - impact.noVolume) / totalPred;
      }
    }
    
    return impacts;
  }
}

