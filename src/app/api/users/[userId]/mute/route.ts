/**
 * User Mute API Route
 * POST /api/users/[userId]/mute
 * 
 * Mute or unmute a user
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { MuteUserSchema } from '@/lib/validation/schemas/moderation';
import { logger } from '@/lib/logger';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { generateSnowflakeId } from '@/lib/snowflake';

export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Authenticate the user
  const authUser = await authenticate(request);
  const { userId: targetUserId } = await context.params;

  // Parse request body
  const body = await request.json();
  const { action, reason } = MuteUserSchema.parse(body);

  logger.info(`User ${action} request`, { 
    userId: authUser.userId,
    targetUserId,
    action 
  }, 'POST /api/users/[userId]/mute');

  // Cannot mute yourself
  if (authUser.userId === targetUserId) {
    throw new BusinessLogicError('Cannot mute yourself', 'CANNOT_MUTE_SELF');
  }

  // Check if target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, username: true, displayName: true, isActor: true },
  });

  if (!targetUser) {
    throw new NotFoundError('User', targetUserId);
  }

  // Cannot mute actors/NPCs
  if (targetUser.isActor) {
    throw new BusinessLogicError('Cannot mute NPCs', 'CANNOT_MUTE_ACTOR');
  }

  if (action === 'mute') {
    // Check if already muted
    const existingMute = await prisma.userMute.findUnique({
      where: {
        muterId_mutedId: {
          muterId: authUser.userId,
          mutedId: targetUserId,
        },
      },
    });

    if (existingMute) {
      throw new BusinessLogicError('User is already muted', 'ALREADY_MUTED');
    }

    // Create mute
    const mute = await prisma.userMute.create({
      data: {
        id: await generateSnowflakeId(),
        muterId: authUser.userId,
        mutedId: targetUserId,
        reason: reason || null,
      },
    });

    logger.info(`User muted successfully`, { 
      userId: authUser.userId,
      targetUserId,
      muteId: mute.id 
    }, 'POST /api/users/[userId]/mute');

    return successResponse({
      success: true,
      message: 'User muted successfully',
      mute,
    });
  } else {
    // Unmute
    const deleted = await prisma.userMute.deleteMany({
      where: {
        muterId: authUser.userId,
        mutedId: targetUserId,
      },
    });

    if (deleted.count === 0) {
      throw new BusinessLogicError('User is not muted', 'NOT_MUTED');
    }

    logger.info(`User unmuted successfully`, { 
      userId: authUser.userId,
      targetUserId 
    }, 'POST /api/users/[userId]/mute');

    return successResponse({
      success: true,
      message: 'User unmuted successfully',
    });
  }
});

/**
 * GET /api/users/[userId]/mute
 * Check if current user has muted the target user
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  const authUser = await authenticate(request);
  const { userId: targetUserId } = await context.params;

  const mute = await prisma.userMute.findUnique({
    where: {
      muterId_mutedId: {
        muterId: authUser.userId,
        mutedId: targetUserId,
      },
    },
    select: {
      id: true,
      createdAt: true,
      reason: true,
    },
  });

  return successResponse({
    isMuted: !!mute,
    mute,
  });
});


