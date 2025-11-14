/**
 * Admin API: Create Notification
 * POST /api/admin/notifications
 * 
 * Send a notification to a specific user or all users
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { createNotification } from '@/lib/services/notification-service';
import { NotFoundError } from '@/lib/errors';

const CreateNotificationSchema = z.object({
  userId: z.string().optional(), // If not provided, send to all users
  message: z.string().min(1).max(500),
  type: z.enum(['system', 'comment', 'reaction', 'follow', 'mention', 'reply', 'share']).default('system'),
  postId: z.string().optional(),
  commentId: z.string().optional(),
  link: z.string().optional(), // Optional custom link
  sendToAll: z.boolean().default(false), // Send to all users
});

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  const adminUser = await requireAdmin(request);

  // Parse request body
  const body = await request.json();
  const { userId, message, type, postId, commentId, sendToAll } = CreateNotificationSchema.parse(body);

  logger.info('Admin creating notification', { 
    adminUserId: adminUser.userId,
    targetUserId: userId,
    sendToAll,
    type,
  }, 'POST /api/admin/notifications');

  if (sendToAll) {
    // Send notification to all users
    const users = await prisma.user.findMany({
      where: {
        isActor: false, // Don't send to NPCs/actors
        isBanned: false, // Don't send to banned users
      },
      select: {
        id: true,
      },
    });

    // Send notifications in batches to avoid overwhelming the database
    const batchSize = 50;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      await Promise.all(
        batch.map(user =>
          createNotification({
            userId: user.id,
            type,
            message,
            title: 'Notification',
            postId,
            commentId,
          }).catch(error => {
            logger.warn('Failed to send notification to user', { 
              error, 
              userId: user.id 
            }, 'POST /api/admin/notifications');
          })
        )
      );
    }

    logger.info('Admin notification sent to all users', { 
      adminUserId: adminUser.userId,
      userCount: users.length,
    }, 'POST /api/admin/notifications');

    return successResponse({
      success: true,
      message: `Notification sent to ${users.length} users`,
      recipientCount: users.length,
    });
  } else if (userId) {
    // Send notification to specific user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        isActor: true,
      },
    });

    if (!targetUser) {
      throw new NotFoundError('User', userId);
    }

    if (targetUser.isActor) {
      return successResponse({
        success: false,
        message: 'Cannot send notifications to game actors/NPCs',
      });
    }

    await createNotification({
      userId: targetUser.id,
      type,
      message,
      title: 'Notification',
      postId,
      commentId,
    });

    logger.info('Admin notification sent to user', { 
      adminUserId: adminUser.userId,
      targetUserId: userId,
      targetUsername: targetUser.username,
    }, 'POST /api/admin/notifications');

    return successResponse({
      success: true,
      message: `Notification sent to ${targetUser.displayName}`,
      recipient: {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.displayName,
      },
    });
  } else {
    return successResponse({
      success: false,
      message: 'Please provide a userId or set sendToAll to true',
    });
  }
});

