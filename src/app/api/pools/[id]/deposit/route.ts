import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { NotFoundError, BusinessLogicError, InsufficientFundsError } from '@/lib/errors';
import { PoolDepositBodySchema } from '@/lib/validation/schemas/pool';
import { logger } from '@/lib/logger';
import { cachedDb } from '@/lib/cached-database-service';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST /api/pools/[id]/deposit
 * Deposit funds into a pool
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: poolId } = await context.params;

  // Parse and validate request body
  const body = await request.json();
  const { userId, amount } = PoolDepositBodySchema.parse(body);

  // Authenticate user
  const authUser = await authenticate(request);
  if (authUser.userId !== userId) {
    throw new BusinessLogicError('User ID mismatch', 'USER_ID_MISMATCH');
  }

  // Deposit with RLS (transaction is handled inside asUser)
  const result = await asUser(authUser, async (db) => {
    // Use transaction to ensure atomicity
    return await db.$transaction(async (tx) => {
    // 1. Get pool
    const pool = await tx.pool.findUnique({
      where: { id: poolId },
      include: {
        deposits: {
          where: { withdrawnAt: null },
        },
      },
    });

    if (!pool) {
      throw new NotFoundError('Pool', poolId);
    }

    if (!pool.isActive) {
      throw new BusinessLogicError('Pool is not active', 'POOL_INACTIVE', { poolId });
    }

    // 2. Check user balance
    const user = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const userBalance = parseFloat(user.virtualBalance.toString());
    if (userBalance < amount) {
      throw new InsufficientFundsError(amount, userBalance, 'USD');
    }

    // 3. Calculate shares
    // shares = (amount / totalValue) * totalShares
    // If first deposit, shares = amount
    const currentTotalValue = parseFloat(pool.totalValue.toString());
    const currentTotalDeposits = parseFloat(pool.totalDeposits.toString());

    let shares: number;
    if (currentTotalValue === 0 || pool.deposits.length === 0) {
      // First deposit
      shares = amount;
    } else {
      // Calculate proportional shares based on current pool value
      const totalShares = pool.deposits.reduce(
        (sum, d) => sum + parseFloat(d.shares.toString()),
        0
      );
      shares = (amount / currentTotalValue) * totalShares;
    }

    // 4. Create deposit record
    const deposit = await tx.poolDeposit.create({
      data: {
        poolId,
        userId,
        amount: new Prisma.Decimal(amount),
        shares: new Prisma.Decimal(shares),
        currentValue: new Prisma.Decimal(amount), // Initially equal to deposit
        unrealizedPnL: new Prisma.Decimal(0),
      },
    });

    // 5. Update pool totals
    const newTotalValue = currentTotalValue + amount;
    const newTotalDeposits = currentTotalDeposits + amount;
    const newAvailableBalance = parseFloat(pool.availableBalance.toString()) + amount;

    await tx.pool.update({
      where: { id: poolId },
      data: {
        totalValue: new Prisma.Decimal(newTotalValue),
        totalDeposits: new Prisma.Decimal(newTotalDeposits),
        availableBalance: new Prisma.Decimal(newAvailableBalance),
      },
    });

    // 6. Deduct from user balance
    const newUserBalance = userBalance - amount;
    await tx.user.update({
      where: { id: userId },
      data: {
        virtualBalance: new Prisma.Decimal(newUserBalance),
      },
    });

    // 7. Create balance transaction
    await tx.balanceTransaction.create({
      data: {
        userId,
        type: 'pool_deposit',
        amount: new Prisma.Decimal(-amount),
        balanceBefore: new Prisma.Decimal(userBalance),
        balanceAfter: new Prisma.Decimal(newUserBalance),
        relatedId: deposit.id,
        description: `Deposited into ${pool.name}`,
      },
    });

    // 8. Award reputation points for pool participation (+1 point per $100 deposited)
    const reputationBonus = Math.floor(amount / 100);
    if (reputationBonus > 0) {
      const currentReputation = user.reputationPoints;
      const newReputation = currentReputation + reputationBonus;

      await tx.user.update({
        where: { id: userId },
        data: {
          reputationPoints: newReputation,
        },
      });

      await tx.pointsTransaction.create({
        data: {
          userId,
          amount: reputationBonus,
          pointsBefore: currentReputation,
          pointsAfter: newReputation,
          reason: 'pool_deposit',
          metadata: JSON.stringify({
            poolId: pool.id,
            poolName: pool.name,
            depositAmount: amount,
          }),
        },
      });
    }

      return {
        deposit: {
          id: deposit.id,
          poolId,
          amount,
          shares,
          currentValue: amount,
          depositedAt: deposit.depositedAt.toISOString(),
        },
        newBalance: newUserBalance,
      };
    });
  });

  logger.info('Pool deposit successful', {
    poolId,
    userId,
    amount,
    shares: result.deposit.shares
  }, 'POST /api/pools/[id]/deposit');

  // Invalidate caches after deposit
  try {
    await Promise.all([
      cachedDb.invalidateUserCache(authUser.userId),
      cachedDb.invalidatePoolsCache(),
    ]);
    logger.info('Invalidated caches after pool deposit', { userId: authUser.userId, poolId }, 'POST /api/pools/[id]/deposit');
  } catch (error) {
    logger.error('Failed to invalidate caches after pool deposit', { error }, 'POST /api/pools/[id]/deposit');
  }

  // Track pool deposit event
  trackServerEvent(userId, 'pool_deposit', {
    poolId,
    amount,
    shares: result.deposit.shares,
  }).catch((error) => {
    logger.warn('Failed to track pool_deposit event', { error });
  });

  return successResponse(
    {
      success: true,
      ...result,
    },
    201
  );
});
