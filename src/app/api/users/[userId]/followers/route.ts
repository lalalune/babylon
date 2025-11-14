/**
 * API Route: /api/users/[userId]/followers
 * Methods: GET (get followers list)
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

interface FollowerResponse {
  id: string;
  displayName: string;
  username: string | null;
  profileImageUrl: string | null;
  bio: string;
  followedAt: string;
  isActor: boolean;
  tier?: string;
}

/**
 * GET /api/users/[userId]/followers
 * Get list of users following the target user
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  await optionalAuth(request);
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

  logger.debug('Target not found as user, checking if actor', { targetIdentifier }, 'GET /api/users/[userId]/followers')

  const targetActor = await prisma.actor.findUnique({
    where: { id: targetId },
  })

  let followers: FollowerResponse[] = [];

  if (targetActor) {
    // Target is an NPC - get both actor followers and user followers
    const actorFollowers = await prisma.actorFollow.findMany({
      where: { followingId: targetId },
      include: {
        Actor_ActorFollow_followerIdToActor: {
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

    const userActorFollowers = await prisma.userActorFollow.findMany({
      where: {
        actorId: targetId,
      },
      include: {
        User: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const migratedUserIds = new Set(userActorFollowers.map(f => f.userId));

    const legacyUserFollowerStatuses = await prisma.followStatus.findMany({
      where: {
        npcId: targetId,
        isActive: true,
        followReason: 'user_followed',
      },
      orderBy: { followedAt: 'desc' },
      take: 100,
    });

    // Fetch user data separately since FollowStatus doesn't have a relation to User
    const legacyUserIds = legacyUserFollowerStatuses
      .map(f => f.userId)
      .filter(id => !migratedUserIds.has(id));
    const users = await prisma.user.findMany({
      where: { id: { in: legacyUserIds } },
      select: {
        id: true,
        displayName: true,
        username: true,
        profileImageUrl: true,
        bio: true,
      },
    });

    // Create a map for quick lookup
    const userMap = new Map(users.map(u => [u.id, u]));

    followers = [
      ...actorFollowers.map(f => ({
        id: f.Actor_ActorFollow_followerIdToActor.id,
        displayName: f.Actor_ActorFollow_followerIdToActor.name,
        username: f.Actor_ActorFollow_followerIdToActor.id,
        profileImageUrl: f.Actor_ActorFollow_followerIdToActor.profileImageUrl || null,
        bio: f.Actor_ActorFollow_followerIdToActor.description || '',
        followedAt: f.createdAt.toISOString(),
        isActor: true,
        tier: f.Actor_ActorFollow_followerIdToActor.tier || undefined,
      })),
      ...userActorFollowers
        .filter(f => !!f.User)
        .map(f => ({
          id: f.User!.id,
          displayName: f.User!.displayName || '',
          username: f.User!.username || null,
          profileImageUrl: f.User!.profileImageUrl || null,
          bio: f.User!.bio || '',
          followedAt: f.createdAt.toISOString(),
          isActor: false,
        })),
      ...legacyUserFollowerStatuses
        .filter(f => !migratedUserIds.has(f.userId))
        .map(f => {
          const user = userMap.get(f.userId);
        return {
          id: f.userId,
          displayName: user?.displayName || '',
          username: user?.username || null,
          profileImageUrl: user?.profileImageUrl || null,
          bio: user?.bio || '',
          followedAt: f.followedAt.toISOString(),
          isActor: false,
        };
      }),
    ].sort(
      (a, b) =>
        new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime()
    );
  } else {
    // Target is a regular user
    const follows = await prisma.follow.findMany({
      where: { followingId: targetId },
      include: {
        User_Follow_followerIdToUser: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
            bio: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const npcFollowers = await prisma.followStatus.findMany({
      where: {
        userId: targetId,
        isActive: true,
        NOT: {
          followReason: 'user_followed',
        },
      },
      orderBy: { followedAt: 'desc' },
    });

    const npcIds = npcFollowers.map(f => f.npcId);
    const npcActors = await prisma.actor.findMany({
      where: { id: { in: npcIds } },
      select: {
        id: true,
        name: true,
        tier: true,
        profileImageUrl: true,
        description: true,
      },
    });
    const actorMap = new Map(npcActors.map(actor => [actor.id, actor]));

    followers = [
      ...follows.map(f => ({
        id: f.User_Follow_followerIdToUser.id,
        displayName: f.User_Follow_followerIdToUser.displayName || '',
        username: f.User_Follow_followerIdToUser.username || null,
        profileImageUrl: f.User_Follow_followerIdToUser.profileImageUrl || null,
        bio: f.User_Follow_followerIdToUser.bio || '',
        followedAt: f.createdAt.toISOString(),
        isActor: false,
      })),
      ...npcFollowers.map(f => {
        const actor = actorMap.get(f.npcId);
        return {
          id: f.npcId,
          displayName: actor?.name || f.npcId,
          username: actor?.id || null,
          profileImageUrl: actor?.profileImageUrl || null,
          bio: actor?.description || '',
          followedAt: f.followedAt.toISOString(),
          isActor: true,
          tier: actor?.tier || undefined,
        };
      }),
    ].sort(
      (a, b) =>
        new Date(b.followedAt).getTime() - new Date(a.followedAt).getTime()
    );
  }

  logger.info('Followers fetched successfully', { targetId, count: followers.length, isActor: !!targetActor }, 'GET /api/users/[userId]/followers');

  return successResponse({
    followers,
    count: followers.length,
  });
});
