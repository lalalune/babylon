/**
 * Prediction Markets API
 *
 * GET /api/markets/predictions - Get active prediction questions
 * Query params: ?userId=xxx - Include user positions if authenticated
 */

import type { NextRequest } from 'next/server';
import { db } from '@/lib/database-service';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { MarketQuerySchema, UserIdParamSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';

/**
 * GET /api/markets/predictions
 * Get active prediction questions with optional user positions
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const questions = await db.getActiveQuestions();
  const searchParams = request.nextUrl.searchParams;
  
  // Build query params object, filtering out null values
  const queryParams: Record<string, string | number> = {};
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const minLiquidity = searchParams.get('minLiquidity');
  const maxLiquidity = searchParams.get('maxLiquidity');
  const search = searchParams.get('search');
  const page = searchParams.get('page');
  const limit = searchParams.get('limit');
  
  if (status) queryParams.status = status;
  if (category) queryParams.category = category;
  if (minLiquidity) queryParams.minLiquidity = minLiquidity;
  if (maxLiquidity) queryParams.maxLiquidity = maxLiquidity;
  if (search) queryParams.search = search;
  if (page) queryParams.page = page;
  if (limit) queryParams.limit = limit;
  
  // Validate only if there are params to validate
  if (Object.keys(queryParams).length > 0) {
    MarketQuerySchema.partial().parse(queryParams);
  }
  
  const userIdParam = searchParams.get('userId');
  const userId = userIdParam ? UserIdParamSchema.parse({ userId: userIdParam }).userId : undefined;

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
          market: true,
        },
      });

      // Create map of marketId -> position data
      positions.forEach(p => {
        const market = p.market;
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
            market: true,
          },
        });

        // Create map of marketId -> position data
        positions.forEach(p => {
          const market = p.market;
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
