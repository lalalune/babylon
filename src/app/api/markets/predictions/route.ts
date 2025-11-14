/**
 * Prediction Markets API
 * 
 * @route GET /api/markets/predictions
 * @access Public (enhanced with authentication)
 * 
 * @description
 * Retrieves active prediction markets with real-time pricing, share counts,
 * and optional user position data. Implements automated market maker (AMM)
 * pricing model with yes/no binary outcomes. Supports both anonymous and
 * authenticated access with position tracking.
 * 
 * **Market Data Includes:**
 * - **Question Details:** text, status, creation/resolution dates, outcomes
 * - **Market Pricing:** yes/no share counts, implied probabilities
 * - **User Positions:** shares owned, entry price, current value, unrealized P&L
 * - **Scenario Context:** associated scenario/event ID
 * 
 * **Pricing Model:**
 * Markets use an Automated Market Maker (AMM) where:
 * - Price = shares / totalShares
 * - Yes Price = yesShares / (yesShares + noShares)
 * - No Price = noShares / (yesShares + noShares)
 * - Prices represent implied probability (0.0 to 1.0)
 * 
 * **Market States:**
 * - `active` - Open for trading
 * - `resolved` - Outcome determined
 * - `cancelled` - Market cancelled/invalid
 * 
 * **User Position Metrics:**
 * When `userId` provided and user has positions:
 * - `shares` - Number of shares owned
 * - `avgPrice` - Average entry price
 * - `currentPrice` - Current market price
 * - `currentValue` - Current position value
 * - `costBasis` - Total cost of position
 * - `unrealizedPnL` - Unrealized profit/loss
 * 
 * **Row Level Security (RLS):**
 * Uses context-aware database access:
 * - Authenticated users: `asUser()` with user context
 * - Unauthenticated: `asPublic()` with read-only access
 * 
 * **GET /api/markets/predictions - Get Prediction Markets**
 * 
 * @query {string} [userId] - User ID to include position data
 * 
 * @returns {object} Prediction markets response
 * @property {boolean} success - Operation success status
 * @property {array} questions - Array of prediction market objects
 * @property {number} count - Total markets count
 * 
 * **Question Object Fields:**
 * @property {string} id - Question/market ID
 * @property {number} questionNumber - Sequential question number
 * @property {string} text - Question text
 * @property {string} status - Market status
 * @property {string} createdDate - Creation timestamp
 * @property {string} resolutionDate - Resolution deadline
 * @property {string} [resolvedOutcome] - Outcome if resolved
 * @property {string} scenario - Associated scenario ID
 * @property {number} yesShares - Yes shares in market
 * @property {number} noShares - No shares in market
 * @property {object} [userPosition] - User position (if userId provided)
 * 
 * @throws {400} Bad Request - Invalid query parameters
 * @throws {500} Internal Server Error
 * 
 * @example
 * ```typescript
 * // Get all active markets (public)
 * const markets = await fetch('/api/markets/predictions')
 *   .then(r => r.json());
 * 
 * markets.questions.forEach(q => {
 *   const yesPrice = q.yesShares / (q.yesShares + q.noShares);
 *   const noPrice = q.noShares / (q.yesShares + q.noShares);
 *   console.log(`${q.text}: YES ${(yesPrice * 100).toFixed(1)}%`);
 * });
 * 
 * // Get markets with user positions
 * const userMarkets = await fetch(`/api/markets/predictions?userId=${userId}`, {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * }).then(r => r.json());
 * 
 * userMarkets.questions.forEach(q => {
 *   if (q.userPosition) {
 *     const { shares, avgPrice, currentPrice, unrealizedPnL } = q.userPosition;
 *     console.log(`Position: ${shares} @ $${avgPrice}, P&L: $${unrealizedPnL}`);
 *   }
 * });
 * ```
 * 
 * @see {@link /lib/database-service} Database query layer
 * @see {@link /lib/db/context} RLS context management
 * @see {@link /api/markets/predictions/[id]/buy} Buy shares endpoint
 * @see {@link /api/markets/predictions/[id]/sell} Sell shares endpoint
 * @see {@link /src/app/markets/page.tsx} Markets UI
 */

