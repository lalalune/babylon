/**
 * Points Award API Route
 *
 * Awards points to users for various achievements and milestones
 * Tracks transactions for transparency
 */

import { successResponse } from '@/lib/api/auth-middleware'
import { prisma } from '@/lib/database-service'
import { BusinessLogicError } from '@/lib/errors'
import { withErrorHandling } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import { AwardPointsSchema, UserIdParamSchema } from '@/lib/validation/schemas'
import { Prisma } from '@prisma/client'
import type { NextRequest } from 'next/server'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'

/**
 * POST /api/users/points/award
 * Award points to a user
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Parse and validate request body
  const body = await request.json();
  const { userId, points: amount, reason, description } = AwardPointsSchema.parse(body);

  // Verify user exists and get current balance
  const user = await requireUserByIdentifier(userId, {
    id: true,
    virtualBalance: true,
    totalDeposited: true,
  });

  // Calculate balance changes
  const balanceBefore = new Prisma.Decimal(user.virtualBalance.toString());
  const amountDecimal = new Prisma.Decimal(amount);
  const balanceAfter = balanceBefore.plus(amountDecimal);

  // Award points by creating a deposit transaction
  const transaction = await prisma.balanceTransaction.create({
    data: {
      userId: user.id,
      type: 'deposit',
      amount: amountDecimal,
      balanceBefore,
      balanceAfter,
      description: description || reason, // Use custom description if provided, otherwise use reason enum
    },
  });

  // Update user's virtual balance
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      virtualBalance: {
        increment: amount,
      },
      totalDeposited: {
        increment: amount,
      },
    },
    select: {
      id: true,
      virtualBalance: true,
      totalDeposited: true,
    },
  });

  logger.info(`Successfully awarded ${amount} points`, { userId: user.id, amount, reason }, 'POST /api/users/points/award');

  return successResponse({
    message: `Successfully awarded ${amount} points`,
    transaction: {
      id: transaction.id,
      amount: transaction.amount.toString(),
      reason: transaction.description,
      timestamp: transaction.createdAt,
      balanceBefore: transaction.balanceBefore.toString(),
      balanceAfter: transaction.balanceAfter.toString(),
    },
    user: {
      id: updatedUser.id,
      virtualBalance: updatedUser.virtualBalance.toString(),
      totalDeposited: updatedUser.totalDeposited.toString(),
    },
  });
});

/**
 * GET /api/users/points/award?userId={userId}
 * Get points award history for a user
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get('userId');
  
  if (!userIdParam) {
    throw new BusinessLogicError('User ID is required', 'USER_ID_REQUIRED');
  }
  
  // Validate userId format
  const { userId } = UserIdParamSchema.parse({ userId: userIdParam });
  const targetUser = await requireUserByIdentifier(userId, { id: true });
  const canonicalUserId = targetUser.id;

  // Fetch deposit transactions (points awards)
  const transactions = await prisma.balanceTransaction.findMany({
    where: {
      userId: canonicalUserId,
      type: 'deposit',
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      amount: true,
      description: true,
      createdAt: true,
      balanceBefore: true,
      balanceAfter: true,
    },
  });

  logger.info('Points award history fetched', { userId: canonicalUserId, transactionCount: transactions.length }, 'GET /api/users/points/award');

  return successResponse({
    transactions: transactions.map(tx => ({
      id: tx.id,
      amount: tx.amount.toString(),
      reason: tx.description,
      timestamp: tx.createdAt,
      balanceBefore: tx.balanceBefore.toString(),
      balanceAfter: tx.balanceAfter.toString(),
    })),
  });
});
