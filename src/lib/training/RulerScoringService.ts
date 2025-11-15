/**
 * RULER Scoring Service
 * 
 * Evaluates agent trajectories using the RULER (Reward Understanding via Learning and Evaluation) framework.
 * Provides comprehensive scoring based on:
 * - Trading performance (P&L, win rate, risk-adjusted returns)
 * - Social engagement (post quality, comment engagement)
 * - Strategic decision-making (timing, market selection)
 * - Long-term value creation
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { TrajectoryStep } from './types';

export interface RulerScore {
  trajectoryId: string;
  overallScore: number; // 0-1 normalized score
  tradingScore: number; // 0-1
  socialScore: number; // 0-1
  strategicScore: number; // 0-1
  components: {
    pnlScore: number;
    winRate: number;
    riskAdjustedReturn: number;
    engagementScore: number;
    timingScore: number;
    marketSelectionScore: number;
  };
  reasoning: string;
  scoredAt: Date;
}

interface MarketOutcomes {
  stocks: Array<{ ticker: string; changePercent: number }>;
  predictions: Array<{ marketId: string; outcome: string }>;
}

export class RulerScoringService {

  /**
   * Score a single trajectory using RULER framework
   */
  async scoreTrajectory(trajectoryId: string): Promise<RulerScore | null> {
    const trajectory = await prisma.trajectory.findUnique({
      where: { trajectoryId },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    });

    if (!trajectory) {
      logger.warn('Trajectory not found for scoring', { trajectoryId });
      return null;
    }

    const steps: TrajectoryStep[] = JSON.parse(trajectory.stepsJson);
    const windowId = trajectory.windowId;

    // Get market outcomes for this window
    const outcomes = windowId 
      ? await this.getWindowOutcomes(windowId)
      : null;

    // Score components
    const tradingScore = this.scoreTradingPerformance(steps, outcomes);
    const socialScore = this.scoreSocialEngagement(steps);
    const strategicScore = this.scoreStrategicDecisions(steps, outcomes);

    // Calculate overall score (weighted average)
    const overallScore = (
      tradingScore.overall * 0.5 +  // Trading is most important
      socialScore * 0.2 +            // Social engagement
      strategicScore.overall * 0.3   // Strategic decisions
    );

    const score: RulerScore = {
      trajectoryId,
      overallScore: Math.max(0, Math.min(1, overallScore)), // Normalize to 0-1
      tradingScore: tradingScore.overall,
      socialScore,
      strategicScore: strategicScore.overall,
      components: {
        pnlScore: tradingScore.pnlScore,
        winRate: tradingScore.winRate,
        riskAdjustedReturn: tradingScore.riskAdjustedReturn,
        engagementScore: socialScore,
        timingScore: strategicScore.timingScore,
        marketSelectionScore: strategicScore.marketSelectionScore
      },
      reasoning: this.generateReasoning(tradingScore, socialScore, strategicScore),
      scoredAt: new Date()
    };

    // Save score to database
    await prisma.trajectory.update({
      where: { trajectoryId },
      data: {
        aiJudgeReward: overallScore,
        aiJudgeReasoning: score.reasoning
      }
    });

    logger.info('Trajectory scored with RULER', {
      trajectoryId,
      overallScore,
      tradingScore: tradingScore.overall,
      socialScore,
      strategicScore: strategicScore.overall
    });

    return score;
  }

  /**
   * Score trading performance
   */
  private scoreTradingPerformance(
    steps: TrajectoryStep[],
    outcomes: { stocks: Array<{ ticker: string; changePercent: number }>; predictions: Array<{ marketId: string; outcome: string }> } | null
  ): {
    overall: number;
    pnlScore: number;
    winRate: number;
    riskAdjustedReturn: number;
  } {
    const tradingSteps = steps.filter(s => 
      s.action.actionType.includes('TRADING') || 
      s.action.actionType.includes('BUY') || 
      s.action.actionType.includes('SELL')
    );

    if (tradingSteps.length === 0) {
      return { overall: 0.5, pnlScore: 0.5, winRate: 0.5, riskAdjustedReturn: 0.5 }; // Neutral score for no trades
    }

    // Calculate P&L score from step rewards
    const totalReward = steps.reduce((sum, s) => sum + s.reward, 0);
    const pnlScore = Math.max(0, Math.min(1, (totalReward + 1) / 2)); // Normalize from -1 to 1 range to 0-1

    // Calculate win rate from outcomes
    let wins = 0;
    let totalTrades = 0;

    if (outcomes) {
      for (const step of tradingSteps) {
        const marketId = step.action.parameters?.marketId as string | undefined;
        const ticker = step.action.parameters?.ticker as string | undefined;
        const side = step.action.parameters?.side as string | undefined;

        if (marketId && outcomes.predictions) {
          const prediction = outcomes.predictions.find(p => p.marketId === marketId);
          if (prediction && side) {
            totalTrades++;
            const isCorrect = (
              (side === 'YES' && prediction.outcome === 'YES') ||
              (side === 'NO' && prediction.outcome === 'NO')
            );
            if (isCorrect) wins++;
          }
        } else if (ticker && outcomes.stocks) {
          const stock = outcomes.stocks.find(s => s.ticker === ticker);
          if (stock && side) {
            totalTrades++;
            const priceChange = stock.changePercent;
            const isCorrect = (
              (side === 'long' && priceChange > 0) ||
              (side === 'short' && priceChange < 0)
            );
            if (isCorrect) wins++;
          }
        }
      }
    }

    const winRate = totalTrades > 0 ? wins / totalTrades : 0.5;

    // Risk-adjusted return (simplified: reward per trade)
    const avgRewardPerTrade = tradingSteps.length > 0 
      ? totalReward / tradingSteps.length 
      : 0;
    const riskAdjustedReturn = Math.max(0, Math.min(1, (avgRewardPerTrade + 1) / 2));

    // Overall trading score (weighted combination)
    const overall = (
      pnlScore * 0.4 +
      winRate * 0.4 +
      riskAdjustedReturn * 0.2
    );

    return { overall, pnlScore, winRate, riskAdjustedReturn };
  }

  /**
   * Score social engagement
   */
  private scoreSocialEngagement(steps: TrajectoryStep[]): number {
    const socialSteps = steps.filter(s => 
      s.action.actionType.includes('POST') || 
      s.action.actionType.includes('COMMENT')
    );

    if (socialSteps.length === 0) {
      return 0.5; // Neutral score for no social activity
    }

    // Score based on action success and frequency
    const successfulActions = socialSteps.filter(s => s.action.success).length;
    const successRate = socialSteps.length > 0 ? successfulActions / socialSteps.length : 0;

    // Reward consistent engagement
    const engagementFrequency = Math.min(1, socialSteps.length / 10); // Normalize to 0-1

    return (successRate * 0.7 + engagementFrequency * 0.3);
  }

  /**
   * Score strategic decisions
   */
  private scoreStrategicDecisions(
    steps: TrajectoryStep[],
    outcomes: { stocks: Array<{ ticker: string; changePercent: number }>; predictions: Array<{ marketId: string; outcome: string }> } | null
  ): {
    overall: number;
    timingScore: number;
    marketSelectionScore: number;
  } {
    const tradingSteps = steps.filter(s => 
      s.action.actionType.includes('TRADING') || 
      s.action.actionType.includes('BUY') || 
      s.action.actionType.includes('SELL')
    );

    if (tradingSteps.length === 0) {
      return { overall: 0.5, timingScore: 0.5, marketSelectionScore: 0.5 };
    }

    // Timing score: how well did the agent time their trades?
    // Simplified: based on whether trades were profitable
    const profitableTrades = tradingSteps.filter(s => s.reward > 0).length;
    const timingScore = tradingSteps.length > 0 
      ? profitableTrades / tradingSteps.length 
      : 0.5;

    // Market selection score: did the agent choose good markets?
    let marketSelectionScore = 0.5;
    if (outcomes) {
      let goodSelections = 0;
      let totalSelections = 0;

      for (const step of tradingSteps) {
        const marketId = step.action.parameters?.marketId as string | undefined;
        const ticker = step.action.parameters?.ticker as string | undefined;

        if (marketId && outcomes.predictions) {
          const prediction = outcomes.predictions.find(p => p.marketId === marketId);
          if (prediction) {
            totalSelections++;
            // Good selection if market resolved (shows active market)
            if (prediction.outcome !== 'UNRESOLVED') {
              goodSelections++;
            }
          }
        } else if (ticker && outcomes.stocks) {
          const stock = outcomes.stocks.find(s => s.ticker === ticker);
          if (stock) {
            totalSelections++;
            // Good selection if there was price movement (shows active market)
            if (Math.abs(stock.changePercent) > 1) {
              goodSelections++;
            }
          }
        }
      }

      marketSelectionScore = totalSelections > 0 
        ? goodSelections / totalSelections 
        : 0.5;
    }

    const overall = (timingScore * 0.6 + marketSelectionScore * 0.4);

    return { overall, timingScore, marketSelectionScore };
  }

  /**
   * Generate human-readable reasoning for the score
   */
  private generateReasoning(
    tradingScore: { overall: number; pnlScore: number; winRate: number; riskAdjustedReturn: number },
    socialScore: number,
    strategicScore: { overall: number; timingScore: number; marketSelectionScore: number }
  ): string {
    const parts: string[] = [];

    if (tradingScore.overall > 0.7) {
      parts.push(`Strong trading performance (${Math.round(tradingScore.winRate * 100)}% win rate)`);
    } else if (tradingScore.overall < 0.3) {
      parts.push(`Weak trading performance (${Math.round(tradingScore.winRate * 100)}% win rate)`);
    } else {
      parts.push(`Moderate trading performance (${Math.round(tradingScore.winRate * 100)}% win rate)`);
    }

    if (socialScore > 0.7) {
      parts.push('High social engagement');
    } else if (socialScore < 0.3) {
      parts.push('Low social engagement');
    }

    if (strategicScore.overall > 0.7) {
      parts.push('Good strategic decision-making');
    } else if (strategicScore.overall < 0.3) {
      parts.push('Poor strategic decision-making');
    }

    return parts.join('. ') || 'Baseline performance';
  }

  /**
   * Get market outcomes for a window
   */
  private async getWindowOutcomes(windowId: string): Promise<MarketOutcomes | null> {
    try {
      // Parse window ID to get time range
      const windowDate = new Date(windowId);
      const windowEnd = new Date(windowDate.getTime() + 60 * 60 * 1000); // 1 hour window

      // Get resolved prediction markets in this window
      const resolvedMarkets = await prisma.market.findMany({
        where: {
          resolved: true,
          updatedAt: {
            gte: windowDate,
            lt: windowEnd
          }
        },
        select: {
          id: true,
          resolution: true
        }
      });

      // Get stock price changes in this window
      // For now, return empty array - can be enhanced to track actual price changes
      const stocks: Array<{ ticker: string; changePercent: number }> = [];

      return {
        stocks,
        predictions: resolvedMarkets.map(m => ({
          marketId: m.id,
          outcome: m.resolution === true ? 'YES' : m.resolution === false ? 'NO' : 'UNRESOLVED'
        }))
      };
    } catch (error) {
      logger.warn('Failed to get window outcomes', { windowId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Score multiple trajectories in batch
   */
  async scoreTrajectories(trajectoryIds: string[]): Promise<RulerScore[]> {
    const scores: RulerScore[] = [];

    for (const trajectoryId of trajectoryIds) {
      try {
        const score = await this.scoreTrajectory(trajectoryId);
        if (score) {
          scores.push(score);
        }
      } catch (error) {
        logger.error('Failed to score trajectory', {
          trajectoryId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return scores;
  }

  /**
   * Score all unscored trajectories in a window
   */
  async scoreWindow(windowId: string): Promise<number> {
    const trajectories = await prisma.trajectory.findMany({
      where: {
        windowId,
        isTrainingData: true,
        aiJudgeReward: null // Only score unscored trajectories
      },
      select: {
        trajectoryId: true
      }
    });

    if (trajectories.length === 0) {
      return 0;
    }

    const scores = await this.scoreTrajectories(
      trajectories.map(t => t.trajectoryId)
    );

    logger.info('Scored trajectories in window', {
      windowId,
      scored: scores.length,
      total: trajectories.length
    });

    return scores.length;
  }
}

export const rulerScoringService = new RulerScoringService();

