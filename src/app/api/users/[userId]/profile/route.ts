/**
 * User Profile API Route
 * 
 * @description Retrieves comprehensive user profile information including stats, social connections, and account details
 * 
 * @route GET /api/users/[userId]/profile
 * @access Public (no authentication required)
 * 
 * @swagger
 * /api/users/{userId}/profile:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user profile
 *     description: Retrieves comprehensive profile information for a specific user including stats, social connections, and account details
 *     operationId: getUserProfile
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID, username, or wallet address
 *         example: "user_123abc"
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Unique user identifier
 *                     username:
 *                       type: string
 *                       description: Username
 *                     displayName:
 *                       type: string
 *                       description: Display name
 *                     bio:
 *                       type: string
 *                       nullable: true
 *                       description: User biography
 *                     profileImageUrl:
 *                       type: string
 *                       nullable: true
 *                       description: Profile image URL
 *                     coverImageUrl:
 *                       type: string
 *                       nullable: true
 *                       description: Cover image URL
 *                     walletAddress:
 *                       type: string
 *                       nullable: true
 *                       description: Blockchain wallet address
 *                     virtualBalance:
 *                       type: number
 *                       description: Virtual balance in game currency
 *                     lifetimePnL:
 *                       type: number
 *                       description: Lifetime profit and loss
 *                     reputationPoints:
 *                       type: integer
 *                       description: Reputation points earned
 *                     isActor:
 *                       type: boolean
 *                       description: Whether this is an NPC actor
 *                     profileComplete:
 *                       type: boolean
 *                       description: Whether profile setup is complete
 *                     onChainRegistered:
 *                       type: boolean
 *                       description: Whether registered on blockchain
 *                     hasFarcaster:
 *                       type: boolean
 *                       description: Whether Farcaster is linked
 *                     hasTwitter:
 *                       type: boolean
 *                       description: Whether Twitter is linked
 *                     stats:
 *                       type: object
 *                       description: User statistics
 *                       properties:
 *                         positions:
 *                           type: integer
 *                           description: Number of open positions
 *                         comments:
 *                           type: integer
 *                           description: Total comments made
 *                         reactions:
 *                           type: integer
 *                           description: Total reactions given
 *                         followers:
 *                           type: integer
 *                           description: Number of followers
 *                         following:
 *                           type: integer
 *                           description: Number of users/actors following
 *                         posts:
 *                           type: integer
 *                           description: Total posts created
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/database-service';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { UserIdParamSchema } from '@/lib/validation/schemas';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { logger } from '@/lib/logger';
import { requireUserByIdentifier } from '@/lib/users/user-lookup';

/**
 * GET Handler for User Profile
 * 
 * @description Retrieves comprehensive user profile information including stats and social connections
 * 
 * @param {NextRequest} request - Next.js request object
 * @param {Object} context - Route context containing dynamic parameters
 * @param {Promise<{userId: string}>} context.params - Dynamic route parameters
 * 
 * @returns {Promise<NextResponse>} User profile data with stats
 * 
 * @throws {NotFoundError} When user is not found
 * @throws {ValidationError} When userId parameter is invalid
 * 
 * @example
 * ```typescript
 * // Request
 * GET /api/users/johndoe/profile
 * 
 * // Response
 * {
 *   "user": {
 *     "id": "user_123",
 *     "username": "johndoe",
 *     "displayName": "John Doe",
 *     "virtualBalance": 10000,
 *     "stats": {
 *       "followers": 150,
 *       "following": 75,
 *       "posts": 42
 *     }
 *   }
 * }
 * ```
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  const params = await context.params;
  const { userId } = UserIdParamSchema.parse(params);

  // Optional authentication
  await optionalAuth(request);

  // Get user profile
  const dbUser = await requireUserByIdentifier(userId, {
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
        positions: true,
        comments: true,
        reactions: true,
        followedBy: true,
        following: true,
        userActorFollows: true, // Count of actors this user follows
      },
    },
  });

  // Calculate total following count (users + actors)
  const totalFollowing = dbUser._count.following + dbUser._count.userActorFollows;

  // Get post count for user
  const postCount = await prisma.post.count({
    where: { authorId: dbUser.id },
  });

  logger.info('User profile fetched successfully', { userId }, 'GET /api/users/[userId]/profile');

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
      usernameChangedAt: dbUser.usernameChangedAt?.toISOString() || null,
      createdAt: dbUser.createdAt.toISOString(),
      stats: {
        positions: dbUser._count.positions,
        comments: dbUser._count.comments,
        reactions: dbUser._count.reactions,
        followers: dbUser._count.followedBy,
        following: totalFollowing, // Include both user and actor follows
        posts: postCount,
      },
    },
  });
});
