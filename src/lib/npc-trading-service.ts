/**
 * NPC Trading Service
 * 
 * @deprecated This keyword-based trading system has been replaced by LLM-driven market decisions.
 * See: MarketDecisionEngine, TradeExecutionService, MarketContextService
 * 
 * The new system generates trading decisions using the LLM based on:
 * - Feed posts
 * - Group chat messages (insider info)
 * - Market conditions
 * - NPC personality and tier
 * 
 * This file is kept for reference but should not be used.
 */

import { prisma } from './prisma';
import { logger } from './logger';

interface MarketContext {
  perpMarkets: Array<{
    ticker: string;
    organizationId: string;
    currentPrice: number;
  }>;
  predictionMarkets: Array<{
    id: string;
    text: string;
    yesShares: number;
    noShares: number;
  }>;
}

interface TradingSignal {
  type: 'perp' | 'prediction';
  ticker?: string;
  marketId?: string;
  action: 'buy' | 'sell' | 'open_long' | 'open_short' | 'close';
  side?: 'YES' | 'NO' | 'long' | 'short';
  amount: number;
  confidence: number; // 0-1
  reason: string;
}

export class NPCTradingService {
  /**
   * Analyze a post and determine if NPC should trade
   */
  static async analyzePostAndTrade(
    postId: string,
    postContent: string,
    npcActorId: string,
    marketContext: MarketContext
  ): Promise<void> {
    const actor = await prisma.actor.findUnique({
      where: { id: npcActorId },
      include: {
        pools: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!actor) {
      logger.warn(`NPC actor not found: ${npcActorId}`);
      return;
    }

    const signals = this.extractTradingSignals(postContent, marketContext, {
      tier: actor.tier ?? undefined,
      personality: actor.personality ?? undefined,
    });
    if (signals.length === 0) return;

    for (const signal of signals) {
      await this.executePersonalTrade(actor, signal, postId);
      
      if (actor.pools.length > 0) {
        await this.executePoolTrade(actor, signal, postId, actor.pools[0]!.id);
      }
    }
  }

  /**
   * Extract trading signals from post content
   */
  private static extractTradingSignals(
    content: string,
    marketContext: MarketContext,
    actor: { tier?: string; personality?: string }
  ): TradingSignal[] {
    const signals: TradingSignal[] = [];
    const contentLower = content.toLowerCase();

    // Analyze for perpetual market signals
    for (const market of marketContext.perpMarkets) {
      const tickerPattern = new RegExp(`\\$${market.ticker}\\b`, 'i');
      const orgPattern = new RegExp(market.organizationId.replace(/-/g, '\\s*'), 'i');

      if (tickerPattern.test(content) || orgPattern.test(content)) {
        const sentiment = this.analyzeSentiment(content);
        
        // Determine trade action based on sentiment
        if (Math.abs(sentiment) > 0.3) {
          const isBullish = sentiment > 0;
          const confidence = Math.abs(sentiment);
          
          // Position size based on confidence and actor personality
          const baseAmount = this.getBaseTradeAmount(actor);
          const amount = baseAmount * confidence;

          signals.push({
            type: 'perp',
            ticker: market.ticker,
            action: isBullish ? 'open_long' : 'open_short',
            side: isBullish ? 'long' : 'short',
            amount,
            confidence,
            reason: this.extractReason(content, market.ticker),
          });
        }
      }
    }

    // Analyze for prediction market signals
    for (const market of marketContext.predictionMarkets) {
      // Check if post mentions this question
      const keywords = this.extractKeywords(market.text);
      const mentionsMarket = keywords.some(kw => contentLower.includes(kw.toLowerCase()));

      if (mentionsMarket) {
        const sentiment = this.analyzeSentiment(content);
        
        if (Math.abs(sentiment) > 0.2) {
          const isBullishOnYes = sentiment > 0;
          const confidence = Math.abs(sentiment);
          
          const baseAmount = this.getBaseTradeAmount(actor) * 0.5; // Smaller amounts for predictions
          const amount = baseAmount * confidence;

          signals.push({
            type: 'prediction',
            marketId: market.id,
            action: 'buy',
            side: isBullishOnYes ? 'YES' : 'NO',
            amount,
            confidence,
            reason: this.extractReason(content, market.text.slice(0, 50)),
          });
        }
      }
    }

    return signals;
  }

  /**
   * Analyze sentiment of text (-1 to 1)
   */
  private static analyzeSentiment(text: string): number {
    const textLower = text.toLowerCase();
    
    // Bullish indicators
    const bullishWords = [
      'bullish', 'moon', 'pump', 'buy', 'long', 'calls', 'going up', 'rally',
      'yes', 'definitely', 'absolutely', 'confirmed', 'winning', 'success',
      '🚀', '📈', '💎', 'lfg', 'wagmi', 'gm', '100x', 'gem'
    ];
    
    // Bearish indicators
    const bearishWords = [
      'bearish', 'dump', 'sell', 'short', 'puts', 'going down', 'crash',
      'no', 'never', 'impossible', 'disaster', 'fail', 'losing', 'rug',
      '📉', '💩', 'ngmi', 'rekt', 'fud', 'scam'
    ];

    let score = 0;
    
    // Count bullish words
    for (const word of bullishWords) {
      if (textLower.includes(word)) {
        score += 0.2;
      }
    }
    
    // Count bearish words
    for (const word of bearishWords) {
      if (textLower.includes(word)) {
        score -= 0.2;
      }
    }

    // Clamp between -1 and 1
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Get base trade amount based on actor tier and personality
   */
  private static getBaseTradeAmount(actor: { tier?: string; personality?: string }): number {
    const tierMultipliers: Record<string, number> = {
      'S_TIER': 500,
      'A_TIER': 300,
      'B_TIER': 200,
      'C_TIER': 100,
    };

    const baseAmount = tierMultipliers[actor.tier || 'B_TIER'] || 200;

    // Add personality modifiers
    const personalityMultipliers: Record<string, number> = {
      'erratic visionary': 1.5,
      'disaster profiteer': 2.0, // Cramer goes all in
      'memecoin cultist': 1.8,
      'nft degen': 1.6,
      'vampire capitalist': 0.7, // Calculated
      'yacht philosopher': 0.6, // Conservative
    };

    const personalityMult = actor.personality 
      ? (personalityMultipliers[actor.personality.toLowerCase()] || 1.0)
      : 1.0;

    return baseAmount * personalityMult;
  }

  /**
   * Execute a personal trade (simulated, just logging)
   */
  private static async executePersonalTrade(
    actor: { name: string },
    signal: TradingSignal,
    _postId: string
  ): Promise<void> {
    logger.info(`Personal NPC trade (simulated): ${actor.name} ${signal.action} ${signal.ticker || signal.marketId}`, {}, 'NPCTradingService');
  }

  /**
   * Execute a pool trade (actual position creation)
   */
  private static async executePoolTrade(
    actor: { id: string; name: string },
    signal: TradingSignal,
    postId: string,
    poolId: string
  ): Promise<void> {
    const balance = await this.getPoolBalance(poolId);
    if (balance < signal.amount) {
      logger.warn(`Insufficient pool balance for ${actor.name}: ${balance} < ${signal.amount}`);
      return;
    }

    const currentPrice = signal.type === 'perp' ? await this.getMarketPrice(signal.ticker!) : 50;

    if (signal.type === 'prediction' && signal.marketId) {
      await this.executePredictionTrade(signal.marketId, signal.side as 'YES' | 'NO', signal.amount, poolId);
    } else if (signal.type === 'perp' && signal.ticker) {
      await this.executePerpTrade(signal.ticker, signal.side as 'long' | 'short', signal.amount, poolId);
    }

    await prisma.nPCTrade.create({
      data: {
        npcActorId: actor.id,
        poolId,
        marketType: signal.type,
        ticker: signal.ticker,
        marketId: signal.marketId,
        action: signal.action,
        side: signal.side,
        amount: signal.amount,
        price: currentPrice,
        sentiment: signal.confidence * (signal.side === 'NO' || signal.side === 'short' ? -1 : 1),
        reason: signal.reason,
        postId,
      },
    });

    logger.info(`Pool trade executed: ${actor.name} ${signal.action} ${signal.ticker || signal.marketId}`);
  }

  /**
   * Execute a prediction market trade
   */
  private static async executePredictionTrade(
    marketId: string,
    side: 'YES' | 'NO',
    amount: number,
    poolId: string
  ): Promise<void> {
    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) throw new Error(`Pool not found: ${poolId}`);

    const availableBalance = parseFloat(pool.availableBalance.toString());
    if (availableBalance < amount) {
      throw new Error(`Insufficient pool balance: ${availableBalance} < ${amount}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.pool.update({
        where: { id: poolId },
        data: { availableBalance: { decrement: amount } },
      });

      await tx.poolPosition.create({
        data: {
          poolId,
          marketType: 'prediction',
          marketId,
          side,
          entryPrice: 50,
          currentPrice: 50,
          size: amount,
          shares: amount,
          unrealizedPnL: 0,
        },
      });
    });
  }

  /**
   * Execute a perpetual futures trade
   */
  private static async executePerpTrade(
    ticker: string,
    side: 'long' | 'short',
    amount: number,
    poolId: string
  ): Promise<void> {
    const pool = await prisma.pool.findUnique({ where: { id: poolId } });
    if (!pool) throw new Error(`Pool not found: ${poolId}`);

    const availableBalance = parseFloat(pool.availableBalance.toString());
    if (availableBalance < amount) {
      throw new Error(`Insufficient pool balance: ${availableBalance} < ${amount}`);
    }

    const currentPrice = await this.getMarketPrice(ticker);
    const leverage = 5;
    const positionSize = amount * leverage;
    const liquidationDistance = side === 'long' ? 0.8 : 1.2;
    const liquidationPrice = currentPrice * liquidationDistance;

    await prisma.$transaction(async (tx) => {
      await tx.pool.update({
        where: { id: poolId },
        data: { availableBalance: { decrement: amount } },
      });

      await tx.poolPosition.create({
        data: {
          poolId,
          marketType: 'perp',
          ticker,
          side,
          entryPrice: currentPrice,
          currentPrice,
          size: positionSize,
          leverage,
          liquidationPrice,
          unrealizedPnL: 0,
        },
      });
    });
  }

  /**
   * Get pool available balance
   */
  private static async getPoolBalance(poolId: string): Promise<number> {
    const pool = await prisma.pool.findUnique({
      where: { id: poolId },
      select: { availableBalance: true },
    });

    return pool ? parseFloat(pool.availableBalance.toString()) : 0;
  }

  /**
   * Get current market price for a ticker
   */
  private static async getMarketPrice(ticker: string): Promise<number> {
    const org = await prisma.organization.findFirst({
      where: {
        id: {
          contains: ticker.toLowerCase(),
        },
      },
      select: { currentPrice: true },
    });

    return org?.currentPrice || 100;
  }

  /**
   * Extract reason from post content
   */
  private static extractReason(content: string, context: string): string {
    // Truncate content to reasonable length
    const truncated = content.slice(0, 200);
    return `Post mentioning ${context}: "${truncated}${content.length > 200 ? '...' : ''}"`;
  }

  /**
   * Extract keywords from question text
   */
  private static extractKeywords(text: string): string[] {
    // Remove common words and extract important terms
    const commonWords = new Set([
      'will', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'would',
      'should', 'may', 'might', 'must', 'shall', 'to', 'of', 'in', 'on',
      'at', 'by', 'for', 'with', 'from', 'as', 'this', 'that'
    ]);

    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10); // Top 10 keywords
  }

  /**
   * Process all recent posts and execute NPC trades
   */
  static async processRecentPosts(marketContext: MarketContext): Promise<void> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentPosts = await prisma.post.findMany({
      where: { createdAt: { gte: oneHourAgo } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    logger.info(`Processing ${recentPosts.length} recent posts for NPC trading`);

    for (const post of recentPosts) {
      await this.analyzePostAndTrade(post.id, post.content, post.authorId, marketContext);
    }
  }
}

