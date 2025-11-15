/**
 * NPC Investment Manager
 *
 * Coordinates NPC portfolio management, including:
 * - Trade execution and monitoring
 * - Position rebalancing
 * - Risk management
 * - Performance tracking
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getReputationBreakdown } from '@/lib/reputation/reputation-service';
import { generateSnowflakeId } from '@/lib/snowflake';
import type { TradingDecision, TradingExecutionResult } from '@/types/market-decisions';
import { TradeExecutionService } from '@/lib/services/trade-execution-service';

export interface PortfolioPosition {
  id: string;
  poolId: string;
  marketType: 'perp' | 'prediction';
  ticker?: string;
  marketId?: string;
  side: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  leverage?: number;
}

export interface PortfolioMetrics {
  totalValue: number;
  availableBalance: number;
  unrealizedPnL: number;
  realizedPnL: number;
  positionCount: number;
  utilization: number; // Percentage of capital deployed
  riskScore: number;   // 0-1, higher = riskier
}

export interface RebalanceAction {
  type: 'open' | 'close' | 'resize';
  positionId?: string;
  marketType: 'perp' | 'prediction';
  ticker?: string;
  marketId?: string;
  side: string;
  targetSize: number;
  reason: string;
}

export class NPCInvestmentManager {
  /**
   * Get portfolio metrics for an NPC pool
   */
  static async getPortfolioMetrics(poolId: string): Promise<PortfolioMetrics> {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        PoolPosition: {
          where: { closedAt: null }, // Open positions have null closedAt
        },
      },
    });

    if (!pool) {
      throw new Error(`Pool not found: ${poolId}`);
    }

    const positions = pool.PoolPosition as unknown as PortfolioPosition[];
    const availableBalance = parseFloat(pool.availableBalance.toString());

    // Calculate total invested capital (sum of all open position entry values)
    const totalInvested = positions.reduce((sum, pos) => {
      return sum + parseFloat(pos.size?.toString() || '0');
    }, 0);

    // Calculate unrealized PnL from open positions
    const unrealizedPnL = positions.reduce((sum, pos) => {
      return sum + parseFloat(pos.unrealizedPnL?.toString() || '0');
    }, 0);

    // Calculate total portfolio value
    const totalValue = availableBalance + totalInvested + unrealizedPnL;

    // Calculate utilization (how much capital is deployed)
    const utilization = totalValue > 0 ? (totalInvested / totalValue) * 100 : 0;

    // Calculate risk score based on leverage and concentration
    const riskScore = this.calculateRiskScore(positions, totalValue);

    return {
      totalValue,
      availableBalance,
      unrealizedPnL,
      realizedPnL: 0, // Could track from trade history
      positionCount: positions.length,
      utilization,
      riskScore,
    };
  }

  /**
   * Calculate portfolio risk score (0-1)
   */
  private static calculateRiskScore(
    positions: PortfolioPosition[],
    totalValue: number
  ): number {
    if (positions.length === 0 || totalValue === 0) return 0;

    let riskScore = 0;

    // Factor 1: Leverage risk (40% weight)
    const avgLeverage = positions.reduce((sum, pos) => {
      return sum + (pos.leverage || 1);
    }, 0) / positions.length;
    const leverageRisk = Math.min(1, avgLeverage / 10); // Normalize to 0-1 (10x leverage = max risk)
    riskScore += leverageRisk * 0.4;

    // Factor 2: Concentration risk (30% weight)
    const largestPosition = Math.max(
      ...positions.map(pos => Math.abs(parseFloat(pos.unrealizedPnL?.toString() || '0')))
    );
    const concentrationRisk = Math.min(1, largestPosition / totalValue);
    riskScore += concentrationRisk * 0.3;

    // Factor 3: Drawdown risk (30% weight)
    const totalUnrealizedPnL = positions.reduce((sum, pos) => {
      return sum + parseFloat(pos.unrealizedPnL?.toString() || '0');
    }, 0);
    const drawdownRisk = totalUnrealizedPnL < 0
      ? Math.min(1, Math.abs(totalUnrealizedPnL) / totalValue)
      : 0;
    riskScore += drawdownRisk * 0.3;

    return Math.min(1, riskScore);
  }

  /**
   * Monitor portfolio and generate rebalance actions if needed
   */
  static async monitorPortfolio(
    poolId: string,
    npcUserId: string,
    strategy: 'aggressive' | 'conservative' | 'balanced'
  ): Promise<RebalanceAction[]> {
    const metrics = await this.getPortfolioMetrics(poolId);
    const actions: RebalanceAction[] = [];

    // Risk thresholds by strategy
    const riskThresholds = {
      aggressive: 0.8,
      conservative: 0.4,
      balanced: 0.6,
    };

    const maxRisk = riskThresholds[strategy];

    // Check if portfolio is too risky
    if (metrics.riskScore > maxRisk) {
      logger.warn(
        `Portfolio risk too high for ${strategy} strategy: ${metrics.riskScore.toFixed(2)} > ${maxRisk}`,
        { poolId, npcUserId },
        'NPCInvestmentManager'
      );

      // Generate de-risking actions
      const deRiskActions = await this.generateDeRiskingActions(poolId, metrics);
      actions.push(...deRiskActions);
    }

    // Check if utilization is too low (idle capital)
    const targetUtilization = {
      aggressive: 80,
      conservative: 50,
      balanced: 65,
    };

    if (metrics.utilization < targetUtilization[strategy] - 10) {
      logger.info(
        `Portfolio underutilized: ${metrics.utilization.toFixed(1)}% < ${targetUtilization[strategy]}%`,
        { poolId, npcUserId },
        'NPCInvestmentManager'
      );
      // Could trigger new investment allocations here
    }

    // Check for positions with large unrealized losses
    const lossyPositions = await this.findPositionsWithLargeDrawdowns(poolId, 0.2); // >20% loss
    if (lossyPositions.length > 0) {
      logger.warn(
        `Found ${lossyPositions.length} positions with large drawdowns`,
        { poolId, npcUserId },
        'NPCInvestmentManager'
      );

      for (const position of lossyPositions) {
        actions.push({
          type: 'close',
          positionId: position.id,
          marketType: position.marketType,
          ticker: position.ticker,
          marketId: position.marketId,
          side: position.side,
          targetSize: 0,
          reason: `Stop-loss triggered: ${position.unrealizedPnL.toFixed(2)} loss`,
        });
      }
    }

    return actions;
  }

  /**
   * Ensure each NPC pool has an initial baseline allocation
   * Invests ~80% of available balance across aligned companies
   */
  static async executeBaselineInvestments(timestamp: Date = new Date()): Promise<TradingExecutionResult | null> {
    const baselineDecisions = await this.buildBaselineDecisions();

    if (baselineDecisions.length === 0) {
      return null;
    }

    logger.info(
      `Executing ${baselineDecisions.length} baseline NPC trades`,
      { timestamp: timestamp.toISOString() },
      'NPCInvestmentManager'
    );

    const tradeExecutionService = new TradeExecutionService();
    const result = await tradeExecutionService.executeDecisionBatch(baselineDecisions);

    logger.info(
      'Baseline NPC investments completed',
      {
        trades: result.successfulTrades,
        pools: new Set(baselineDecisions.map((d) => d.npcId)).size,
      },
      'NPCInvestmentManager'
    );

    return result;
  }

  /**
   * Build baseline allocation decisions for NPC pools lacking exposure
   */
  private static async buildBaselineDecisions(): Promise<TradingDecision[]> {
    const activePools = await prisma.pool.findMany({
      where: { isActive: true },
      include: {
        PoolPosition: {
          where: { closedAt: null },
          select: { id: true },
        },
      },
    });

    if (activePools.length === 0) {
      return [];
    }

    const actorIds = Array.from(new Set(activePools.map((pool) => pool.npcActorId)));

    const organizationsPromise = prisma.organization.findMany({
      where: { type: 'company' },
      select: {
        id: true,
        name: true,
        currentPrice: true,
        initialPrice: true,
      },
    });

    const relationships = await prisma.actorRelationship.findMany({
      where: {
        OR: [
          { actor1Id: { in: actorIds } },
          { actor2Id: { in: actorIds } },
        ],
      },
      select: {
        actor1Id: true,
        actor2Id: true,
        sentiment: true,
        strength: true,
      },
    });

    const actorIdSet = new Set(actorIds);
    relationships.forEach((rel) => {
      actorIdSet.add(rel.actor1Id);
      actorIdSet.add(rel.actor2Id);
    });

    const actors = await prisma.actor.findMany({
      where: { id: { in: Array.from(actorIdSet) } },
      select: {
        id: true,
        name: true,
        affiliations: true,
      },
    });

    const organizations = await organizationsPromise;

    const actorMap = new Map(actors.map((actor) => [actor.id, actor]));
    const organizationMap = new Map(organizations.map((org) => [org.id, org]));
    // Use organization ID directly as ticker for reliable lookups
    const organizationTickerMap = new Map(
      organizations.map((org) => [org.id, org.id])
    );

    const relationshipsByActor = new Map<string, Array<{ otherId: string; sentiment: number; strength: number }>>();
    relationships.forEach((rel) => {
      relationshipsByActor.set(rel.actor1Id, [
        ...(relationshipsByActor.get(rel.actor1Id) || []),
        { otherId: rel.actor2Id, sentiment: rel.sentiment, strength: rel.strength },
      ]);
      relationshipsByActor.set(rel.actor2Id, [
        ...(relationshipsByActor.get(rel.actor2Id) || []),
        { otherId: rel.actor1Id, sentiment: rel.sentiment, strength: rel.strength },
      ]);
    });

    // Sort fallback organizations by current price (descending) to pick meaningful assets
    const fallbackOrganizations = [...organizations].sort(
      (a, b) => (b.currentPrice ?? b.initialPrice ?? 100) - (a.currentPrice ?? a.initialPrice ?? 100)
    );

    const baselineDecisions: TradingDecision[] = [];

    for (const pool of activePools) {
      // Skip pools that already hold positions
      if (pool.PoolPosition.length > 0) {
        continue;
      }

      const actor = actorMap.get(pool.npcActorId);
      if (!actor) {
        continue;
      }

      const availableBalance = parseFloat(pool.availableBalance.toString());
      if (availableBalance <= 0) {
        continue;
      }

      const investBudget = availableBalance * 0.8;
      if (investBudget < 1) {
        continue;
      }

      const targetOrgIds = new Set<string>();

      (actor.affiliations || []).forEach((orgId) => {
        if (organizationMap.has(orgId)) {
          targetOrgIds.add(orgId);
        }
      });

      const relatedActors = relationshipsByActor.get(actor.id) || [];
      relatedActors
        .filter((rel) => rel.sentiment >= 0.25 && rel.strength >= 0.4)
        .forEach((rel) => {
          const counterpart = actorMap.get(rel.otherId);
          counterpart?.affiliations?.forEach((orgId) => {
            if (organizationMap.has(orgId)) {
              targetOrgIds.add(orgId);
            }
          });
        });

      if (targetOrgIds.size === 0) {
        fallbackOrganizations.slice(0, 3).forEach((org) => targetOrgIds.add(org.id));
      }

      const targetTickers = Array.from(targetOrgIds)
        .map((orgId) => organizationTickerMap.get(orgId))
        .filter((ticker): ticker is string => Boolean(ticker))
        .slice(0, 5);

      if (targetTickers.length === 0) {
        continue;
      }

      let remainingBudget = investBudget;

      targetTickers.forEach((ticker, index) => {
        const allocationsRemaining = targetTickers.length - index;
        let allocation = remainingBudget / allocationsRemaining;
        allocation = Number(allocation.toFixed(2));

        if (allocation <= 0) {
          return;
        }

        remainingBudget = Math.max(remainingBudget - allocation, 0);

        baselineDecisions.push({
          npcId: actor.id,
          npcName: actor.name,
          action: 'open_long',
          marketType: 'perp',
          ticker,
          amount: allocation,
          confidence: 0.9,
          reasoning: 'Baseline allocation to aligned organizations',
        });
      });
    }

    return baselineDecisions;
  }

  /**
   * Generate de-risking actions to reduce portfolio risk
   */
  private static async generateDeRiskingActions(
    poolId: string,
    metrics: PortfolioMetrics
  ): Promise<RebalanceAction[]> {
    const actions: RebalanceAction[] = [];

    // Calculate de-risking urgency based on metrics
    const riskScore = metrics.riskScore || 0;
    const unrealizedPnL = metrics.unrealizedPnL || 0;
    const isHighRisk = riskScore > 0.7;
    const hasLosses = unrealizedPnL < 0;

    // Determine how many positions to close based on risk level
    const positionsToClose = isHighRisk ? (hasLosses ? 5 : 3) : 2;

    // Get all leveraged positions
    const positions = await prisma.poolPosition.findMany({
      where: {
        poolId,
        closedAt: null, // Open positions only
        leverage: { gt: 1 },
      },
      orderBy: {
        leverage: 'desc', // Highest leverage first
      },
      take: positionsToClose,
    });

    for (const position of positions) {
      actions.push({
        type: 'close',
        positionId: position.id,
        marketType: position.marketType as 'perp' | 'prediction',
        ticker: position.ticker || undefined,
        marketId: position.marketId || undefined,
        side: position.side,
        targetSize: 0,
        reason: `De-risking: high leverage (${position.leverage}x)`,
      });
    }

    return actions;
  }

  /**
   * Find positions with large unrealized drawdowns
   */
  private static async findPositionsWithLargeDrawdowns(
    poolId: string,
    threshold: number // e.g., 0.2 = 20% loss
  ): Promise<PortfolioPosition[]> {
    const positions = await prisma.poolPosition.findMany({
      where: {
        poolId,
        closedAt: null, // Open positions only
      },
    });

    const lossyPositions: PortfolioPosition[] = [];

    for (const position of positions) {
      const unrealizedPnL = parseFloat(position.unrealizedPnL?.toString() || '0');
      const size = parseFloat(position.size?.toString() || '0');

      if (size > 0) {
        const lossPercentage = unrealizedPnL / size;

        if (lossPercentage < -threshold) {
          lossyPositions.push(position as unknown as PortfolioPosition);
        }
      }
    }

    return lossyPositions;
  }

  /**
   * Execute a rebalance action
   */
  static async executeRebalanceAction(
    npcUserId: string,
    poolId: string,
    action: RebalanceAction
  ): Promise<void> {
    logger.info(
      `Executing rebalance: ${action.type} for ${action.ticker || action.marketId}`,
      { npcUserId, poolId, action },
      'NPCInvestmentManager'
    );

    try {
      if (action.type === 'close' && action.positionId) {
        // Close position
        await prisma.poolPosition.update({
          where: { id: action.positionId },
          data: { closedAt: new Date() },
        });

        // Record the rebalance trade
        await prisma.nPCTrade.create({
          data: {
            id: await generateSnowflakeId(),
            npcActorId: npcUserId,
            poolId,
            marketType: action.marketType,
            ticker: action.ticker,
            marketId: action.marketId,
            action: 'close',
            side: action.side,
            amount: 0,
            price: 0,
            sentiment: 0,
            reason: action.reason,
          },
        });
      }
      // Add other action types (open, resize) as needed
    } catch (error) {
      logger.error('Error executing NPC action', { error, action });
      throw error;
    }
  }

  /**
   * Periodic portfolio monitoring for all active NPC pools
   */
  static async monitorAllNPCPortfolios(): Promise<void> {
    const activePools = await prisma.pool.findMany({
      where: { isActive: true },
      include: {
        Actor: {
          select: {
            id: true,
            name: true,
            personality: true,
          },
        },
      },
    });

    logger.info(`Monitoring ${activePools.length} active NPC portfolios`, undefined, 'NPCInvestmentManager');

    for (const pool of activePools) {
      if (!pool.Actor) continue;

      // Determine strategy from actor personality
      const strategy = this.determineStrategyFromPersonality(pool.Actor.personality);

      const actions = await this.monitorPortfolio(pool.id, pool.Actor.id, strategy);

      // Execute rebalance actions
      for (const action of actions) {
        await this.executeRebalanceAction(pool.Actor.id, pool.id, action);
      }
    }
  }

  /**
   * Determine investment strategy from actor personality
   */
  private static determineStrategyFromPersonality(
    personality: string | null
  ): 'aggressive' | 'conservative' | 'balanced' {
    if (!personality) return 'balanced';

    const personalityLower = personality.toLowerCase();

    const aggressiveKeywords = ['erratic', 'disaster', 'memecoin', 'degen'];
    const conservativeKeywords = ['vampire', 'yacht', 'philosopher'];

    if (aggressiveKeywords.some(kw => personalityLower.includes(kw))) {
      return 'aggressive';
    }

    if (conservativeKeywords.some(kw => personalityLower.includes(kw))) {
      return 'conservative';
    }

    return 'balanced';
  }

  /**
   * Calculate reputation-adjusted allocation amount for an NPC
   *
   * Reputation Score (0-100) adjusts allocation:
   * - Low reputation (0-40): 50% of base allocation (cautious)
   * - Medium reputation (40-70): 100% of base allocation (standard)
   * - High reputation (70-100): 150% of base allocation (confident)
   *
   * @param npcUserId - NPC user ID
   * @param baseAmount - Base allocation amount
   * @returns Adjusted allocation amount
   */
  static async calculateReputationAdjustedAllocation(
    npcUserId: string,
    baseAmount: number
  ): Promise<number> {
    // Get NPC's reputation breakdown
    const reputation = await getReputationBreakdown(npcUserId);

    if (!reputation) {
      logger.warn(
        `No reputation data for NPC ${npcUserId}, using base allocation`,
        { npcUserId, baseAmount },
        'NPCInvestmentManager'
      );
      return baseAmount;
    }

    const reputationScore = reputation.reputationScore;

    // Calculate multiplier based on reputation tiers
    let multiplier: number;

    if (reputationScore < 40) {
      // Low reputation: cautious allocation (50-75%)
      multiplier = 0.5 + (reputationScore / 40) * 0.25;
    } else if (reputationScore < 70) {
      // Medium reputation: standard allocation (75-100%)
      multiplier = 0.75 + ((reputationScore - 40) / 30) * 0.25;
    } else {
      // High reputation: confident allocation (100-150%)
      multiplier = 1.0 + ((reputationScore - 70) / 30) * 0.5;
    }

    const adjustedAmount = baseAmount * multiplier;

    logger.info(
      `Reputation-adjusted allocation: ${baseAmount} → ${adjustedAmount.toFixed(2)} (score: ${reputationScore}, multiplier: ${multiplier.toFixed(2)}x)`,
      {
        npcUserId,
        reputationScore,
        multiplier,
        baseAmount,
        adjustedAmount,
        trustLevel: reputation.trustLevel,
      },
      'NPCInvestmentManager'
    );

    return adjustedAmount;
  }

  /**
   * Get recommended position size based on portfolio metrics and reputation
   *
   * Combines portfolio utilization, risk score, and reputation to determine
   * optimal position size for new trades.
   *
   * @param poolId - Pool ID
   * @param npcUserId - NPC user ID
   * @param strategy - Investment strategy
   * @returns Recommended position size as percentage of available balance
   */
  static async getRecommendedPositionSize(
    poolId: string,
    npcUserId: string,
    strategy: 'aggressive' | 'conservative' | 'balanced'
  ): Promise<number> {
    // Get current portfolio metrics
    const metrics = await this.getPortfolioMetrics(poolId);

    // Get reputation breakdown
    const reputation = await getReputationBreakdown(npcUserId);

    // Base position sizes by strategy
    const basePositionSizes = {
      aggressive: 0.15, // 15% of available balance
      conservative: 0.05, // 5% of available balance
      balanced: 0.10, // 10% of available balance
    };

    let positionSize = basePositionSizes[strategy];

    // Adjust down if portfolio is already highly utilized
    if (metrics.utilization > 70) {
      positionSize *= 0.7; // Reduce by 30%
    }

    // Adjust down if portfolio risk is high
    if (metrics.riskScore > 0.6) {
      positionSize *= 0.8; // Reduce by 20%
    }

    // Adjust based on reputation (if available)
    if (reputation) {
      const reputationScore = reputation.reputationScore;

      if (reputationScore >= 70) {
        positionSize *= 1.2; // Increase by 20% for high reputation
      } else if (reputationScore < 40) {
        positionSize *= 0.8; // Reduce by 20% for low reputation
      }
    }

    // Clamp to reasonable range (2% to 25% of available balance)
    positionSize = Math.max(0.02, Math.min(0.25, positionSize));

    logger.info(
      `Recommended position size: ${(positionSize * 100).toFixed(1)}%`,
      {
        poolId,
        npcUserId,
        strategy,
        utilization: metrics.utilization,
        riskScore: metrics.riskScore,
        reputationScore: reputation?.reputationScore,
        positionSize,
      },
      'NPCInvestmentManager'
    );

    return positionSize;
  }
}
