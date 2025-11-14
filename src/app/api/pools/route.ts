/**
 * API Route: /api/pools
 * Methods: GET (list all active pools with performance metrics)
 */

import type { NextRequest } from 'next/server';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { PoolQuerySchema, PaginationSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { cachedDb } from '@/lib/cached-database-service';

/**
 * GET /api/pools
 * List all active pools with their performance metrics
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    isActive: searchParams.get('isActive') || undefined,
    npcActorId: searchParams.get('npcActorId') || undefined,
    minValue: searchParams.get('minValue') || undefined,
    maxValue: searchParams.get('maxValue') || undefined,
    sortBy: searchParams.get('sortBy') || undefined,
    search: searchParams.get('search') || undefined,
    page: searchParams.get('page') || undefined,
    limit: searchParams.get('limit') || undefined
  };
  // Validate query parameters
  PoolQuerySchema.merge(PaginationSchema).partial().parse(queryParams);
  
  // Optional auth - pools are public but RLS still applies
  const authUser = await optionalAuth(request).catch(() => null);
  
  // Get pools with caching (for unauthenticated) or RLS (for authenticated)
  const pools = (authUser && authUser.userId)
    ? await asUser(authUser, async (db) => {
    // Authenticated users: use RLS, no caching (user-specific)
    return await db.pool.findMany({
      where: {
        isActive: true,
      },
      include: {
        npcActor: {
          select: {
            id: true,
            name: true,
            description: true,
            tier: true,
            personality: true,
          },
        },
        deposits: {
          where: {
            withdrawnAt: null,
          },
          select: {
            amount: true,
            currentValue: true,
          },
        },
        positions: {
          where: {
            closedAt: null,
          },
          select: {
            marketType: true,
            ticker: true,
            marketId: true,
            side: true,
            size: true,
            unrealizedPnL: true,
          },
        },
        _count: {
          select: {
            deposits: {
              where: {
                withdrawnAt: null,
              },
            },
            trades: true,
          },
        },
      },
      orderBy: [
        { totalValue: 'desc' },
      ],
    })
  })
    : await asPublic(async (db) => {
      // Unauthenticated: use cached data
      logger.info('Fetching pools (cached)', undefined, 'GET /api/pools');
      return await cachedDb.getActivePools().catch(() =>
        // Fallback to direct query if cache fails
        db.pool.findMany({
      where: {
        isActive: true,
      },
      include: {
        npcActor: {
          select: {
            id: true,
            name: true,
            description: true,
            tier: true,
            personality: true,
          },
        },
        deposits: {
          where: {
            withdrawnAt: null,
          },
          select: {
            amount: true,
            currentValue: true,
          },
        },
        positions: {
          where: {
            closedAt: null,
          },
          select: {
            marketType: true,
            ticker: true,
            marketId: true,
            side: true,
            size: true,
            unrealizedPnL: true,
          },
        },
        _count: {
          select: {
            deposits: {
              where: {
                withdrawnAt: null,
              },
            },
            trades: true,
          },
        },
      },
      orderBy: [
        { totalValue: 'desc' },
      ],
    }))
  });

  // Calculate metrics for each pool
  const poolsWithMetrics = pools.map((pool) => {
    const totalDeposits = parseFloat(pool.totalDeposits.toString());
    const totalValue = parseFloat(pool.totalValue.toString());
    const lifetimePnL = parseFloat(pool.lifetimePnL.toString());
    const availableBalance = parseFloat(pool.availableBalance.toString());

    // Calculate total unrealized P&L across all positions
    const totalUnrealizedPnL = pool.positions.reduce(
      (sum, pos) => sum + pos.unrealizedPnL,
      0
    );

    // Calculate returns
    const totalReturn = totalDeposits > 0 ? ((totalValue - totalDeposits) / totalDeposits) * 100 : 0;

    // Calculate active deposits value
    const activeDepositsValue = pool.deposits.reduce(
      (sum, dep) => sum + parseFloat(dep.currentValue.toString()),
      0
    );

    // Handle dates that might be strings (from cache) or Date objects (from DB)
    const openedAt = typeof pool.openedAt === 'string' ? pool.openedAt : pool.openedAt.toISOString();
    const updatedAt = typeof pool.updatedAt === 'string' ? pool.updatedAt : pool.updatedAt.toISOString();

    return {
      id: pool.id,
      name: pool.name,
      description: pool.description,
      npcActor: pool.npcActor,
      totalValue,
      totalDeposits,
      availableBalance,
      lifetimePnL,
      totalReturn,
      performanceFeeRate: pool.performanceFeeRate,
      totalFeesCollected: parseFloat(pool.totalFeesCollected.toString()),
      activeInvestors: pool._count.deposits,
      totalTrades: pool._count.trades,
      openPositions: pool.positions.length,
      totalUnrealizedPnL,
      activeDepositsValue,
      openedAt,
      updatedAt,
    };
  });

  logger.info('Pools fetched successfully', { total: poolsWithMetrics.length }, 'GET /api/pools');

  return successResponse({
    pools: poolsWithMetrics,
    total: poolsWithMetrics.length,
  });
});
