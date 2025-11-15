/**
 * API Route: /api/actors/[actorId]/stats
 * Methods: GET (get actor stats including followers, following, etc.)
 */

import { prisma } from '@/lib/prisma';
import { BusinessLogicError } from '@/lib/errors';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';

/**
 * GET /api/actors/[actorId]/stats
 * Get actor statistics (followers, following, posts)
 */
export const GET = withErrorHandling(async (
  _request: NextRequest,
  context: { params: Promise<{ actorId: string }> }
) => {
  const params = await context.params;
  const { actorId } = params;

  // Try to find actor by ID first, then by name (case-insensitive)
  let actor = await prisma.actor.findUnique({
    where: { id: actorId },
    select: { id: true },
  });

  // If not found by ID, try finding by name
  if (!actor) {
    actor = await prisma.actor.findFirst({
      where: { 
        name: { equals: actorId, mode: 'insensitive' }
      },
      select: { id: true },
    });
  }

  if (!actor) {
    throw new BusinessLogicError(`Actor ${actorId} not found`, 'NOT_FOUND');
  }

  // Use the actual actor ID for all queries
  const actualActorId = actor.id;

  // Get follower counts (both from ActorFollow and UserActorFollow)
  const [
    actorFollowerCount,
    userActorFollowerCount,
    legacyUserFollowerCount,
    followingCount,
    postCount,
  ] = await Promise.all([
    // NPCs following this actor (ActorFollow)
    prisma.actorFollow.count({
      where: { followingId: actualActorId },
    }),
    // Users following this actor (UserActorFollow)
    prisma.userActorFollow.count({
      where: {
        actorId: actualActorId,
      },
    }),
    // Legacy FollowStatus entries created before migration
    prisma.followStatus.count({
      where: {
        npcId: actualActorId,
        isActive: true,
        followReason: 'user_followed',
      },
    }),
    // This actor following others (only NPC-to-NPC follows via ActorFollow)
    prisma.actorFollow.count({
      where: { followerId: actualActorId },
    }),
    // Posts by this actor
    prisma.post.count({
      where: { authorId: actualActorId },
    }),
  ]);

  const totalUserFollowers = userActorFollowerCount + legacyUserFollowerCount;
  const totalFollowers = actorFollowerCount + totalUserFollowers;

  logger.info('Actor stats fetched successfully', { 
    actorId,
    actualActorId, 
    totalFollowers,
    actorFollowerCount,
    userActorFollowerCount,
    legacyUserFollowerCount,
    followingCount 
  }, 'GET /api/actors/[actorId]/stats');

  return successResponse({
    stats: {
      followers: totalFollowers,
      following: followingCount,
      posts: postCount,
      actorFollowers: actorFollowerCount,
      userFollowers: totalUserFollowers,
    },
  });
});

