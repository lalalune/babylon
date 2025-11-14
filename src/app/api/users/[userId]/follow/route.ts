/**
 * User Follow/Unfollow API Route
 * 
 * @description Manage user following relationships for both users and NPC actors
 * 
 * @route POST /api/users/[userId]/follow - Follow a user or actor
 * @route DELETE /api/users/[userId]/follow - Unfollow a user or actor
 * @route GET /api/users/[userId]/follow - Check follow status
 * @access Private (requires authentication)
 * 
 * @swagger
 * /api/users/{userId}/follow:
 *   post:
 *     tags:
 *       - Users
 *     summary: Follow user or actor
 *     description: Follow a user or NPC actor. Creates a follow relationship and sends notification.
 *     operationId: followUser
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID or actor ID to follow
 *     responses:
 *       201:
 *         description: Successfully followed
 *       400:
 *         description: Already following or self-follow attempt
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User or actor not found
 *   delete:
 *     tags:
 *       - Users
 *     summary: Unfollow user or actor
 *     description: Remove a follow relationship with a user or actor
 *     operationId: unfollowUser
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID or actor ID to unfollow
 *     responses:
 *       200:
 *         description: Successfully unfollowed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Follow relationship not found
 *   get:
 *     tags:
 *       - Users
 *     summary: Check follow status
 *     description: Check if authenticated user is following the specified user or actor
 *     operationId: checkFollowStatus
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID or actor ID to check
 *     responses:
 *       200:
 *         description: Follow status retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isFollowing:
 *                   type: boolean
 *                   description: Whether user is following the target
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/database-service';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { NotFoundError, BusinessLogicError } from '@/lib/errors';
import { UserIdParamSchema } from '@/lib/validation/schemas';
import { authenticate } from '@/lib/api/auth-middleware';
import { notifyFollow } from '@/lib/services/notification-service';
import { logger } from '@/lib/logger';
import { findUserByIdentifier } from '@/lib/users/user-lookup';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST Handler - Follow User or Actor
 * 
 * @description Creates a follow relationship between authenticated user and target user/actor
 * 
 * @param {NextRequest} request - Next.js request object
 * @param {Object} context - Route context
 * @returns {Promise<NextResponse>} Follow relationship data
 * @throws {BusinessLogicError} When trying to follow self or already following
 * @throws {NotFoundError} When target user/actor not found
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const params = await context.params;
  const { userId: targetIdentifier } = UserIdParamSchema.parse(params);
  const targetUser = await findUserByIdentifier(targetIdentifier, { id: true, isActor: true });
  const targetId = targetUser?.id ?? targetIdentifier;

  // Prevent self-following
  if (targetUser && user.userId === targetId) {
    throw new BusinessLogicError('Cannot follow yourself', 'SELF_FOLLOW');
  }

  // Check if target exists (could be a user or actor)
  const targetActor = targetUser ? null : await prisma.actor.findUnique({
    where: { id: targetId },
    select: { id: true },
  });

  // If neither user nor actor found, return error
  if (!targetUser && !targetActor) {
    throw new NotFoundError('User or actor', targetId);
  }

  if (targetUser) {
    // Target is a user - use Follow model
    // Check if already following
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: user.userId,
          followingId: targetId,
        },
      },
    });

    if (existingFollow) {
      throw new BusinessLogicError('Already following this user', 'ALREADY_FOLLOWING');
    }

    // Create follow relationship
    const follow = await prisma.follow.create({
      data: {
        followerId: user.userId,
        followingId: targetId,
      },
      include: {
        following: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
            bio: true,
          },
        },
      },
    });

    // Create notification for the followed user
    await notifyFollow(targetId, user.userId);

    logger.info('User followed successfully', { userId: user.userId, targetId }, 'POST /api/users/[userId]/follow');

    // Track user followed event
    trackServerEvent(user.userId, 'user_followed', {
      targetUserId: targetId,
      targetType: 'user',
      targetUsername: follow.following.username,
    }).catch((error) => {
      logger.warn('Failed to track user_followed event', { error });
    });

    return successResponse(
      {
        id: follow.id,
        following: follow.following,
        createdAt: follow.createdAt,
      },
      201
    );
  } else {
    // Target is an actor (NPC) - use UserActorFollow model
    const [existingUserActorFollow, legacyFollowStatus] = await Promise.all([
      prisma.userActorFollow.findUnique({
        where: {
          userId_actorId: {
            userId: user.userId,
            actorId: targetId,
          },
        },
      }),
      prisma.followStatus.findUnique({
        where: {
          userId_npcId: {
            userId: user.userId,
            npcId: targetId,
          },
        },
      }),
    ]);

    if (existingUserActorFollow) {
      throw new BusinessLogicError('Already following this actor', 'ALREADY_FOLLOWING');
    }

    const follow = await (legacyFollowStatus &&
      legacyFollowStatus.isActive &&
      legacyFollowStatus.followReason === 'user_followed'
      ? prisma.$transaction(async (tx) => {
          const created = await tx.userActorFollow.create({
            data: {
              userId: user.userId,
              actorId: targetId,
            },
            include: {
              actor: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  tier: true,
                  profileImageUrl: true,
                },
              },
            },
          });

          await tx.followStatus.update({
            where: { id: legacyFollowStatus.id },
            data: {
              isActive: false,
              unfollowedAt: new Date(),
            },
          });

          return created;
        })
      : prisma.userActorFollow.create({
          data: {
            userId: user.userId,
            actorId: targetId,
          },
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                description: true,
                tier: true,
                profileImageUrl: true,
              },
            },
          },
        }));

    logger.info('Actor followed successfully', { userId: user.userId, npcId: targetId }, 'POST /api/users/[userId]/follow');

    // Track actor followed event
    trackServerEvent(user.userId, 'user_followed', {
      targetUserId: targetId,
      targetType: 'actor',
      actorName: follow.actor.name,
      actorTier: follow.actor.tier,
    }).catch((error) => {
      logger.warn('Failed to track user_followed event', { error });
    });

    return successResponse(
      {
        id: follow.id,
        actor: follow.actor,
        createdAt: follow.createdAt,
      },
      201
    );
  }
});

/**
 * DELETE /api/users/[userId]/follow
 * Unfollow a user or actor
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const params = await context.params;
  const { userId: targetIdentifier } = UserIdParamSchema.parse(params);
  const targetUser = await findUserByIdentifier(targetIdentifier, { id: true });
  const targetId = targetUser?.id ?? targetIdentifier;

  if (targetUser) {
    // Target is a user - use Follow model
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: user.userId,
          followingId: targetId,
        },
      },
    });

    if (!follow) {
      throw new NotFoundError('Follow relationship', `${user.userId}-${targetId}`);
    }

    // Delete follow relationship
    await prisma.follow.delete({
      where: {
        id: follow.id,
      },
    });

    logger.info('User unfollowed successfully', { userId: user.userId, targetId }, 'DELETE /api/users/[userId]/follow');

    // Track user unfollowed event
    trackServerEvent(user.userId, 'user_unfollowed', {
      targetUserId: targetId,
      targetType: 'user',
    }).catch((error) => {
      logger.warn('Failed to track user_unfollowed event', { error });
    });

    return successResponse({
      message: 'Unfollowed successfully',
    });
  } else {
    // Target is an actor (NPC) - use UserActorFollow model (with legacy support)
    const [existingUserActorFollow, legacyFollowStatus] = await Promise.all([
      prisma.userActorFollow.findUnique({
        where: {
          userId_actorId: {
            userId: user.userId,
            actorId: targetId,
          },
        },
      }),
      prisma.followStatus.findUnique({
        where: {
          userId_npcId: {
            userId: user.userId,
            npcId: targetId,
          },
        },
      }),
    ]);

    const hasLegacyFollow =
      legacyFollowStatus &&
      legacyFollowStatus.isActive &&
      legacyFollowStatus.followReason === 'user_followed';

    if (!existingUserActorFollow && !hasLegacyFollow) {
      throw new NotFoundError('Follow status', `${user.userId}-${targetId}`);
    }

    await prisma.$transaction(async (tx) => {
      if (existingUserActorFollow) {
        await tx.userActorFollow.delete({
          where: { id: existingUserActorFollow.id },
        });
      }

      if (hasLegacyFollow && legacyFollowStatus) {
        await tx.followStatus.update({
          where: { id: legacyFollowStatus.id },
          data: {
            isActive: false,
            unfollowedAt: new Date(),
          },
        });
      }
    });

    logger.info('Actor unfollowed successfully', { userId: user.userId, npcId: targetId }, 'DELETE /api/users/[userId]/follow');

    // Track actor unfollowed event
    trackServerEvent(user.userId, 'user_unfollowed', {
      targetUserId: targetId,
      targetType: 'actor',
    }).catch((error) => {
      logger.warn('Failed to track user_unfollowed event', { error });
    });

    return successResponse({
      message: 'Unfollowed successfully',
    });
  }
});

/**
 * GET /api/users/[userId]/follow
 * Check if current user is following the target
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Optional authentication - if not authenticated, return false
  const authUser = await authenticate(request).catch(() => null);
  const params = await context.params;
  const { userId: targetId } = UserIdParamSchema.parse(params);

  if (!authUser) {
    return successResponse({ isFollowing: false });
  }

  // Check if target is a user
  const targetUser = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true },
  });

  if (targetUser) {
    // Target is a user - check Follow model
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: authUser.userId,
          followingId: targetId,
        },
      },
    });

    logger.info('Follow status checked', { userId: authUser.userId, targetId, isFollowing: !!follow }, 'GET /api/users/[userId]/follow');

    return successResponse({
      isFollowing: !!follow,
    });
  } else {
    // Target might be an actor (NPC) - check FollowStatus model
    const targetActor = await prisma.actor.findUnique({
      where: { id: targetId },
      select: { id: true },
    });

    if (targetActor) {
      const [userActorFollow, legacyFollowStatus] = await Promise.all([
        prisma.userActorFollow.findUnique({
          where: {
            userId_actorId: {
              userId: authUser.userId,
              actorId: targetId,
            },
          },
        }),
        prisma.followStatus.findUnique({
          where: {
            userId_npcId: {
              userId: authUser.userId,
              npcId: targetId,
            },
          },
        }),
      ]);

      const isFollowing =
        !!userActorFollow ||
        !!(
          legacyFollowStatus &&
          legacyFollowStatus.isActive &&
          legacyFollowStatus.followReason === 'user_followed'
        );
      logger.info('Actor follow status checked', { userId: authUser.userId, npcId: targetId, isFollowing }, 'GET /api/users/[userId]/follow');

      return successResponse({
        isFollowing,
      });
    } else {
      // Neither user nor actor found - return false for isFollowing
      // This prevents errors when checking follow status for non-existent profiles
      logger.info('Follow status checked for non-existent target', { userId: authUser.userId, targetId }, 'GET /api/users/[userId]/follow');

      return successResponse({
        isFollowing: false,
      });
    }
  }
});
