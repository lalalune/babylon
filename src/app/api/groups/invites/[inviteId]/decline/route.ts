/**
 * API Route: /api/groups/invites/[inviteId]/decline
 * Methods: POST (decline a group invite)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { ApiError } from '@/lib/errors/api-errors'
import { logger } from '@/lib/logger'
import { asUser } from '@/lib/db/context'

/**
 * POST /api/groups/invites/[inviteId]/decline
 * Decline a group invitation
 */
export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) => {
    const user = await authenticate(request)
    const { inviteId } = await params

    await asUser(user, async (db) => {
      // Get the invite
      const invite = await db.userGroupInvite.findUnique({
        where: { id: inviteId },
      })

      if (!invite) {
        throw new ApiError('Invite not found', 404)
      }

      if (invite.invitedUserId !== user.userId) {
        throw new ApiError('This invite is not for you', 403)
      }

      if (invite.status !== 'pending') {
        throw new ApiError('This invite has already been processed', 400)
      }

      // Update invite status
      await db.userGroupInvite.update({
        where: { id: inviteId },
        data: {
          status: 'declined',
          respondedAt: new Date(),
        },
      })

      // Mark notification as read
      await db.notification.updateMany({
        where: {
          userId: user.userId,
          type: 'group_invite',
        },
        data: {
          read: true,
        },
      })
    })

    logger.info('Group invite declined', { userId: user.userId, inviteId }, 'POST /api/groups/invites/:inviteId/decline')

    return successResponse({ success: true })
  }
)

