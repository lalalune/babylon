/**
 * Admin API: Ban/Unban User
 * POST /api/admin/users/[userId]/ban
 * 
 * Ban or unban a user
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';

const BanUserSchema = z.object({
  action: z.enum(['ban', 'unban']),
  reason: z.string().min(1).max(500).optional(),
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
  const { action, reason } = BanUserSchema.parse(body);

  logger.info(`Admin ${action} user request`, { 
    adminUserId: adminUser.userId,
    targetUserId: userId,
    action,
    reason 
  }, 'POST /api/admin/users/[userId]/ban');

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
    throw new NotFoundError('User not found', 'user');
  }

  // Prevent banning admins (unless you're banning yourself, which is allowed)
  if (targetUser.isAdmin && targetUser.id !== adminUser.userId) {
    throw new BusinessLogicError('Cannot ban other admins', 'CANNOT_BAN_ADMIN');
  }

  // Prevent banning NPCs/actors
  if (targetUser.isActor) {
    throw new BusinessLogicError('Cannot ban game actors', 'CANNOT_BAN_ACTOR');
  }

  // Update user ban status
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: action === 'ban',
      bannedAt: action === 'ban' ? new Date() : null,
      bannedReason: action === 'ban' ? reason : null,
      bannedBy: action === 'ban' ? adminUser.userId : null,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      isBanned: true,
      bannedAt: true,
      bannedReason: true,
      bannedBy: true,
    },
  });

  logger.info(`User ${action} successful`, { 
    adminUserId: adminUser.userId,
    targetUserId: userId,
    targetUsername: targetUser.username,
    action 
  }, 'POST /api/admin/users/[userId]/ban');

  return successResponse({
    success: true,
    user: updatedUser,
    message: action === 'ban' ? 'User banned successfully' : 'User unbanned successfully',
  });
});

