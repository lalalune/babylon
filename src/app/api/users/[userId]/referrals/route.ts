/**
 * API Route: /api/users/[userId]/referrals
 * Methods: GET (get referral stats and list of referred users)
 */

import {
  authenticate,
  successResponse
} from '@/lib/api/auth-middleware';
import { prisma } from '@/lib/database-service';
import { AuthorizationError, NotFoundError } from '@/lib/errors';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { ReferralQuerySchema, UserIdParamSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';
import { requireUserByIdentifier } from '@/lib/users/user-lookup';

/**
 * GET /api/users/[userId]/referrals
 * Get user's referral statistics and list of referred users
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Authenticate user
  const authUser = await authenticate(request);
  const params = await context.params;
  const { userId } = UserIdParamSchema.parse(params);
  
  // Check if the authenticated user has a database record
  if (!authUser.dbUserId) {
    throw new NotFoundError('User', userId, 'User profile not found. Please complete onboarding first.');
  }
  
  const targetUser = await requireUserByIdentifier(userId, { id: true });
  const canonicalUserId = targetUser.id;
  
  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    userId,
    includeStats: searchParams.get('includeStats') || 'false'
  };
  ReferralQuerySchema.parse(queryParams);

  // Verify user is accessing their own referrals
  if (authUser.dbUserId !== canonicalUserId) {
    throw new AuthorizationError('You can only access your own referrals', 'referrals', 'read');
  }

  // Get user's referral data
  const user = await prisma.user.findUnique({
    where: { id: canonicalUserId },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      referralCode: true,
      referralCount: true,
      reputationPoints: true,
      totalFeesEarned: true,
      pointsAwardedForProfile: true,
      pointsAwardedForFarcaster: true,
      pointsAwardedForTwitter: true,
      pointsAwardedForWallet: true,
      farcasterUsername: true,
      twitterUsername: true,
      walletAddress: true,
    },
  });

  if (!user) {
    throw new NotFoundError('User', canonicalUserId);
  }

  // Get all completed referrals
  const referrals = await prisma.referral.findMany({
    where: {
      referrerId: canonicalUserId,
      status: 'completed',
    },
    include: {
      User_Referral_referredUserIdToUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          createdAt: true,
          reputationPoints: true,
        },
      },
    },
    orderBy: {
      completedAt: 'desc',
    },
  });

  // Get fee earnings from referrals
  const feeEarnings = await prisma.tradingFee.aggregate({
    where: {
      referrerId: canonicalUserId,
    },
    _sum: {
      referrerFee: true,
    },
  })
  
  const totalFeesEarned = Number(feeEarnings._sum.referrerFee || 0)

  // Check if referrer (current user) is following the referred users
  const referredUserIds = referrals
    .map(r => r.referredUserId)
    .filter((id): id is string => id !== null);

  const followStatuses = await prisma.follow.findMany({
    where: {
      followerId: canonicalUserId,
      followingId: { in: referredUserIds },
    },
    select: {
      followingId: true,
    },
  });

  const followingUserIds = new Set(followStatuses.map(f => f.followingId));

  // Format referred users with follow status
  const referredUsers = referrals
    .filter(r => r.User_Referral_referredUserIdToUser)
    .map(r => ({
      id: r.User_Referral_referredUserIdToUser!.id,
      username: r.User_Referral_referredUserIdToUser!.username,
      displayName: r.User_Referral_referredUserIdToUser!.displayName,
      profileImageUrl: r.User_Referral_referredUserIdToUser!.profileImageUrl,
      createdAt: r.User_Referral_referredUserIdToUser!.createdAt,
      reputationPoints: r.User_Referral_referredUserIdToUser!.reputationPoints,
      isFollowing: followingUserIds.has(r.User_Referral_referredUserIdToUser!.id),
      joinedAt: r.completedAt,
    }));

  // Use username as referral code (without @)
  const referralCode = user.username || null;
  const referralUrl = referralCode
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://babylon.market'}?ref=${referralCode}`
    : null;

  logger.info('Referrals fetched successfully', { userId: canonicalUserId, totalReferrals: referrals.length }, 'GET /api/users/[userId]/referrals');

  return successResponse({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      profileImageUrl: user.profileImageUrl,
      referralCode: referralCode,
      reputationPoints: user.reputationPoints,
      totalFeesEarned: user.totalFeesEarned,
      pointsAwardedForProfile: user.pointsAwardedForProfile,
      pointsAwardedForFarcaster: user.pointsAwardedForFarcaster,
      pointsAwardedForTwitter: user.pointsAwardedForTwitter,
      pointsAwardedForWallet: user.pointsAwardedForWallet,
      farcasterUsername: user.farcasterUsername,
      twitterUsername: user.twitterUsername,
      walletAddress: user.walletAddress,
    },
    stats: {
      totalReferrals: referrals.length,
      totalFeesEarned,
      feeShareRate: 0.50, // 50% of fees
      followingCount: followingUserIds.size,
    },
    referredUsers,
    referralUrl,
  });
});
