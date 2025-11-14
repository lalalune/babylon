/**
 * API Route: /api/markets/positions/[userId]
 * Methods: GET (get user's positions in both perps and prediction markets)
 */
import type { NextRequest } from 'next/server';

import { optionalAuth } from '@/lib/api/auth-middleware';
import { asPublic, asUser } from '@/lib/db/context';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import {
  UserIdParamSchema,
  UserPositionsQuerySchema,
} from '@/lib/validation/schemas';

/**
 * GET /api/markets/positions/[userId]
 * Get user's positions in perpetuals and prediction markets
 */
export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ userId: string }> }
  ) => {
    const { userId } = UserIdParamSchema.parse(await context.params);

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const queryParams = {
      userId,
      type: searchParams.get('type') || 'all',
      status: searchParams.get('status') || 'open',
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    };
    UserPositionsQuerySchema.parse(queryParams);

    // Optional auth - positions are public for leaderboard but RLS still applies
    const authUser = await optionalAuth(request).catch(() => null);

    // Get perpetual positions from database (respecting RLS if viewer is the same user)
    const perpPositions =
      authUser && authUser.userId
        ? await asUser(authUser, async (db) => {
            return await db.perpPosition.findMany({
              where: {
                userId,
                closedAt: null,
              },
            });
          })
        : await asPublic(async (db) => {
            return await db.perpPosition.findMany({
              where: {
                userId,
                closedAt: null,
              },
            });
          });

    // Get prediction market positions with RLS
    const predictionPositions =
      authUser && authUser.userId
        ? await asUser(authUser, async (db) => {
            return await db.position.findMany({
              where: {
                userId,
              },
              include: {
                Market: {
                  select: {
                    id: true,
                    question: true,
                    endDate: true,
                    resolved: true,
                    resolution: true,
                    yesShares: true,
                    noShares: true,
                  },
                },
              },
            });
          })
        : await asPublic(async (db) => {
            return await db.position.findMany({
              where: {
                userId,
              },
              include: {
                Market: {
                  select: {
                    id: true,
                    question: true,
                    endDate: true,
                    resolved: true,
                    resolution: true,
                    yesShares: true,
                    noShares: true,
                  },
                },
              },
            });
          });

    // Calculate stats
    const perpStats = {
      totalPositions: perpPositions.length,
      totalPnL: perpPositions.reduce(
        (sum: number, p: typeof perpPositions[number]) => sum + Number(p.unrealizedPnL),
        0
      ),
      totalFunding: perpPositions.reduce(
        (sum: number, p: typeof perpPositions[number]) => sum + Number(p.fundingPaid),
        0
      ),
    };

    logger.info(
      'User positions fetched successfully',
      {
        userId,
        perpPositions: perpStats.totalPositions,
        predictionPositions: predictionPositions.length,
      },
      'GET /api/markets/positions/[userId]'
    );

    return successResponse({
      perpetuals: {
        positions: perpPositions.map((p: typeof perpPositions[number]) => ({
          id: p.id,
          ticker: p.ticker,
          side: p.side as 'long' | 'short',
          entryPrice: Number(p.entryPrice),
          currentPrice: Number(p.currentPrice),
          size: Number(p.size),
          leverage: Number(p.leverage),
          unrealizedPnL: Number(p.unrealizedPnL),
          unrealizedPnLPercent: Number(p.unrealizedPnLPercent),
          liquidationPrice: Number(p.liquidationPrice),
          fundingPaid: Number(p.fundingPaid),
          openedAt: p.openedAt.toISOString(),
        })),
        stats: perpStats,
      },
      predictions: {
        positions: predictionPositions.map((p: typeof predictionPositions[number]) => {
          const yesShares = Number(p.Market.yesShares);
          const noShares = Number(p.Market.noShares);
          const totalShares = yesShares + noShares;
          const fallbackPrice = 0.5;
          const yesPrice =
            totalShares > 0 ? yesShares / totalShares : fallbackPrice;
          const noPrice =
            totalShares > 0 ? noShares / totalShares : fallbackPrice;
          const shares = Number(p.shares);
          const avgPrice = Number(p.avgPrice);
          const currentPrice = p.side ? yesPrice : noPrice;
          const costBasis = shares * avgPrice;
          const currentValue = shares * currentPrice;
          const unrealizedPnL = currentValue - costBasis;

          return {
            id: p.id,
            marketId: p.marketId,
            question: p.Market.question,
            side: p.side ? 'YES' : 'NO',
            shares,
            avgPrice,
            currentPrice,
            currentValue,
            costBasis,
            unrealizedPnL,
            resolved: p.Market.resolved,
            resolution: p.Market.resolution,
          };
        }),
        stats: {
          totalPositions: predictionPositions.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  }
);
