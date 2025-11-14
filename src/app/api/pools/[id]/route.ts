import type { NextRequest } from 'next/server';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { NotFoundError } from '@/lib/errors';
import { IdParamSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';

/**
 * GET /api/pools/[id]
 * Get detailed information about a specific pool
 */
export const GET = withErrorHandling(async (
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { id } = IdParamSchema.parse(await context.params);

  // Optional auth - pools are public but RLS still applies
  const authUser = await optionalAuth(_request).catch(() => null);

  // Get pool details with RLS
  const pool = (authUser && authUser.userId)
    ? await asUser(authUser, async (db) => {
    return await db.pool.findUnique({
      where: { id },
      include: {
        npcActor: {
          select: {
            id: true,
            name: true,
            description: true,
            tier: true,
            personality: true,
            domain: true,
            postStyle: true,
          },
        },
        deposits: {
          where: {
            withdrawnAt: null,
          },
          orderBy: {
            depositedAt: 'desc',
          },
        },
        positions: {
          where: {
            closedAt: null,
          },
          orderBy: {
            openedAt: 'desc',
          },
        },
        trades: {
          orderBy: {
            executedAt: 'desc',
          },
          take: 50, // Last 50 trades
        },
      },
    })
  })
    : await asPublic(async (db) => {
      return await db.pool.findUnique({
      where: { id },
      include: {
        npcActor: {
          select: {
            id: true,
            name: true,
            description: true,
            tier: true,
            personality: true,
            domain: true,
            postStyle: true,
          },
        },
        deposits: {
          where: {
            withdrawnAt: null,
          },
          orderBy: {
            depositedAt: 'desc',
          },
        },
        positions: {
          where: {
            closedAt: null,
          },
          orderBy: {
            openedAt: 'desc',
          },
        },
        trades: {
          orderBy: {
            executedAt: 'desc',
          },
          take: 50, // Last 50 trades
        },
      },
    })
  });

  if (!pool) {
    throw new NotFoundError('Pool', id);
  }

    // Calculate metrics
    const totalDeposits = parseFloat(pool.totalDeposits.toString());
    const totalValue = parseFloat(pool.totalValue.toString());
    const lifetimePnL = parseFloat(pool.lifetimePnL.toString());
    const availableBalance = parseFloat(pool.availableBalance.toString());
    
    const totalUnrealizedPnL = pool.positions.reduce(
      (sum, pos) => sum + pos.unrealizedPnL,
      0
    );

    const totalReturn = totalDeposits > 0 ? ((totalValue - totalDeposits) / totalDeposits) * 100 : 0;

    // Calculate position breakdown
    const positionsByType = {
      perp: {
        count: pool.positions.filter(p => p.marketType === 'perp').length,
        totalSize: pool.positions
          .filter(p => p.marketType === 'perp')
          .reduce((sum, p) => sum + p.size, 0),
        unrealizedPnL: pool.positions
          .filter(p => p.marketType === 'perp')
          .reduce((sum, p) => sum + p.unrealizedPnL, 0),
      },
      prediction: {
        count: pool.positions.filter(p => p.marketType === 'prediction').length,
        totalSize: pool.positions
          .filter(p => p.marketType === 'prediction')
          .reduce((sum, p) => sum + p.size, 0),
        unrealizedPnL: pool.positions
          .filter(p => p.marketType === 'prediction')
          .reduce((sum, p) => sum + p.unrealizedPnL, 0),
      },
    };

  logger.info('Pool details fetched successfully', { poolId: id, openPositions: pool.positions.length }, 'GET /api/pools/[id]');

  return successResponse({
    pool: {
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
      activeInvestors: pool.deposits.length,
      openPositions: pool.positions.length,
      totalUnrealizedPnL,
      totalTrades: pool.trades.length,
      positionsByType,
      openedAt: pool.openedAt.toISOString(),
      updatedAt: pool.updatedAt.toISOString(),
    },
    deposits: pool.deposits.map(d => ({
      id: d.id,
      userId: d.userId,
      amount: parseFloat(d.amount.toString()),
      shares: parseFloat(d.shares.toString()),
      currentValue: parseFloat(d.currentValue.toString()),
      unrealizedPnL: parseFloat(d.unrealizedPnL.toString()),
      depositedAt: d.depositedAt.toISOString(),
    })),
    positions: pool.positions.map(p => ({
      id: p.id,
      marketType: p.marketType,
      ticker: p.ticker,
      marketId: p.marketId,
      side: p.side,
      entryPrice: p.entryPrice,
      currentPrice: p.currentPrice,
      size: p.size,
      shares: p.shares,
      leverage: p.leverage,
      liquidationPrice: p.liquidationPrice,
      unrealizedPnL: p.unrealizedPnL,
      openedAt: p.openedAt.toISOString(),
    })),
    recentTrades: pool.trades.map(t => ({
      id: t.id,
      marketType: t.marketType,
      ticker: t.ticker,
      marketId: t.marketId,
      action: t.action,
      side: t.side,
      amount: t.amount,
      price: t.price,
      sentiment: t.sentiment,
      reason: t.reason,
      executedAt: t.executedAt.toISOString(),
    })),
  });
});

