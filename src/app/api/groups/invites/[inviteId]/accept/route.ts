/**
 * API Route: /api/groups/invites/[inviteId]/accept
 * Methods: POST (accept a group invite)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { ApiError } from '@/lib/errors/api-errors'
import { logger } from '@/lib/logger'
import { asUser } from '@/lib/db/context'
import { nanoid } from 'nanoid'

/**
 * POST /api/groups/invites/[inviteId]/accept
 * Accept a group invitation
 */
export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ inviteId: string }> }) => {
    const user = await authenticate(request)
    const { inviteId } = await params

    const result = await asUser(user, async (db) => {
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

      // Check if user is already a member
      const existingMember = await db.userGroupMember.findFirst({
        where: {
          groupId: invite.groupId,
          userId: user.userId,
        },
      })

      if (existingMember) {
        // Update invite status and return
        await db.userGroupInvite.update({
          where: { id: inviteId },
          data: {
            status: 'accepted',
            respondedAt: new Date(),
          },
        })
        throw new ApiError('You are already a member of this group', 400)
      }

      // Add user as member
      await db.userGroupMember.create({
        data: {
          id: nanoid(),
          groupId: invite.groupId,
          userId: user.userId,
          addedBy: invite.invitedBy,
          joinedAt: new Date(),
        },
      })

      // Add to associated chat
      const chat = await db.chat.findFirst({
        where: {
          groupId: invite.groupId,
          isGroup: true,
        },
      })

      if (chat) {
        await db.chatParticipant.create({
          data: {
            id: nanoid(),
            chatId: chat.id,
            userId: user.userId,
            joinedAt: new Date(),
          },
        })
      }

      // Update invite status
      await db.userGroupInvite.update({
        where: { id: inviteId },
        data: {
          status: 'accepted',
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

      return {
        groupId: invite.groupId,
        chatId: chat?.id,
      }
    })

    logger.info('Group invite accepted', { userId: user.userId, inviteId }, 'POST /api/groups/invites/:inviteId/accept')

    return successResponse(result)
  }
)

