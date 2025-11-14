/**
 * API Route: /api/chats/unread-count
 * Methods: GET (efficiently check for unread/pending messages)
 * 
 * Lightweight endpoint for polling - returns counts only, no chat data
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';

/**
 * GET /api/chats/unread-count
 * Get counts of pending DMs and unread messages
 * 
 * Returns:
 * - pendingDMs: Number of DM requests from anons awaiting acceptance
 * - hasNewMessages: Boolean indicating if there are any new messages
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request)

  const counts = await asUser(user, async (db) => {
    let pendingDMCount = 0
    pendingDMCount = await db.dMAcceptance.count({
      where: {
        userId: user.userId,
        status: 'pending',
      },
    })

    const chatsWithParticipation = await db.chatParticipant.findMany({
      where: {
        userId: user.userId,
      },
      select: {
        chatId: true,
      },
    })

    const chatIds = chatsWithParticipation.map(cp => cp.chatId)

    let recentMessageCount = 0
    recentMessageCount = await db.message.count({
      where: {
        chatId: {
          in: chatIds,
        },
        senderId: {
          not: user.userId,
        },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      take: 1,
    })

    return {
      pendingDMs: pendingDMCount,
      hasNewMessages: recentMessageCount > 0,
    }
  })

  return successResponse(counts)
})

