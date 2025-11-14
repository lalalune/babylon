/**
 * API Route: /api/groups/[groupId]/members
 * Methods: POST (add member), DELETE (remove member)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { ApiError } from '@/lib/errors/api-errors'
import { logger } from '@/lib/logger'
import { asUser } from '@/lib/db/context'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { notifyUserGroupInvite } from '@/lib/services/notification-service'

const AddMemberSchema = z.object({
  userId: z.string(),
})

/**
 * POST /api/groups/[groupId]/members
 * Add a member to the group (admin only)
 */
export const POST = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) => {
    const user = await authenticate(request)
    const { groupId } = await params
    const body = await request.json()
    const data = AddMemberSchema.parse(body)

    let groupName = 'Unknown'
    let inviteId = ''

    await asUser(user, async (db) => {
      // Check if user is admin
      const isAdmin = await db.userGroupAdmin.findFirst({
        where: {
          groupId,
          userId: user.userId,
        },
      })

      if (!isAdmin) {
        throw new ApiError('Only group admins can add members', 403)
      }

      // Check if user is already a member
      const existingMember = await db.userGroupMember.findFirst({
        where: {
          groupId,
          userId: data.userId,
        },
      })

      if (existingMember) {
        throw new ApiError('User is already a member of this group', 400)
      }

      // Check if there's already a pending invite
      const existingInvite = await db.userGroupInvite.findFirst({
        where: {
          groupId,
          invitedUserId: data.userId,
          status: 'pending',
        },
      })

      if (existingInvite) {
        throw new ApiError('User already has a pending invite', 400)
      }

      // Get group details for notification
      const group = await db.userGroup.findUnique({
        where: { id: groupId },
        select: { name: true },
      })
      groupName = group?.name || 'Unknown'

      // Create invite
      inviteId = nanoid()
      await db.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId,
          invitedUserId: data.userId,
          invitedBy: user.userId,
          status: 'pending',
          invitedAt: new Date(),
        },
      })
    })

    // Send notification to the invited user (outside of asUser context)
    await notifyUserGroupInvite(
      data.userId,
      user.userId,
      groupId,
      groupName,
      inviteId
    )

    logger.info(
      'Member added to group',
      { userId: user.userId, groupId, newMemberId: data.userId },
      'POST /api/groups/:groupId/members'
    )

    return successResponse({ success: true })
  }
)

/**
 * DELETE /api/groups/[groupId]/members
 * Remove a member from the group (admin only or self)
 */
export const DELETE = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) => {
    const user = await authenticate(request)
    const { groupId } = await params
    const { searchParams } = new URL(request.url)
    const userIdToRemove = searchParams.get('userId')

    if (!userIdToRemove) {
      throw new ApiError('userId parameter is required', 400)
    }

    await asUser(user, async (db) => {
      // Check if user is admin or removing themselves
      const isAdmin = await db.userGroupAdmin.findFirst({
        where: {
          groupId,
          userId: user.userId,
        },
      })

      const isSelf = user.userId === userIdToRemove

      if (!isAdmin && !isSelf) {
        throw new ApiError('Only group admins can remove members', 403)
      }

      // Cannot remove the creator
      const group = await db.userGroup.findUnique({
        where: { id: groupId },
      })

      if (group?.createdById === userIdToRemove) {
        throw new ApiError('Cannot remove the group creator', 400)
      }

      // Remove member
      await db.userGroupMember.deleteMany({
        where: {
          groupId,
          userId: userIdToRemove,
        },
      })

      // Also remove admin status if they have it
      await db.userGroupAdmin.deleteMany({
        where: {
          groupId,
          userId: userIdToRemove,
        },
      })

      // Remove from associated chat
      const chat = await db.chat.findFirst({
        where: {
          groupId: groupId,
          isGroup: true,
        },
      })

      if (chat) {
        await db.chatParticipant.deleteMany({
          where: {
            chatId: chat.id,
            userId: userIdToRemove,
          },
        })
      }
    })

    logger.info(
      'Member removed from group',
      { userId: user.userId, groupId, removedUserId: userIdToRemove },
      'DELETE /api/groups/:groupId/members'
    )

    return successResponse({ success: true })
  }
)

