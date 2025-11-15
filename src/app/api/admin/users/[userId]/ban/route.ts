/**
 * Admin API: Ban/Unban User
 * POST /api/admin/users/[userId]/ban
 * 
 * Ban or unban a user
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';

const BanUserSchema = z.object({
  action: z.enum(['ban', 'unban']),
  reason: z.string().min(1).max(500).optional(),
  isScammer: z.boolean().optional(),
  isCSAM: z.boolean().optional(),
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
  const { action, reason, isScammer, isCSAM } = BanUserSchema.parse(body);

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
    throw new NotFoundError('User', userId);
  }

  // Prevent banning admins (unless you're banning yourself, which is allowed)
  if (targetUser.isAdmin && targetUser.id !== adminUser.userId) {
    throw new BusinessLogicError('Cannot ban other admins', 'CANNOT_BAN_ADMIN');
  }

  // Prevent banning NPCs/actors
  if (targetUser.isActor) {
    throw new BusinessLogicError('Cannot ban game actors', 'CANNOT_BAN_ACTOR');
  }

  // Update user ban status and flags
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      isBanned: action === 'ban',
      bannedAt: action === 'ban' ? new Date() : null,
      bannedReason: action === 'ban' ? reason : null,
      bannedBy: action === 'ban' ? adminUser.userId : null,
      isScammer: action === 'ban' ? (isScammer ?? false) : false,
      isCSAM: action === 'ban' ? (isCSAM ?? false) : false,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      isBanned: true,
      bannedAt: true,
      bannedReason: true,
      bannedBy: true,
      isScammer: true,
      isCSAM: true,
      agent0TokenId: true,
    },
  });

  // Sync with ERC-8004 reputation system via Agent0
  if (action === 'ban' && updatedUser.agent0TokenId) {
    try {
      const { syncReputationToERC8004 } = await import('@/lib/reputation/erc8004-sync');
      await syncReputationToERC8004(userId, {
        reputationScore: 0, // Banned users get 0 reputation
        isBanned: true,
        isScammer: isScammer ?? false,
        isCSAM: isCSAM ?? false,
      });
    } catch (error) {
      logger.error('Failed to sync ban to ERC-8004', {
        userId,
        agent0TokenId: updatedUser.agent0TokenId,
        error,
      }, 'POST /api/admin/users/[userId]/ban');
      // Don't fail the ban if sync fails, just log it
    }
  }

  // Invalidate reputation cache
  if (action === 'ban') {
    try {
      const { invalidateReputationCache } = await import('@/lib/reputation/agent0-reputation-cache');
      await invalidateReputationCache(userId);
    } catch (error) {
      logger.error('Failed to invalidate reputation cache', { userId, error }, 'POST /api/admin/users/[userId]/ban');
    }

    // Distribute points to successful reporters if CSAM/scammer
    if ((isScammer ?? false) || (isCSAM ?? false)) {
      try {
        const { distributePointsToReporters } = await import('@/lib/moderation/points-distribution');
        const reason = isCSAM ? 'csam' : 'scammer';
        await distributePointsToReporters(userId, reason);
      } catch (error) {
        logger.error('Failed to distribute points to reporters', { userId, error }, 'POST /api/admin/users/[userId]/ban');
        // Don't fail the ban if distribution fails
      }
    }
  }

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

