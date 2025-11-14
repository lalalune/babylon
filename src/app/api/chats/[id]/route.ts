/**
 * API Route: /api/chats/[id]
 * Methods: GET (get chat details and messages)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { asUser, asSystem } from '@/lib/db/context'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import {  NotFoundError, AuthorizationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { ChatQuerySchema } from '@/lib/validation/schemas'

/**
 * GET /api/chats/[id]
 * Get chat details and messages
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: chatId } = await context.params

  // Validate query parameters
  const { searchParams } = new URL(request.url)
  const query: Record<string, string> = {}
  
  const all = searchParams.get('all')
  const debug = searchParams.get('debug')
  
  if (all) query.all = all
  if (debug) query.debug = debug
  
  const validatedQuery = ChatQuerySchema.parse(query)

  // Check for debug mode (localhost access to game chats)
  const debugMode = validatedQuery.debug === 'true'

  // Get chat first to check if it's a game chat
  const chat = await asSystem(async (db) => {
    return await db.chat.findUnique({
      where: { id: chatId },
    })
  })

  if (!chat) {
    throw new NotFoundError('Chat', chatId)
  }

  // Allow debug access to game chats without auth
  const isGameChat = chat.isGroup && chat.gameId === 'continuous'
  let userId: string | undefined
  let authUser: Awaited<ReturnType<typeof authenticate>> | null = null

  if (isGameChat && debugMode) {
    // Debug mode: skip authentication for game chats
    logger.info(`Debug mode access to game chat: ${chatId}`, undefined, 'GET /api/chats/[id]')
  } else {
    // Normal mode: require authentication and membership
    authUser = await authenticate(request)
    userId = authUser.userId

    const isMember = await asUser(authUser, async (db) => {
      return await db.chatParticipant.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: authUser!.userId,
          },
        },
      })
    })

    if (!isMember) {
      throw new AuthorizationError('You do not have access to this chat', 'chat', 'read')
    }
  }

  // Get chat with messages with RLS (use system for debug mode)
  const fullChat = await (authUser ? asUser(authUser, async (db) => {
    return await db.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100, // Limit to last 100 messages
        },
        participants: true,
      },
    })
  }) : asSystem(async (db) => {
    return await db.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
        participants: true,
      },
    })
  }))

  if (!fullChat) {
    throw new NotFoundError('Chat', chatId)
  }

  // Get participant details with RLS (use system for debug mode)
  const { users, actors } = await (authUser ? asUser(authUser, async (db) => {
    // Get participant details - need to check both users and actors
    const participantUserIds = fullChat.participants.map((p) => p.userId);
    const users = await db.user.findMany({
      where: {
        id: { in: participantUserIds },
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        profileImageUrl: true,
      },
    });

    // Get unique sender IDs from messages (for game chats, these are often actors)
    const senderIds = [...new Set(fullChat.messages.map(m => m.senderId))];
    const actors = await db.actor.findMany({
      where: {
        id: { in: senderIds },
      },
      select: {
        id: true,
        name: true,
        profileImageUrl: true,
      },
    });

    return { users, actors };
  }) : asSystem(async (db) => {
    const participantUserIds = fullChat.participants.map((p) => p.userId);
    const users = await db.user.findMany({
      where: {
        id: { in: participantUserIds },
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        profileImageUrl: true,
      },
    });

    const senderIds = [...new Set(fullChat.messages.map(m => m.senderId))];
    const actors = await db.actor.findMany({
      where: {
        id: { in: senderIds },
      },
      select: {
        id: true,
        name: true,
        profileImageUrl: true,
      },
    });

    return { users, actors };
  }));

    const usersMap = new Map(users.map((u) => [u.id, u]));
    const actorsMap = new Map(actors.map((a) => [a.id, a]));

    // Get unique sender IDs from messages (for debug mode)
    const senderIds = [...new Set(fullChat.messages.map(m => m.senderId))];

    // Build participants list from ChatParticipants or message senders (for debug mode)
    const participantsInfo = fullChat.participants.length > 0
      ? fullChat.participants.map((p) => {
          const user = usersMap.get(p.userId);
          const actor = actorsMap.get(p.userId);
          return {
            id: p.userId,
            displayName: user?.displayName || actor?.name || 'Unknown',
            username: user?.username,
            profileImageUrl: user?.profileImageUrl || actor?.profileImageUrl,
          };
        })
      : // In debug mode with no participants, use actors from messages
        senderIds.map(senderId => {
          const actor = actorsMap.get(senderId);
          const user = usersMap.get(senderId);
          return {
            id: senderId,
            displayName: actor?.name || user?.displayName || 'Unknown',
            username: user?.username,
            profileImageUrl: actor?.profileImageUrl || user?.profileImageUrl,
          };
        });

    // For DMs, get the other participant's name and details
    let displayName = fullChat.name;
    let otherUser = null;
    if (!fullChat.isGroup && !fullChat.name && userId) {
      const otherParticipant = fullChat.participants.find((p) => p.userId !== userId);
      if (otherParticipant) {
        const otherUserData = usersMap.get(otherParticipant.userId);
        if (otherUserData) {
          displayName = otherUserData.displayName || otherUserData.username || 'Unknown';
          otherUser = {
            id: otherParticipant.userId,
            displayName: otherUserData.displayName,
            username: otherUserData.username,
            profileImageUrl: otherUserData.profileImageUrl,
          };
        }
      }
    }

  logger.info('Chat fetched successfully', { 
    chatId, 
    isGameChat, 
    isDM: !fullChat.isGroup,
    debugMode 
  }, 'GET /api/chats/[id]')

  return successResponse({
    chat: {
      id: fullChat.id,
      name: displayName || fullChat.name,
      isGroup: fullChat.isGroup,
      createdAt: fullChat.createdAt,
      updatedAt: fullChat.updatedAt,
      otherUser: otherUser,
    },
    messages: fullChat.messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      senderId: msg.senderId,
      createdAt: msg.createdAt,
    })),
    participants: participantsInfo,
  })
})

