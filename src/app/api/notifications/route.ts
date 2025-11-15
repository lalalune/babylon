/**
 * User Notifications API
 * 
 * @route GET /api/notifications - Get user notifications
 * @route PATCH /api/notifications - Mark notifications as read
 * @access Authenticated
 * 
 * @description
 * Manages user notifications for social interactions, mentions, trades,
 * and system events. Supports filtering, pagination, and batch read marking.
 * Optimized for high-frequency polling with short TTL caching.
 * 
 * **Notification Types:**
 * - **mention:** User mentioned in post/comment (@username)
 * - **reply:** Comment reply to user's post/comment
 * - **like:** Post/comment liked by another user
 * - **follow:** New follower
 * - **trade:** Trade execution or settlement
 * - **system:** System announcements and alerts
 * 
 * **GET - Retrieve Notifications**
 * 
 * Returns paginated notifications with actor (sender) details and metadata.
 * Results are cached for 10 seconds to balance freshness with performance.
 * 
 * @query {number} limit - Notifications per page (1-100, default: 50)
 * @query {number} page - Page number (default: 1, currently not implemented)
 * @query {boolean} unreadOnly - Show only unread notifications
 * @query {string} type - Filter by notification type
 * 
 * **Notification Object:**
 * @property {string} id - Notification ID
 * @property {string} type - Notification type
 * @property {string} actorId - User who triggered notification
 * @property {object} actor - Actor profile details
 * @property {string} postId - Related post ID (if applicable)
 * @property {string} commentId - Related comment ID (if applicable)
 * @property {string} message - Notification message
 * @property {boolean} read - Read status
 * @property {string} createdAt - ISO timestamp
 * 
 * @returns {object} Notifications response
 * @property {array} notifications - Array of notification objects
 * @property {number} unreadCount - Total unread notifications
 * 
 * **PATCH - Mark Notifications as Read**
 * 
 * Marks specific notifications or all notifications as read.
 * Automatically invalidates cached notifications after update.
 * 
 * @param {array} notificationIds - Array of notification IDs to mark (optional)
 * @param {boolean} markAllAsRead - Mark all notifications as read (optional)
 * 
 * **Note:** Must provide either `notificationIds` array or `markAllAsRead: true`
 * 
 * @returns {object} Success response
 * @property {boolean} success - Operation success
 * @property {string} message - Confirmation message
 * 
 * @throws {400} Invalid request (missing both parameters)
 * @throws {401} Unauthorized - authentication required
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Get unread notifications
 * const response = await fetch('/api/notifications?unreadOnly=true&limit=20', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { notifications, unreadCount } = await response.json();
 * 
 * // Display notifications
 * notifications.forEach(notif => {
 *   console.log(`${notif.actor.displayName}: ${notif.message}`);
 * });
 * 
 * // Mark specific notifications as read
 * await fetch('/api/notifications', {
 *   method: 'PATCH',
 *   body: JSON.stringify({
 *     notificationIds: ['id1', 'id2', 'id3']
 *   })
 * });
 * 
 * // Mark all as read
 * await fetch('/api/notifications', {
 *   method: 'PATCH',
 *   body: JSON.stringify({
 *     markAllAsRead: true
 *   })
 * });
 * ```
 * 
 * @see {@link /lib/services/notification-service} Notification creation
 * @see {@link /lib/cache-service} Caching layer
 * @see {@link /src/components/NotificationBell.tsx} Notification UI
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { InternalServerError } from '@/lib/errors';
import { NotificationsQuerySchema, MarkNotificationsReadSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { getCacheOrFetch, invalidateCachePattern, CACHE_KEYS } from '@/lib/cache-service';
import { getBlockedUserIds, getMutedUserIds, getBlockedByUserIds } from '@/lib/moderation/filters';

/**
 * GET /api/notifications - Get user notifications
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams: Record<string, string> = {};
  
  const limit = searchParams.get('limit');
  const page = searchParams.get('page');
  const unreadOnly = searchParams.get('unreadOnly');
  const type = searchParams.get('type');
  
  if (limit) queryParams.limit = limit;
  if (page) queryParams.page = page;
  if (unreadOnly) queryParams.unreadOnly = unreadOnly;
  if (type) queryParams.type = type;
  
  const validated = NotificationsQuerySchema.parse(queryParams);
  const { limit: validatedLimit, unreadOnly: validatedUnreadOnly, type: validatedType } = validated;

  const where: {
    userId: string
    read?: boolean
    type?: string
  } = {
    userId: authUser.userId,
  };

  if (validatedUnreadOnly) {
    where.read = false;
  }

  if (validatedType) {
    where.type = validatedType;
  }

  // OPTIMIZED: Cache notifications with short TTL (high-frequency polling endpoint)
  const cacheKey = `notifications:${authUser.userId}:${JSON.stringify(where)}:${validatedLimit}`;
  
  // Get blocked/muted user IDs to filter notifications
  const [blockedIds, mutedIds, blockedByIds] = await Promise.all([
    getBlockedUserIds(authUser.userId),
    getMutedUserIds(authUser.userId),
    getBlockedByUserIds(authUser.userId),
  ]);
  
  const excludedUserIds = new Set([...blockedIds, ...mutedIds, ...blockedByIds]);

  const { notifications, unreadCount } = await getCacheOrFetch(
    cacheKey,
    async () => {
      return await asUser(authUser, async (db) => {
        const allNotifications = await db.notification.findMany({
          where,
          orderBy: {
            createdAt: 'desc',
          },
          take: validatedLimit * 2, // Fetch more to account for filtering
          include: {
            User_Notification_actorIdToUser: {
              select: {
                id: true,
                displayName: true,
                username: true,
                profileImageUrl: true,
              },
            },
          },
        });

        // Filter out notifications from blocked/muted users
        const notifications = allNotifications
          .filter(n => !n.actorId || !excludedUserIds.has(n.actorId))
          .slice(0, validatedLimit); // Limit to requested amount after filtering

        const unreadCount = await db.notification.count({
          where: {
            userId: authUser.userId,
            read: false,
          },
        });

        return { notifications, unreadCount };
      });
    },
    {
      namespace: CACHE_KEYS.USER,
      ttl: 10, // 10 second cache (high-frequency endpoint, needs to be fresh)
    }
  );

  logger.info('Notifications fetched successfully', { userId: authUser.userId, count: notifications.length, unreadCount }, 'GET /api/notifications');

  return successResponse({
    notifications: notifications.map((n: typeof notifications[number]) => {
      // Helper to safely convert any value to string (handles cached data)
      const toSafeString = (value: unknown): string => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return String(value);
        if (typeof value === 'boolean') return String(value);
        if (typeof value === 'object' && 'toString' in value) {
          try {
            return (value as { toString: () => string }).toString();
          } catch {
            return String(value);
          }
        }
        return String(value);
      };

      // Handle createdAt safely - it could be Date (from DB/memory cache) or string (from Redis cache)
      let createdAtISO: string;
      if (n.createdAt instanceof Date) {
        createdAtISO = n.createdAt.toISOString();
      } else if (typeof n.createdAt === 'string') {
        createdAtISO = n.createdAt;
      } else {
        // Fallback: try to convert to Date then to ISO string
        try {
          const dateValue = n.createdAt as string | number | Date
          createdAtISO = new Date(dateValue).toISOString();
        } catch {
          createdAtISO = new Date().toISOString();
        }
      }

      return {
        id: toSafeString(n.id),
        type: toSafeString(n.type),
        actorId: toSafeString(n.actorId),
        actor: n.User_Notification_actorIdToUser ? {
          id: toSafeString(n.User_Notification_actorIdToUser.id),
          displayName: toSafeString(n.User_Notification_actorIdToUser.displayName),
          username: toSafeString(n.User_Notification_actorIdToUser.username),
          profileImageUrl: toSafeString(n.User_Notification_actorIdToUser.profileImageUrl),
        } : null,
        postId: n.postId ? toSafeString(n.postId) : null,
        commentId: n.commentId ? toSafeString(n.commentId) : null,
        message: toSafeString(n.message),
        read: Boolean(n.read),
        createdAt: createdAtISO,
      };
    }),
    unreadCount,
  });
});

/**
 * PATCH /api/notifications - Mark notifications as read
 */
