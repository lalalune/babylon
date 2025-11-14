/**
 * API Route: /api/pools/[id]/withdraw
 * Methods: POST (withdraw funds from a pool)
 */

import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { NotFoundError, BusinessLogicError, AuthorizationError, InsufficientFundsError } from '@/lib/errors';
import { PoolWithdrawBodySchema } from '@/lib/validation/schemas/pool';
import { logger } from '@/lib/logger';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST /api/pools/[id]/withdraw
 * Withdraw funds from a pool
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: poolId } = await context.params;

  const body = await request.json();
  const { userId, depositId } = PoolWithdrawBodySchema.parse(body);

  // Authenticate user
  const authUser = await authenticate(request);
  if (authUser.userId !== userId) {
    throw new BusinessLogicError('User ID mismatch', 'USER_ID_MISMATCH');
  }

  // Withdraw with RLS (transaction is handled inside asUser)
  const result = await asUser(authUser, async (db) => {
    // Use transaction to ensure atomicity
    return await db.$transaction(async (tx) => {
    // 1. Get deposit
    const deposit = await tx.poolDeposit.findUnique({
      where: { id: depositId },
      include: {
        pool: true,
      },
    });

    if (!deposit) {
      throw new NotFoundError('Deposit', depositId);
    }

    if (deposit.userId !== userId) {
      throw new AuthorizationError('Not your deposit', 'deposit', 'withdraw');
    }

    if (deposit.withdrawnAt) {
      throw new BusinessLogicError('Already withdrawn', 'ALREADY_WITHDRAWN', { depositId, withdrawnAt: deposit.withdrawnAt });
    }

    if (deposit.poolId !== poolId) {
      throw new BusinessLogicError('Deposit does not belong to this pool', 'DEPOSIT_POOL_MISMATCH', { depositPoolId: deposit.poolId, requestPoolId: poolId });
    }

    const pool = deposit.pool;

    // 2. Calculate withdrawal amount based on current value
    const currentValue = parseFloat(deposit.currentValue.toString());
    const originalAmount = parseFloat(deposit.amount.toString());
    const pnl = currentValue - originalAmount;

    // 3. Calculate performance fee if there's profit
    let performanceFee = 0;
    let withdrawalAmount = currentValue;

    if (pnl > 0) {
      performanceFee = pnl * pool.performanceFeeRate;
      withdrawalAmount = currentValue - performanceFee;
    }

    // 4. Check if pool has enough available balance
    const poolAvailableBalance = parseFloat(pool.availableBalance.toString());
    if (poolAvailableBalance < withdrawalAmount) {
      throw new InsufficientFundsError(withdrawalAmount, poolAvailableBalance, 'USD');
    }

    // 5. Mark deposit as withdrawn
    await tx.poolDeposit.update({
      where: { id: depositId },
      data: {
        withdrawnAt: new Date(),
        withdrawnAmount: new Prisma.Decimal(withdrawalAmount),
      },
    });

    // 6. Update pool totals
    const newTotalValue = parseFloat(pool.totalValue.toString()) - currentValue;
    const newAvailableBalance = poolAvailableBalance - withdrawalAmount;
    const newTotalFeesCollected = parseFloat(pool.totalFeesCollected.toString()) + performanceFee;

    await tx.pool.update({
      where: { id: poolId },
      data: {
        totalValue: new Prisma.Decimal(Math.max(0, newTotalValue)),
        availableBalance: new Prisma.Decimal(Math.max(0, newAvailableBalance)),
        totalFeesCollected: new Prisma.Decimal(newTotalFeesCollected),
      },
    });

    // 7. Credit user balance
    const user = await tx.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const userBalance = parseFloat(user.virtualBalance.toString());
    const newUserBalance = userBalance + withdrawalAmount;
    const netPnL = withdrawalAmount - originalAmount;

    // Calculate reputation points to award/deduct based on P&L
    const reputationChange = Math.floor(netPnL / 10);
    const currentReputation = user.reputationPoints;
    const newReputation = Math.max(0, currentReputation + reputationChange);

    await tx.user.update({
      where: { id: userId },
      data: {
        virtualBalance: new Prisma.Decimal(newUserBalance),
        lifetimePnL: new Prisma.Decimal(
          parseFloat(user.lifetimePnL.toString()) + netPnL
        ),
        reputationPoints: newReputation,
      },
    });

    // 8. Create balance transaction
    await tx.balanceTransaction.create({
      data: {
        userId,
        type: 'pool_withdraw',
        amount: new Prisma.Decimal(withdrawalAmount),
        balanceBefore: new Prisma.Decimal(userBalance),
        balanceAfter: new Prisma.Decimal(newUserBalance),
        relatedId: depositId,
        description: `Withdrew from ${pool.name}`,
      },
    });

    // 9. Create reputation points transaction if there was a change
    if (reputationChange !== 0) {
      await tx.pointsTransaction.create({
        data: {
          userId,
          amount: reputationChange,
          pointsBefore: currentReputation,
          pointsAfter: newReputation,
          reason: netPnL > 0 ? 'pool_profit' : 'pool_loss',
          metadata: JSON.stringify({
            poolId,
            poolName: pool.name,
            netPnL,
            originalAmount,
            withdrawalAmount,
          }),
        },
      });
    }

      return {
        withdrawalAmount,
        performanceFee,
        pnl: netPnL,
        originalAmount,
        newBalance: newUserBalance,
        reputationChange,
        newReputation,
      };
    });
  });

  logger.info('Pool withdrawal successful', {
    poolId,
    userId,
    withdrawalAmount: result.withdrawalAmount,
    pnl: result.pnl
  }, 'POST /api/pools/[id]/withdraw');

  // Track pool withdrawal event
  trackServerEvent(userId, 'pool_withdrawal', {
    poolId,
    depositId,
    withdrawalAmount: result.withdrawalAmount,
    performanceFee: result.performanceFee,
    pnl: result.pnl,
    originalAmount: result.originalAmount,
    reputationChange: result.reputationChange,
  }).catch((error) => {
    logger.warn('Failed to track pool_withdrawal event', { error });
  });

  return successResponse({
    success: true,
    ...result,
  });
});