import type { NextRequest } from 'next/server';
import { db } from '@/lib/database-service';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { MarketQuerySchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { z } from 'zod';

/**
 * GET /api/markets/predictions
 * Get active prediction questions with optional user positions
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const questions = await db.getActiveQuestions();
  const { searchParams } = new URL(request.url);

  const queryParse = MarketQuerySchema.merge(z.object({ userId: z.string().optional() })).partial().safeParse(Object.fromEntries(searchParams));

  if (!queryParse.success) {
    return successResponse({ error: 'Invalid query parameters', details: queryParse.error.flatten() }, 400);
  }

  const { userId } = queryParse.data;

  // Optional auth
  const authUser = await optionalAuth(request).catch(() => null);

  // Get markets and user positions with RLS
  const { markets, userPositionsMap } = (authUser && authUser.userId)
    ? await asUser(authUser, async (dbPrisma) => {
    // Get all markets to check if they exist and get share counts
    const marketIds = questions.map(q => String(q.id));
    const marketsList = await dbPrisma.market.findMany({
      where: {
        id: { in: marketIds },
      },
    });
    const marketMap = new Map(marketsList.map(m => [m.id, m]));

    // Get user positions if userId provided
    const positionsMap = new Map();
    if (userId) {
      const positions = await dbPrisma.position.findMany({
        where: {
          userId: userId,
          marketId: { in: marketIds },
        },
        include: {
          Market: true,
        },
      });

      // Create map of marketId -> position data
      positions.forEach(p => {
        const market = p.Market;
        const totalShares = Number(market.yesShares) + Number(market.noShares);
        const currentYesPrice = totalShares > 0 ? Number(market.yesShares) / totalShares : 0.5;
        const currentNoPrice = totalShares > 0 ? Number(market.noShares) / totalShares : 0.5;

        positionsMap.set(p.marketId, {
          id: p.id,
          side: p.side ? 'YES' : 'NO',
          shares: Number(p.shares),
          avgPrice: Number(p.avgPrice),
          currentPrice: p.side ? currentYesPrice : currentNoPrice,
          currentValue: Number(p.shares) * (p.side ? currentYesPrice : currentNoPrice),
          costBasis: Number(p.shares) * Number(p.avgPrice),
          unrealizedPnL: (Number(p.shares) * (p.side ? currentYesPrice : currentNoPrice)) - (Number(p.shares) * Number(p.avgPrice)),
        });
      });
    }

    return { markets: marketMap, userPositionsMap: positionsMap };
  })
    : await asPublic(async (dbPrisma) => {
      // Get all markets to check if they exist and get share counts
      const marketIds = questions.map(q => String(q.id));
      const marketsList = await dbPrisma.market.findMany({
        where: {
          id: { in: marketIds },
        },
      });
      const marketMap = new Map(marketsList.map(m => [m.id, m]));

      // Get user positions if userId provided
      const positionsMap = new Map();
      if (userId) {
        const positions = await dbPrisma.position.findMany({
          where: {
            userId: userId,
            marketId: { in: marketIds },
          },
          include: {
            Market: true,
          },
        });

        // Create map of marketId -> position data
        positions.forEach(p => {
          const market = p.Market;
          const totalShares = Number(market.yesShares) + Number(market.noShares);
          const currentYesPrice = totalShares > 0 ? Number(market.yesShares) / totalShares : 0.5;
          const currentNoPrice = totalShares > 0 ? Number(market.noShares) / totalShares : 0.5;

          positionsMap.set(p.marketId, {
            id: p.id,
            side: p.side ? 'YES' : 'NO',
            shares: Number(p.shares),
            avgPrice: Number(p.avgPrice),
            currentPrice: p.side ? currentYesPrice : currentNoPrice,
            currentValue: Number(p.shares) * (p.side ? currentYesPrice : currentNoPrice),
            costBasis: Number(p.shares) * Number(p.avgPrice),
            unrealizedPnL: (Number(p.shares) * (p.side ? currentYesPrice : currentNoPrice)) - (Number(p.shares) * Number(p.avgPrice)),
          });
        });
      }

      return { markets: marketMap, userPositionsMap: positionsMap };
    });

  const questionsData = questions.map(q => {
    const marketId = String(q.id);
    const market = markets.get(marketId);
    const userPosition = userPositionsMap.get(marketId);

    return {
      id: q.id, // Use actual question ID (string), not questionNumber
      questionNumber: q.questionNumber, // Also include questionNumber for reference
      text: q.text,
      status: q.status,
      createdDate: q.createdDate,
      resolutionDate: q.resolutionDate,
      resolvedOutcome: q.resolvedOutcome,
      scenario: q.scenarioId,
      yesShares: market ? Number(market.yesShares) : 0,
      noShares: market ? Number(market.noShares) : 0,
      // Include user position if exists
      userPosition: userPosition || null,
    };
  });

  logger.info('Prediction markets fetched successfully', { count: questionsData.length, hasUserId: !!userId }, 'GET /api/markets/predictions');

  return successResponse({
    success: true,
    questions: questionsData,
    count: questionsData.length,
  });
});
