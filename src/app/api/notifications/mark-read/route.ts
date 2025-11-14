/**
 * Mark Notifications as Read API
 * 
 * Mark one or more notifications as read/acknowledged
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { z } from 'zod';

const markReadSchema = z.object({
  notificationIds: z.array(z.string()).optional(),
  type: z.string().optional(), // Mark all notifications of a specific type as read
  markAll: z.boolean().optional(), // Mark all notifications as read
});

/**
 * POST /api/notifications/mark-read
 * Mark notifications as read
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);
  const body = await request.json();
  const { notificationIds, type, markAll } = markReadSchema.parse(body);

  if (markAll) {
    // Mark all notifications as read
    await prisma.notification.updateMany({
      where: {
        userId: user.userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return successResponse({
      data: {
        message: 'All notifications marked as read',
      },
    });
  }

  if (type) {
    // Mark all notifications of a specific type as read
    await prisma.notification.updateMany({
      where: {
        userId: user.userId,
        type,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return successResponse({
      data: {
        message: `All ${type} notifications marked as read`,
      },
    });
  }

  if (notificationIds && notificationIds.length > 0) {
    // Mark specific notifications as read
    await prisma.notification.updateMany({
      where: {
        id: {
          in: notificationIds,
        },
        userId: user.userId, // Ensure user owns these notifications
      },
      data: {
        read: true,
      },
    });

    return successResponse({
      data: {
        message: `${notificationIds.length} notification(s) marked as read`,
      },
    });
  }

  return successResponse({
    data: {
      message: 'No notifications to mark',
    },
  });
});

