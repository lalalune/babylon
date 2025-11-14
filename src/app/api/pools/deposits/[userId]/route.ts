import type { NextRequest } from 'next/server';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { UserIdParamSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';

/**
 * GET /api/pools/deposits/[userId]
 * Get all pool deposits for a specific user
 */
export const GET = withErrorHandling(async (
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  const { userId } = UserIdParamSchema.parse(await context.params);

  // Optional auth - deposits are public for stats but RLS still applies
  const authUser = await optionalAuth(_request).catch(() => null);

  // Get deposits with RLS - use asPublic for unauthenticated requests
  const deposits = (authUser && authUser.userId)
    ? await asUser(authUser, async (db) => {
      return await db.poolDeposit.findMany({
      where: {
        userId,
      },
      include: {
        pool: {
          include: {
            npcActor: {
              select: {
                id: true,
                name: true,
                tier: true,
                personality: true,
              },
            },
          },
        },
      },
      orderBy: {
        depositedAt: 'desc',
      },
    })
  })
    : await asPublic(async (db) => {
      return await db.poolDeposit.findMany({
        where: {
          userId,
        },
        include: {
          pool: {
            include: {
              npcActor: {
                select: {
                  id: true,
                  name: true,
                  tier: true,
                  personality: true,
                },
              },
            },
          },
        },
        orderBy: {
          depositedAt: 'desc',
        },
      })
    });

  // Format deposits with calculated metrics
  const formattedDeposits = deposits.map(d => {
    const amount = parseFloat(d.amount.toString());
    const currentValue = parseFloat(d.currentValue.toString());
    const unrealizedPnL = parseFloat(d.unrealizedPnL.toString());
    const shares = parseFloat(d.shares.toString());

    const returnPercent = amount > 0 ? ((currentValue - amount) / amount) * 100 : 0;

    return {
      id: d.id,
      poolId: d.poolId,
      poolName: d.pool.name,
      npcActor: d.pool.npcActor,
      amount,
      shares,
      currentValue,
      unrealizedPnL,
      returnPercent,
      depositedAt: d.depositedAt.toISOString(),
      withdrawnAt: d.withdrawnAt?.toISOString() || null,
      withdrawnAmount: d.withdrawnAmount ? parseFloat(d.withdrawnAmount.toString()) : null,
      isActive: !d.withdrawnAt,
    };
  });

  // Separate active and historical
  const activeDeposits = formattedDeposits.filter(d => d.isActive);
  const historicalDeposits = formattedDeposits.filter(d => !d.isActive);

  // Calculate totals
  const totalInvested = activeDeposits.reduce((sum, d) => sum + d.amount, 0);
  const totalCurrentValue = activeDeposits.reduce((sum, d) => sum + d.currentValue, 0);
  const totalUnrealizedPnL = activeDeposits.reduce((sum, d) => sum + d.unrealizedPnL, 0);
  const totalReturnPercent = totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;

  logger.info('User pool deposits fetched successfully', {
    userId,
    activePools: activeDeposits.length,
    totalInvested,
    totalCurrentValue,
  }, 'GET /api/pools/deposits/[userId]');

  return successResponse({
    activeDeposits,
    historicalDeposits,
    summary: {
      totalInvested,
      totalCurrentValue,
      totalUnrealizedPnL,
      totalReturnPercent,
      activePools: activeDeposits.length,
      historicalCount: historicalDeposits.length,
    },
  });
})

