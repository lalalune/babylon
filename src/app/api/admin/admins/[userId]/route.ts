/**
 * Admin Management API: Promote/Demote Admin
 * POST /api/admin/admins/[userId]
 * 
 * Promote a user to admin or demote an admin to regular user
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';

const AdminActionSchema = z.object({
  action: z.enum(['promote', 'demote']),
});

export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Require admin authentication
  const adminUser = await requireAdmin(request);

  // Parse params
  const { userId } = await context.params;

  // Parse request body
  const body = await request.json();
  const { action } = AdminActionSchema.parse(body);

  logger.info(`Admin ${action} request`, { 
    adminUserId: adminUser.userId,
    targetUserId: userId,
    action,
  }, 'POST /api/admin/admins/[userId]');

  // Get target user
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      isActor: true,
      isAdmin: true,
      isBanned: true,
    },
  });

  if (!targetUser) {
    throw new NotFoundError('User', userId);
  }

  // Prevent modifying NPC/actors
  if (targetUser.isActor) {
    throw new BusinessLogicError('Cannot modify admin status of game actors', 'CANNOT_MODIFY_ACTOR');
  }

  // Prevent modifying banned users
  if (targetUser.isBanned) {
    throw new BusinessLogicError('Cannot modify admin status of banned users', 'USER_BANNED');
  }

  // Validate action makes sense
  if (action === 'promote' && targetUser.isAdmin) {
    throw new BusinessLogicError('User is already an admin', 'ALREADY_ADMIN');
  }

  if (action === 'demote' && !targetUser.isAdmin) {
    throw new BusinessLogicError('User is not an admin', 'NOT_ADMIN');
  }

  // Prevent demoting yourself
  if (action === 'demote' && targetUser.id === adminUser.userId) {
    throw new BusinessLogicError('Cannot demote yourself', 'CANNOT_DEMOTE_SELF');
  }

  // Update user admin status
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isAdmin: action === 'promote',
      updatedAt: new Date(),
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      walletAddress: true,
      profileImageUrl: true,
      isAdmin: true,
      onChainRegistered: true,
      hasFarcaster: true,
      hasTwitter: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info(`User ${action}d successfully`, {
    adminUserId: adminUser.userId,
    targetUserId: userId,
    targetUsername: updatedUser.username,
    action,
  }, 'POST /api/admin/admins/[userId]');

  return successResponse({
    message: `User ${action}d successfully`,
    user: updatedUser,
    action,
  });
});


