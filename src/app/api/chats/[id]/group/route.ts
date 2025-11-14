/**
 * API Route: /api/chats/[id]/group
 * Methods: GET (get group ID for a chat)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { ApiError } from '@/lib/errors/api-errors'
import { logger } from '@/lib/logger'
import { asUser } from '@/lib/db/context'

/**
 * GET /api/chats/[id]/group
 * Get the group ID associated with a chat
 */
export const GET = withErrorHandling(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const user = await authenticate(request)
    const { id: chatId } = await params

    const groupId = await asUser(user, async (db) => {
      // Check if user is a participant in the chat
      const participant = await db.chatParticipant.findFirst({
        where: {
          chatId,
          userId: user.userId,
        },
      })

      if (!participant) {
        throw new ApiError('You are not a participant in this chat', 403)
      }

      // Get the chat and its groupId
      const chat = await db.chat.findUnique({
        where: { id: chatId },
        select: { groupId: true, isGroup: true },
      })

      if (!chat) {
        throw new ApiError('Chat not found', 404)
      }

      if (!chat.isGroup || !chat.groupId) {
        throw new ApiError('This chat is not associated with a group', 400)
      }

      return chat.groupId
    })

    logger.info('Group ID retrieved from chat', { userId: user.userId, chatId, groupId }, 'GET /api/chats/:id/group')

    return successResponse({ groupId })
  }
)

