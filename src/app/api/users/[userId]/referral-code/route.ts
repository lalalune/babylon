/**
 * API Route: /api/users/[userId]/referral-code
 * Methods: GET (get or generate referral code)
 */

import {
  authenticate,
  successResponse
} from '@/lib/api/auth-middleware';
import { prisma } from '@/lib/database-service';
import { AuthorizationError, InternalServerError, NotFoundError } from '@/lib/errors';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { UserIdParamSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';
import { requireUserByIdentifier } from '@/lib/users/user-lookup';
import { generateSnowflakeId } from '@/lib/snowflake';

/**
 * Generate a unique referral code
 */
function generateReferralCode(userId: string): string {
  // Use first 8 chars of user ID + random 4 chars
  const userPrefix = userId.slice(0, 8);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${userPrefix}-${random}`;
}

/**
 * GET /api/users/[userId]/referral-code
 * Get user's referral code (create if doesn't exist)
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Authenticate user
  const authUser = await authenticate(request);
  const params = await context.params;
  const { userId } = UserIdParamSchema.parse(params);
  const targetUser = await requireUserByIdentifier(userId, { id: true });
  const canonicalUserId = targetUser.id;

  // Verify user is accessing their own referral code
  if (authUser.userId !== canonicalUserId) {
    throw new AuthorizationError('You can only access your own referral code', 'referral-code', 'read');
  }

  // Get or create referral code
  let user = await prisma.user.findUnique({
    where: { id: canonicalUserId },
    select: {
      id: true,
      referralCode: true,
      referralCount: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User', canonicalUserId);
  }

  // Generate referral code if doesn't exist
  if (!user.referralCode) {
    let code = generateReferralCode(canonicalUserId);
    let attempts = 0;
    const maxAttempts = 10;

    // Ensure code is unique
    while (attempts < maxAttempts) {
      const existing = await prisma.user.findUnique({
        where: { referralCode: code },
      });

      if (!existing) {
        break;
      }

      code = generateReferralCode(canonicalUserId);
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new InternalServerError('Failed to generate unique referral code');
    }

    // Update user with new referral code
    user = await prisma.user.update({
      where: { id: canonicalUserId },
      data: { referralCode: code },
      select: {
        id: true,
        referralCode: true,
        referralCount: true,
      },
    });

    logger.info(
      `Generated referral code for user ${canonicalUserId}: ${code}`,
      { userId: canonicalUserId, code },
      'GET /api/users/[userId]/referral-code'
    );
  }

  // Create referral entry if doesn't exist
  const existingReferral = await prisma.referral.findUnique({
    where: { referralCode: user.referralCode! },
  });

  if (!existingReferral) {
    await prisma.referral.create({
      data: {
        id: await generateSnowflakeId(),
        referrerId: canonicalUserId,
        referralCode: user.referralCode!,
        status: 'pending',
      },
    });
  }

  logger.info('Referral code fetched successfully', { userId: canonicalUserId, referralCode: user.referralCode }, 'GET /api/users/[userId]/referral-code');

  return successResponse({
    referralCode: user.referralCode,
    referralCount: user.referralCount,
    referralUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://babylon.market'}?ref=${user.referralCode}`,
  });
});
