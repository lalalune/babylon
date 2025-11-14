/**
 * API Route: /api/users/[userId]/following
 * Methods: GET (get following list)
 */

import {
  optionalAuth,
  successResponse
} from '@/lib/api/auth-middleware';
import { prisma } from '@/lib/database-service';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { UserFollowersQuerySchema, UserIdParamSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';
import { requireUserByIdentifier } from '@/lib/users/user-lookup';

interface FollowingResponse {
  id: string;
  displayName: string;
  username: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  followedAt: string;
  isActor: boolean;
  type?: 'user' | 'actor';
  tier?: string | null;
  isMutualFollow?: boolean;
}

/**
 * GET /api/users/[userId]/following
 * Get list of users/actors that the target user is following
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Optional authentication - if authenticated, can provide personalized data
  const authUser = await optionalAuth(request);
  const params = await context.params;
  const { userId: targetIdentifier } = UserIdParamSchema.parse(params);
  
  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    includeMutual: searchParams.get('includeMutual')
  };
  UserFollowersQuerySchema.parse(queryParams);

  let targetId = targetIdentifier
  let targetUser = null
  
  targetUser = await requireUserByIdentifier(targetIdentifier, { id: true })
  targetId = targetUser.id

  logger.debug('Target not found as user, checking if actor', { targetIdentifier }, 'GET /api/users/[userId]/following')

  const targetActor = await prisma.actor.findUnique({
    where: { id: targetId },
  })

  let following: FollowingResponse[] = [];

  if (targetActor) {
    // Target is an NPC - get actors they follow
    const actorFollows = await prisma.actorFollow.findMany({
      where: { followerId: targetId },
      include: {
        Actor_ActorFollow_followingIdToActor: {
          select: {
            id: true,
            name: true,
            tier: true,
            profileImageUrl: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    following = actorFollows.map(f => ({
      id: f.Actor_ActorFollow_followingIdToActor.id,
      displayName: f.Actor_ActorFollow_followingIdToActor.name,
      username: f.Actor_ActorFollow_followingIdToActor.id,
      profileImageUrl: f.Actor_ActorFollow_followingIdToActor.profileImageUrl || null,
      bio: f.Actor_ActorFollow_followingIdToActor.description || '',
      followedAt: f.createdAt.toISOString(),
      isActor: true,
      tier: f.Actor_ActorFollow_followingIdToActor.tier || null,
    }));
  } else {
    // Target is a regular user
    // Get users being followed (Follow model)
    const userFollows = await prisma.follow.findMany({
      where: {
        followerId: targetId,
      },
      include: {
        User_Follow_followingIdToUser: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
            bio: true,
            isActor: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get actors being followed (UserActorFollow model with legacy support)
    const actorFollows = await prisma.userActorFollow.findMany({
      where: {
        userId: targetId,
      },
      include: {
        Actor: {
          select: {
            id: true,
            name: true,
            description: true,
            profileImageUrl: true,
            tier: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const migratedActorIds = new Set(actorFollows.map(f => f.actorId));

    const legacyActorFollows = await prisma.followStatus.findMany({
      where: {
        userId: targetId,
        isActive: true,
        followReason: 'user_followed',
      },
      orderBy: {
        followedAt: 'desc',
      },
    });

    const legacyActorIds = legacyActorFollows
      .map(f => f.npcId)
      .filter(id => !migratedActorIds.has(id));

    const legacyActors = await prisma.actor.findMany({
      where: {
        id: { in: legacyActorIds },
      },
      select: {
        id: true,
        name: true,
        description: true,
        profileImageUrl: true,
        tier: true,
      },
    });

    const legacyActorMap = new Map(legacyActors.map(actor => [actor.id, actor]));

    // Check mutual follows if authenticated user is viewing their own following list
    const mutualFollowChecks = authUser && authUser.userId === targetId
      ? await Promise.all(
          userFollows.map(async (f) => {
            const mutualFollow = await prisma.follow.findUnique({
              where: {
                followerId_followingId: {
                  followerId: f.User_Follow_followingIdToUser.id,
                  followingId: authUser.userId,
                },
              },
            });
            return { userId: f.User_Follow_followingIdToUser.id, isMutual: !!mutualFollow };
          })
        )
      : [];

    const mutualFollowMap = new Map(
      mutualFollowChecks.map((check) => [check.userId, check.isMutual])
    );

    following = [
      ...userFollows.map((f) => ({
        id: f.User_Follow_followingIdToUser.id,
        displayName: f.User_Follow_followingIdToUser.displayName || '',
        username: f.User_Follow_followingIdToUser.username || null,
        profileImageUrl: f.User_Follow_followingIdToUser.profileImageUrl || null,
        bio: f.User_Follow_followingIdToUser.bio || null,
        isActor: f.User_Follow_followingIdToUser.isActor,
        followedAt: f.createdAt.toISOString(),
        type: 'user' as const,
        tier: null,
        isMutualFollow: mutualFollowMap.get(f.User_Follow_followingIdToUser.id) || false,
      })),
      ...actorFollows.map((f) => {
        if (!f.Actor) {
          return {
            id: f.actorId,
            displayName: f.actorId,
            username: null,
            profileImageUrl: null,
            bio: null,
            isActor: true,
            followedAt: f.createdAt.toISOString(),
            type: 'actor' as const,
            tier: null,
          };
        }

        return {
          id: f.Actor.id,
          displayName: f.Actor.name || f.Actor.id,
          username: null,
          profileImageUrl: f.Actor.profileImageUrl || null,
          bio: f.Actor.description || null,
          isActor: true,
          followedAt: f.createdAt.toISOString(),
          type: 'actor' as const,
          tier: f.Actor.tier || null,
        };
      }),
      ...legacyActorFollows
        .filter(f => !migratedActorIds.has(f.npcId))
        .map((f) => {
          const actor = legacyActorMap.get(f.npcId);
          return {
            id: f.npcId,
            displayName: actor?.name || f.npcId,
            username: null,
            profileImageUrl: actor?.profileImageUrl || null,
            bio: actor?.description || null,
            isActor: true,
            followedAt: f.followedAt.toISOString(),
            type: 'actor' as const,
            tier: actor?.tier || null,
          };
        }),
    ].sort((a, b) => new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime());
  }

  logger.info('Following list fetched successfully', { targetId, count: following.length, isActor: !!targetActor }, 'GET /api/users/[userId]/following');

  return successResponse({
    following,
    count: following.length,
  });
});
