/**
 * User Mute API Route
 * POST /api/users/[userId]/mute
 * 
 * Mute or unmute a user
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';
import { MuteUserSchema } from '@/lib/validation/schemas/moderation';
import { logger } from '@/lib/logger';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { generateSnowflakeId } from '@/lib/snowflake';
import { Prisma } from '@prisma/client';

export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Authenticate the user
  const authUser = await authenticate(request);
  const { userId: targetUserId } = await context.params;

  // Parse request body
  let body: { action: string; reason?: string }
  try {
    body = await request.json() as { action: string; reason?: string }
  } catch (error) {
    logger.error('Failed to parse request body', { error, userId: authUser.userId, targetUserId }, 'POST /api/users/[userId]/mute')
    return NextResponse.json({
      success: false,
      error: 'Invalid request body'
    }, { status: 400 })
  }
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

  // Note: Muting NPCs is allowed - it hides their posts from your feed

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

    // Create mute - handle race condition where mute might be created concurrently
    let mute;
    try {
      mute = await prisma.userMute.create({
        data: {
          id: await generateSnowflakeId(),
          muterId: authUser.userId,
          mutedId: targetUserId,
          reason: reason || null,
        },
      });
    } catch (error: unknown) {
      // Handle unique constraint violation (race condition)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes('muterId') && target?.includes('mutedId')) {
          // Race condition: mute was created by another concurrent request
          // Fetch the existing mute and return success
          const raceConditionMute = await prisma.userMute.findUnique({
            where: {
              muterId_mutedId: {
                muterId: authUser.userId,
                mutedId: targetUserId,
              },
            },
          });
          
          if (raceConditionMute) {
            logger.info(`User muted successfully (race condition handled)`, { 
              userId: authUser.userId,
              targetUserId,
              muteId: raceConditionMute.id 
            }, 'POST /api/users/[userId]/mute');
            
            return successResponse({
              success: true,
              message: 'User muted successfully',
              mute: raceConditionMute,
            });
          }
        }
        // If we can't find the mute, throw the original error
        throw error;
      }
      // Re-throw other errors
      throw error;
    }

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


