/**
 * API Route: /api/profiles/[id]/favorite
 * Methods: POST (favorite), DELETE (unfavorite)
 */

import {
  authenticate,
  successResponse
} from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import { IdParamSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';

/**
 * POST /api/profiles/[id]/favorite
 * Favorite a profile
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const params = await context.params;
  const { id: targetIdentifier } = IdParamSchema.parse(params);

  // Favorite profile with RLS
  const { favorite, targetUserId } = await asUser(user, async (db) => {
    // Try to find user by ID first, then by username
    let targetUser = await db.user.findUnique({
      where: { id: targetIdentifier },
    });

    // If not found by ID, try username
    if (!targetUser) {
      targetUser = await db.user.findUnique({
        where: { username: targetIdentifier },
      });
    }

    if (!targetUser) {
      throw new NotFoundError('Profile', targetIdentifier);
    }

    const targetUserId = targetUser.id;

    // Prevent self-favoriting
    if (user.userId === targetUserId) {
      throw new BusinessLogicError('Cannot favorite yourself', 'SELF_FAVORITE_NOT_ALLOWED');
    }

    // Check if already favorited
    const existingFavorite = await db.favorite.findUnique({
      where: {
        userId_targetUserId: {
          userId: user.userId,
          targetUserId,
        },
      },
    });

    if (existingFavorite) {
      throw new BusinessLogicError('Profile already favorited', 'ALREADY_FAVORITED');
    }

    // Create favorite
    const fav = await db.favorite.create({
      data: {
        id: await generateSnowflakeId(),
        userId: user.userId,
        targetUserId,
      },
      include: {
        User_Favorite_targetUserIdToUser: {
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

    return { favorite: fav, targetUserId };
  });

  logger.info('Profile favorited successfully', { userId: user.userId, targetUserId }, 'POST /api/profiles/[id]/favorite');

  return successResponse(
    {
      id: favorite.id,
      targetUser: favorite.User_Favorite_targetUserIdToUser,
      createdAt: favorite.createdAt,
    },
    201
  );
});

/**
 * DELETE /api/profiles/[id]/favorite
 * Unfavorite a profile
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const params = await context.params;
  const { id: targetIdentifier } = IdParamSchema.parse(params);

  // Unfavorite profile with RLS
  const targetUserId = await asUser(user, async (db) => {
    // Try to find user by ID first, then by username
    let targetUser = await db.user.findUnique({
      where: { id: targetIdentifier },
    });

    // If not found by ID, try username
    if (!targetUser) {
      targetUser = await db.user.findUnique({
        where: { username: targetIdentifier },
      });
    }

    if (!targetUser) {
      throw new NotFoundError('Profile', targetIdentifier);
    }

    const targetUserId = targetUser.id;

    // Find existing favorite
    const favorite = await db.favorite.findUnique({
      where: {
        userId_targetUserId: {
          userId: user.userId,
          targetUserId,
        },
      },
    });

    if (!favorite) {
      throw new NotFoundError('Favorite', `${user.userId}-${targetUserId}`);
    }

    // Delete favorite
    await db.favorite.delete({
      where: {
        id: favorite.id,
      },
    });

    return targetUserId;
  });

  logger.info('Profile unfavorited successfully', { userId: user.userId, targetUserId }, 'DELETE /api/profiles/[id]/favorite');

  return successResponse({ message: 'Profile unfavorited successfully' });
});
