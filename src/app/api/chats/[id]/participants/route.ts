/**
 * API Route: /api/chats/[id]/participants
 * Methods: POST (add users to chat), GET (get chat participants)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { asUser, asSystem } from '@/lib/db/context'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { BusinessLogicError, NotFoundError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import { notifyGroupChatInvite } from '@/lib/services/notification-service'

/**
 * POST /api/chats/[id]/participants
 * Add users to a group chat
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request)
  const { id: chatId } = await context.params

  if (!chatId) {
    throw new BusinessLogicError('Chat ID is required', 'CHAT_ID_REQUIRED')
  }

  // Validate request body
  const body = await request.json()
  const { userIds } = body

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new BusinessLogicError(
      'At least one user ID is required',
      'USER_IDS_REQUIRED'
    )
  }

  // Check if chat exists and user is a participant
  const chat = await asUser(user, async (db) => {
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      include: {
        ChatParticipant: true,
      },
    })

    if (!chat) {
      throw new NotFoundError('Chat', chatId)
    }

    // Check if user is a participant
    const isParticipant = chat.ChatParticipant.some(
      (p) => p.userId === user.userId
    )

    if (!isParticipant) {
      throw new BusinessLogicError(
        'You must be a participant to invite others',
        'NOT_PARTICIPANT'
      )
    }

    // If it's a DM, convert to group chat
    if (!chat.isGroup) {
      // Update chat to be a group chat
      await db.chat.update({
        where: { id: chatId },
        data: {
          isGroup: true,
          name: `Group Chat`, // Default name, can be updated later
          updatedAt: new Date(),
        },
      })
    }

    return chat
  })

  // Verify all users exist and add them to the chat
  const addedUsers = await asSystem(async (db) => {
    // Verify users exist and are not actors
    const usersToAdd = await db.user.findMany({
      where: {
        id: { in: userIds },
        isActor: false,
        isBanned: false,
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        profileImageUrl: true,
      },
    })

    if (usersToAdd.length === 0) {
      throw new BusinessLogicError('No valid users to add', 'NO_VALID_USERS')
    }

    // Filter out users already in the chat
    const existingParticipantIds = chat.ChatParticipant.map((p) => p.userId)
    const newUsers = usersToAdd.filter(
      (u) => !existingParticipantIds.includes(u.id)
    )

    if (newUsers.length === 0) {
      throw new BusinessLogicError(
        'All users are already in the chat',
        'ALREADY_PARTICIPANTS'
      )
    }

    // Add new participants
    await Promise.all(
      newUsers.map(async (newUser) =>
        db.chatParticipant.create({
          data: {
            id: await generateSnowflakeId(),
            chatId,
            userId: newUser.id,
          },
        })
      )
    )

    // Get updated chat info
    const updatedChat = await db.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        name: true,
        isGroup: true,
      },
    })

    // Send notifications to invited users
    const inviterUser = await db.user.findUnique({
      where: { id: user.userId },
      select: {
        displayName: true,
        username: true,
      },
    })

    await Promise.all(
      newUsers.map((newUser) =>
        notifyGroupChatInvite(
          newUser.id,
          user.userId,
          chatId,
          updatedChat?.name || 'a group chat'
        )
      )
    )

    logger.info(
      'Users added to chat',
      {
        chatId,
        addedBy: user.userId,
        addedUsers: newUsers.map((u) => u.id),
      },
      'POST /api/chats/[id]/participants'
    )

    return {
      addedUsers: newUsers,
      inviterName: inviterUser?.displayName || inviterUser?.username || 'Someone',
      chatName: updatedChat?.name || 'Group Chat',
    }
  })

  return successResponse({
    message: `Added ${addedUsers.addedUsers.length} user(s) to the chat`,
    data: {
      chatId,
      addedUsers: addedUsers.addedUsers.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        username: u.username,
        profileImageUrl: u.profileImageUrl,
      })),
    },
  })
})

/**
 * GET /api/chats/[id]/participants
 * Get all participants in a chat
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request)
  const { id: chatId } = await context.params

  if (!chatId) {
    throw new BusinessLogicError('Chat ID is required', 'CHAT_ID_REQUIRED')
  }

  // Get chat participants
  const participants = await asUser(user, async (db) => {
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      include: {
        ChatParticipant: true,
      },
    })

    if (!chat) {
      throw new NotFoundError('Chat', chatId)
    }

    // Check if user is a participant
    const isParticipant = chat.ChatParticipant.some(
      (p) => p.userId === user.userId
    )

    if (!isParticipant) {
      throw new BusinessLogicError(
        'You must be a participant to view participants',
        'NOT_PARTICIPANT'
      )
    }

    // Get user details for all participants
    const userIds = chat.ChatParticipant.map((p) => p.userId)
    const users = await db.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        profileImageUrl: true,
      },
    })

    return users
  })

  logger.info(
    'Chat participants fetched',
    { chatId, participantCount: participants.length },
    'GET /api/chats/[id]/participants'
  )

  return successResponse({
    participants,
  })
})