export const PATCH = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);

  // Parse and validate request body
  let body: { notificationIds?: string[]; markAllAsRead?: boolean }
  try {
    body = await request.json() as { notificationIds?: string[]; markAllAsRead?: boolean }
  } catch (error) {
    logger.error('Failed to parse request body', { error }, 'PATCH /api/notifications')
    return NextResponse.json({
      success: false,
      error: 'Invalid request body'
    }, { status: 400 })
  }
  const { notificationIds, markAllAsRead } = MarkNotificationsReadSchema.parse(body);

  await asUser(authUser, async (db) => {
    if (markAllAsRead) {
      // Mark all notifications as read
      await db.notification.updateMany({
        where: {
          userId: authUser.userId,
          read: false,
        },
        data: {
          read: true,
        },
      });

      // Invalidate notification cache after update
      await invalidateCachePattern(`notifications:${authUser.userId}:*`, { namespace: CACHE_KEYS.USER });

      logger.info('All notifications marked as read', { userId: authUser.userId }, 'PATCH /api/notifications');
      return;
    }

    if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      await db.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: authUser.userId, // Ensure user owns these notifications
        },
        data: {
          read: true,
        },
      });

      // Invalidate notification cache after update
      await invalidateCachePattern(`notifications:${authUser.userId}:*`, { namespace: CACHE_KEYS.USER });

      logger.info('Notifications marked as read', { userId: authUser.userId, count: notificationIds.length }, 'PATCH /api/notifications');
      return;
    }
  });

  if (markAllAsRead) {
    return successResponse({ success: true, message: 'All notifications marked as read' });
  }

  if (notificationIds && notificationIds.length > 0) {
    return successResponse({ success: true, message: 'Notifications marked as read' });
  }

  // This should not happen due to schema validation, but handle gracefully
  throw new InternalServerError('Invalid request: provide notificationIds array or markAllAsRead=true');
});


