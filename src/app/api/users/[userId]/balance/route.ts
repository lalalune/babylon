
import { optionalAuth } from '@/lib/api/auth-middleware';
import { cachedDb } from '@/lib/cached-database-service';
import { prisma } from '@/lib/database-service';
import { AuthorizationError, BusinessLogicError } from '@/lib/errors';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { findUserByIdentifier } from '@/lib/users/user-lookup';
import { UserIdParamSchema } from '@/lib/validation/schemas';
import { convertBalanceToStrings } from '@/lib/utils/decimal-converter';
import type { NextRequest } from 'next/server';

/**
 * GET Handler for User Balance
 * 
 * @description Retrieves authenticated user's balance information with caching for performance
 * 
 * @param {NextRequest} request - Next.js request object
 * @param {Object} context - Route context containing dynamic parameters
 * @param {Promise<{userId: string}>} context.params - Dynamic route parameters
 * 
 * @returns {Promise<NextResponse>} User balance data
 * 
 * @throws {AuthorizationError} When user tries to view another user's balance
 * @throws {BusinessLogicError} When balance data not found
 * @throws {ValidationError} When userId parameter is invalid
 * 
 * @example
 * ```typescript
 * // Request (with auth header)
 * GET /api/users/user_123/balance
 * Authorization: Bearer <token>
 * 
 * // Response
 * {
 *   "balance": "10000.50",
 *   "totalDeposited": "15000.00",
 *   "totalWithdrawn": "5000.00",
 *   "lifetimePnL": "500.50"
 * }
 * ```
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  const { userId } = UserIdParamSchema.parse(await context.params);

  // Optional authentication - check if user is requesting their own balance
  const authUser = await optionalAuth(request);

  // Ensure user exists in database
  let dbUser = await findUserByIdentifier(userId);

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        id: userId,
        privyId: userId,
        isActor: false,
        updatedAt: new Date(),
      },
    });
  }

  const canonicalUserId = dbUser!.id;

  // If authenticated, ensure they're requesting their own balance
  if (authUser && authUser.userId !== canonicalUserId) {
    throw new AuthorizationError('Can only view your own balance', 'balance', 'read');
  }

  // Get balance info with caching
  const balanceData = await cachedDb.getUserBalance(canonicalUserId);

  if (!balanceData) {
    throw new BusinessLogicError('User balance not found', 'BALANCE_NOT_FOUND');
  }

  // Safely convert balance fields to strings
  // When data comes from cache, Decimal objects may be serialized as strings or numbers
  const balanceInfo = convertBalanceToStrings({
    virtualBalance: balanceData.virtualBalance,
    totalDeposited: balanceData.totalDeposited,
    totalWithdrawn: balanceData.totalWithdrawn,
    lifetimePnL: balanceData.lifetimePnL,
  });

  logger.info('Balance fetched successfully (cached)', { userId: canonicalUserId, balance: balanceInfo.virtualBalance }, 'GET /api/users/[userId]/balance');

  return successResponse({
    balance: balanceInfo.virtualBalance,
    totalDeposited: balanceInfo.totalDeposited,
    totalWithdrawn: balanceInfo.totalWithdrawn,
    lifetimePnL: balanceInfo.lifetimePnL,
  });
});
