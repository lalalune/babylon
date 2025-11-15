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
  const cursor = searchParams.get('cursor') // Cursor for pagination (message ID)
  const limitParam = searchParams.get('limit')
  
  if (all) query.all = all
  if (debug) query.debug = debug
  
  const validatedQuery = ChatQuerySchema.parse(query)
  
  // Parse pagination parameters
  const limit = limitParam ? parseInt(limitParam, 10) : 50
  const effectiveLimit = Math.min(Math.max(limit, 1), 100) // Between 1 and 100

  // Check for debug mode (localhost access to game chats)
  const debugMode = validatedQuery.debug === 'true'
  
  logger.info('GET /api/chats/[id]', { 
    chatId, 
    cursor, 
    limit: effectiveLimit,
    debugMode 
  }, 'GET /api/chats/[id]');

  // Get chat first to check if it's a game chat
  const chat = await asSystem(async (db) => {
    return await db.chat.findUnique({
      where: { id: chatId },
    })
  }, 'get-chat-by-id')

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

  // Build message query with cursor-based pagination
  const messageQuery: {
    orderBy: { createdAt: 'desc' }
    take: number
    cursor?: { id: string }
    skip?: number
  } = {
    orderBy: { createdAt: 'desc' }, // Get newest first
    take: effectiveLimit + 1, // Take one extra to check if there are more
  }
  
  // If cursor provided, get messages older than the cursor
  if (cursor) {
    messageQuery.cursor = { id: cursor }
    messageQuery.skip = 1 // Skip the cursor itself
  }

  // Get chat with messages with RLS (use system for debug mode)
  const fullChat = await (authUser ? asUser(authUser, async (db) => {
    return await db.chat.findUnique({
      where: { id: chatId },
      include: {
        Message: messageQuery,
        ChatParticipant: true,
      },
    })
  }) : asSystem(async (db) => {
    return await db.chat.findUnique({
      where: { id: chatId },
      include: {
        Message: messageQuery,
        ChatParticipant: true,
      },
    })
  }, 'get-chat-with-messages-debug'))

  if (!fullChat) {
    throw new NotFoundError('Chat', chatId)
  }

  // Get participant details with RLS (use system for debug mode)
  const { users, actors } = await (authUser ? asUser(authUser, async (db) => {
    // Get participant details - need to check both users and actors
    const participantUserIds = fullChat.ChatParticipant.map((p: typeof fullChat.ChatParticipant[number]) => p.userId);
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
    const senderIds = [...new Set(fullChat.Message.map((m: typeof fullChat.Message[number]) => m.senderId))];
    const actors = await db.actor.findMany({
      where: {
        id: { in: senderIds as string[] },
      },
      select: {
        id: true,
        name: true,
        profileImageUrl: true,
      },
    });

    return { users, actors };
  }) : asSystem(async (db) => {
    const participantUserIds = fullChat.ChatParticipant.map((p: typeof fullChat.ChatParticipant[number]) => p.userId);
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

    const senderIds = [...new Set(fullChat.Message.map((m: typeof fullChat.Message[number]) => m.senderId))];
    const actors = await db.actor.findMany({
      where: {
        id: { in: senderIds as string[] },
      },
      select: {
        id: true,
        name: true,
        profileImageUrl: true,
      },
    });

    return { users, actors };
  }, 'get-chat-participants-debug'));

    const usersMap = new Map<string, typeof users[number]>(users.map((u: typeof users[number]) => [u.id, u]));
    const actorsMap = new Map<string, typeof actors[number]>(actors.map((a: typeof actors[number]) => [a.id, a]));

    // Get unique sender IDs from messages (for debug mode)
    const senderIds = [...new Set(fullChat.Message.map((m: typeof fullChat.Message[number]) => m.senderId))];

    // Build participants list from ChatParticipants or message senders (for debug mode)
    const participantsInfo = fullChat.ChatParticipant.length > 0
      ? fullChat.ChatParticipant.map((p: typeof fullChat.ChatParticipant[number]) => {
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
        (senderIds as string[]).map((senderId: string) => {
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
    let otherUser: { id: string; displayName: string | null; username: string | null; profileImageUrl: string | null } | null = null;
    if (!fullChat.isGroup && !fullChat.name && userId) {
      const otherParticipant = fullChat.ChatParticipant.find((p: typeof fullChat.ChatParticipant[number]) => p.userId !== userId);
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

  // Check if there are more messages
  const hasMore = fullChat.Message.length > effectiveLimit
  const messages = hasMore ? fullChat.Message.slice(0, effectiveLimit) : fullChat.Message
  
  // Reverse to get chronological order (oldest first)
  const messagesInOrder = [...messages].reverse()
  
  // Get the cursor for the next page (oldest message ID in this batch)
  const nextCursor = hasMore ? fullChat.Message[effectiveLimit - 1]?.id : null

  logger.info('Chat fetched successfully', { 
    chatId, 
    isGameChat, 
    isDM: !fullChat.isGroup,
    debugMode,
    messagesReturned: messages.length,
    hasMore,
    nextCursor
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
    messages: messagesInOrder.map((msg: typeof messagesInOrder[number]) => ({
      id: msg.id,
      content: msg.content,
      senderId: msg.senderId,
      createdAt: msg.createdAt,
    })),
    participants: participantsInfo,
    pagination: {
      hasMore,
      nextCursor,
      limit: effectiveLimit,
    },
  })
})

