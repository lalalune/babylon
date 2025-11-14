/**
 * Market Outcomes Tracker
 * 
 * Tracks market outcomes per time window for context-rich RULER judging.
 * This gives RULER the ground truth to evaluate agent decisions.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';

export interface WindowOutcomes {
  windowId: string;
  stocks: Array<{
    ticker: string;
    startPrice: number;
    endPrice: number;
    changePercent: number;
    sentiment?: string;
    news?: string[];
  }>;
  predictions: Array<{
    marketId: string;
    question: string;
    outcome: string;
    finalProbability: number;
  }>;
}

export class MarketOutcomesTracker {
  /**
   * Track outcomes for a specific window
   */
  async trackWindowOutcomes(windowId: string): Promise<void> {
    logger.info(`Tracking market outcomes for window: ${windowId}`);

    const windowStart = new Date(windowId);
    const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);

    // Get stock price movements from perpetual positions
    // (Approximate using PerpPosition data)
    const perpTrades = await prisma.perpPosition.findMany({
      where: {
        openedAt: {
          gte: windowStart,
          lte: windowEnd
        }
      },
      select: {
        ticker: true,
        entryPrice: true,
        currentPrice: true,
        closedAt: true
      }
    });

    // Group by ticker and calculate movements
    const stockMovements = new Map<string, { start: number; end: number; count: number }>();
    
    for (const trade of perpTrades) {
      if (!trade.ticker) continue;
      
      const existing = stockMovements.get(trade.ticker);
      if (!existing) {
        stockMovements.set(trade.ticker, {
          start: Number(trade.entryPrice),
          end: Number(trade.currentPrice),
          count: 1
        });
      } else {
        // Average the prices
        existing.end = Number(trade.currentPrice);
        existing.count++;
      }
    }

    // Save stock outcomes
    for (const [ticker, data] of stockMovements.entries()) {
      const changePercent = ((data.end - data.start) / data.start) * 100;
      
      await prisma.market_outcomes.create({
        data: {
          id: await generateSnowflakeId(),
          windowId,
          stockTicker: ticker,
          startPrice: data.start,
          endPrice: data.end,
          changePercent,
          sentiment: changePercent > 0 ? 'BULLISH' : 'BEARISH'
        }
      });
    }

    // Get prediction market resolutions
    const resolvedMarkets = await prisma.market.findMany({
      where: {
        resolved: true,
        updatedAt: {
          gte: windowStart,
          lte: windowEnd
        }
      },
      select: {
        id: true,
        question: true,
        resolution: true,
        yesShares: true,
        noShares: true
      }
    });

    // Save prediction outcomes
    for (const market of resolvedMarkets) {
      const totalShares = Number(market.yesShares) + Number(market.noShares);
      const finalProb = totalShares > 0 ? Number(market.yesShares) / totalShares : 0.5;

      await prisma.market_outcomes.create({
        data: {
          id: await generateSnowflakeId(),
          windowId,
          predictionMarketId: market.id,
          question: market.question,
          outcome: market.resolution ? 'YES' : 'NO',
          finalProbability: finalProb
        }
      });
    }

    logger.info(`Tracked outcomes for ${windowId}`, {
      stocks: stockMovements.size,
      predictions: resolvedMarkets.length
    });
  }

  /**
   * Sync outcomes for recent windows
   */
  async syncRecentWindows(hours: number = 24): Promise<number> {
    logger.info(`Syncing market outcomes for last ${hours} hours`);

    let synced = 0;
    const now = new Date();

    for (let i = 0; i < hours; i++) {
      const windowStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      // Round to hour
      const roundedHour = Math.floor(windowStart.getTime() / (60 * 60 * 1000)) * (60 * 60 * 1000);
      const windowId = new Date(roundedHour).toISOString().slice(0, 13) + ":00";

      // Check if already tracked
      const existing = await prisma.market_outcomes.findFirst({
        where: { windowId }
      });

      if (!existing) {
        try {
          await this.trackWindowOutcomes(windowId);
          synced++;
        } catch (error) {
          logger.error(`Failed to track outcomes for ${windowId}`, error);
        }
      }
    }

    logger.info(`Synced ${synced} windows`);
    return synced;
  }

  /**
   * Get outcomes for a window
   */
  async getWindowOutcomes(windowId: string): Promise<WindowOutcomes | null> {
    const outcomes = await prisma.market_outcomes.findMany({
      where: { windowId }
    });

    if (outcomes.length === 0) {
      return null;
    }

    const stocks = outcomes
      .filter(o => o.stockTicker)
      .map(o => ({
        ticker: o.stockTicker!,
        startPrice: Number(o.startPrice),
        endPrice: Number(o.endPrice),
        changePercent: Number(o.changePercent),
        sentiment: o.sentiment || undefined,
        news: o.newsEvents as string[] | undefined
      }));

    const predictions = outcomes
      .filter(o => o.predictionMarketId)
      .map(o => ({
        marketId: o.predictionMarketId!,
        question: o.question || '',
        outcome: o.outcome || 'UNRESOLVED',
        finalProbability: Number(o.finalProbability || 0)
      }));

    return {
      windowId,
      stocks,
      predictions
    };
  }
}

// NOTE: Test agent spawning code commented out - requires STRATEGIES and simulateAgent implementations
// See git history to restore when ready

