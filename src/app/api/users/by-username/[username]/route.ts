/**
 * API Route: /api/users/by-username/[username]
 * Methods: GET (get user by username)
 */

import type { NextRequest } from 'next/server';
import type { PrismaClient } from '@prisma/client';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import {  NotFoundError } from '@/lib/errors';
import { UsernameParamSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';

/**
 * GET /api/users/by-username/[username]
 * Get user profile by username
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) => {
  const params = await context.params;
  const { username } = UsernameParamSchema.parse(params);

  // Optional authentication
  const authUser = await optionalAuth(request);

  // Get user profile by username with RLS (public profile lookup)
  const dbOperation = async (db: PrismaClient) => {
    return await db.user.findUnique({
      where: { username },
      select: {
        id: true,
        walletAddress: true,
        username: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        coverImageUrl: true,
        isActor: true,
        profileComplete: true,
        hasUsername: true,
        hasBio: true,
        hasProfileImage: true,
        onChainRegistered: true,
        nftTokenId: true,
        virtualBalance: true,
        lifetimePnL: true,
        reputationPoints: true,
        referralCount: true,
        referralCode: true,
        hasFarcaster: true,
        hasTwitter: true,
        farcasterUsername: true,
        twitterUsername: true,
        usernameChangedAt: true,
        createdAt: true,
        _count: {
          select: {
            Position: true,
            Comment: true,
            Reaction: true,
            Follow_Follow_followingIdToUser: true,
            Follow_Follow_followerIdToUser: true,
          },
        },
      },
    });
  }

  const dbUser = (authUser && authUser.userId)
    ? await asUser(authUser, dbOperation)
    : await asPublic(dbOperation)

  if (!dbUser) {
    throw new NotFoundError('User', username);
  }

  logger.info('User profile fetched by username', { username, userId: dbUser.id }, 'GET /api/users/by-username/[username]');

  return successResponse({
    user: {
      id: dbUser.id,
      walletAddress: dbUser.walletAddress,
      username: dbUser.username,
      displayName: dbUser.displayName,
      bio: dbUser.bio,
      profileImageUrl: dbUser.profileImageUrl,
      coverImageUrl: dbUser.coverImageUrl,
      isActor: dbUser.isActor,
      profileComplete: dbUser.profileComplete,
      hasUsername: dbUser.hasUsername,
      hasBio: dbUser.hasBio,
      hasProfileImage: dbUser.hasProfileImage,
      onChainRegistered: dbUser.onChainRegistered,
      nftTokenId: dbUser.nftTokenId,
      virtualBalance: Number(dbUser.virtualBalance),
      lifetimePnL: Number(dbUser.lifetimePnL),
      reputationPoints: dbUser.reputationPoints,
      referralCount: dbUser.referralCount,
      referralCode: dbUser.referralCode,
      hasFarcaster: dbUser.hasFarcaster,
      hasTwitter: dbUser.hasTwitter,
      farcasterUsername: dbUser.farcasterUsername,
      twitterUsername: dbUser.twitterUsername,
      createdAt: dbUser.createdAt.toISOString(),
      stats: {
        positions: dbUser._count.Position,
        comments: dbUser._count.Comment,
        reactions: dbUser._count.Reaction,
        followers: dbUser._count.Follow_Follow_followingIdToUser,
        following: dbUser._count.Follow_Follow_followerIdToUser,
      },
    },
  });
});

