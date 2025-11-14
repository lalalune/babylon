/**
 * API Route: /api/chats/[id]/message
 * Methods: POST (send message to group chat with quality and activity checks)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { asUser } from '@/lib/db/context'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { BusinessLogicError, AuthorizationError } from '@/lib/errors'
import { MessageQualityChecker } from '@/lib/services/message-quality-checker'
import { GroupChatSweep, type SweepDecision } from '@/lib/services/group-chat-sweep'
import { GroupChatInvite } from '@/lib/services/group-chat-invite'
import { broadcastChatMessage } from '@/lib/sse/event-broadcaster'
import { logger } from '@/lib/logger'
import { ChatMessageCreateSchema } from '@/lib/validation/schemas'
import { trackServerEvent } from '@/lib/posthog/server'

/**
 * POST /api/chats/[id]/message
 * Send message to group chat
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // 1. Authenticate user
  const user = await authenticate(request)
  const { id: chatId } = await context.params

  if (!chatId) {
    throw new BusinessLogicError('Chat ID is required', 'CHAT_ID_REQUIRED')
  }

  // 2. Validate request body
  const body = await request.json()
  const { content } = ChatMessageCreateSchema.parse(body)

  // 3. Determine chat type and check membership
  let chat = await asUser(user, async (db) => {
    return await db.chat.findUnique({
      where: { id: chatId },
      select: {
        id: true,
        isGroup: true,
        gameId: true,
        participants: {
          select: {
            userId: true,
          },
        },
      },
    })
  })

  // If chat doesn't exist and it's a DM format, create it automatically
  if (!chat && chatId.startsWith('dm-')) {
    // Extract user IDs from DM chat ID format: dm-{id1}-{id2}
    const dmPrefix = 'dm-'
    const idsString = chatId.substring(dmPrefix.length)
    const participantIds = idsString.split('-')
    
    // Verify the current user is one of the participants
    if (!participantIds.includes(user.userId)) {
      throw new BusinessLogicError('Invalid DM chat participants', 'INVALID_DM_PARTICIPANTS')
    }
    
    // Get the other participant ID
    const otherUserId = participantIds.find(id => id !== user.userId)
    if (!otherUserId) {
      throw new BusinessLogicError('Invalid DM chat format', 'INVALID_DM_FORMAT')
    }
    
    // Create the DM chat
    chat = await asUser(user, async (db) => {
      // Verify other user exists and is not an actor
      const otherUser = await db.user.findUnique({
        where: { id: otherUserId },
        select: { id: true, isActor: true },
      })
      
      if (!otherUser) {
        throw new BusinessLogicError('Other user not found', 'USER_NOT_FOUND')
      }
      
      if (otherUser.isActor) {
        throw new BusinessLogicError('Cannot DM actors/NPCs', 'CANNOT_DM_ACTOR')
      }
      
      // Create the chat
      await db.chat.create({
        data: {
          id: chatId,
          name: null,
          isGroup: false,
        },
        select: {
          id: true,
          isGroup: true,
          gameId: true,
          participants: {
            select: {
              userId: true,
            },
          },
        },
      })
      
      // Add both participants
      await Promise.all([
        db.chatParticipant.create({
          data: {
            chatId,
            userId: user.userId,
          },
        }),
        db.chatParticipant.create({
          data: {
            chatId,
            userId: otherUserId,
          },
        }),
      ])
      
      // Reload to include participants
      return await db.chat.findUnique({
        where: { id: chatId },
        select: {
          id: true,
          isGroup: true,
          gameId: true,
          participants: {
            select: {
              userId: true,
            },
          },
        },
      })
    })
  }

  if (!chat) {
    throw new BusinessLogicError('Chat not found', 'CHAT_NOT_FOUND')
  }

  // Determine chat type
  const isGameChat = chat.isGroup && chat.gameId === 'continuous'
  const isDMChat = !chat.isGroup
  const isGroupChat = chat.isGroup && !isGameChat

  // Check membership
  let isMember = true
  if (!isGameChat) {
    // For DMs, check ChatParticipant
    if (isDMChat) {
      isMember = chat.participants.some(p => p.userId === user.userId)
      if (!isMember) {
        throw new AuthorizationError('You are not a participant in this DM', 'chat', 'write')
      }
    }
    // For group chats, check GroupChatMembership
    else if (isGroupChat) {
      isMember = await GroupChatInvite.isInChat(user.userId, chatId)
      if (!isMember) {
        throw new AuthorizationError('You are not a member of this group chat', 'chat', 'write')
      }
    }
  }

  // 4. Check kick probability for group chats (not DMs) - skip for now since we don't want to kick during message send
  let sweepDecision: SweepDecision | null = null

  if (isGroupChat) {
    sweepDecision = await GroupChatSweep.calculateKickChance(user.userId, chatId)
    // Note: We don't actually kick here, just calculate stats for response
    // Actual kicks happen via sweep background job
  }

  // 5. Check message quality
  const contextType = isDMChat ? 'dm' : 'groupchat'
  const qualityResult = await MessageQualityChecker.checkQuality(
    content,
    user.userId,
    contextType,
    isGameChat ? '' : chatId
  )

  if (!qualityResult.passed) {
    throw new BusinessLogicError(
      qualityResult.errors.join('; '),
      'QUALITY_CHECK_FAILED'
    )
  }

    // 6. Create message
    let message = null;
    let membership = null;
    
    if (isGameChat) {
      // For game chats, create a mock message object
      message = {
        id: `game-${Date.now()}`,
        content: content.trim(),
        chatId,
        senderId: user.userId,
        createdAt: new Date(),
      };
    } else {
      // For DMs and group chats, persist to database
      const result = await asUser(user, async (db) => {
        const msg = await db.message.create({
          data: {
            content: content.trim(),
            chatId,
            senderId: user.userId,
          },
        });

        // 7. Update user's quality score in group chat (not DMs)
        if (isGroupChat) {
          await GroupChatSweep.updateQualityScore(user.userId, chatId, qualityResult.score);

          // 8. Get updated membership stats
          const mem = await db.groupChatMembership.findUnique({
            where: {
              userId_chatId: {
                userId: user.userId,
                chatId,
              },
            },
          });
          return { message: msg, membership: mem };
        }

        return { message: msg, membership: null };
      });

      message = result.message;
      membership = result.membership;
    }

    // 9. Broadcast message via SSE
    broadcastChatMessage(chatId, {
      id: message.id,
      content: message.content,
      chatId: message.chatId,
      senderId: message.senderId,
      createdAt: message.createdAt.toISOString(),
      isGameChat,
      isDMChat,
    });

  // 10. Return success with feedback
  logger.info('Message sent successfully', { 
    chatId, 
    userId: user.userId, 
    chatType: isDMChat ? 'dm' : (isGameChat ? 'game' : 'group'),
    qualityScore: qualityResult.score 
  }, 'POST /api/chats/[id]/message')

  // Track message sent event
  trackServerEvent(user.userId, 'message_sent', {
    chatId,
    messageLength: content.length,
    chatType: isDMChat ? 'dm' : (isGameChat ? 'game' : 'group'),
    qualityScore: qualityResult.score,
  }).catch((error) => {
    logger.warn('Failed to track message_sent event', { error });
  });

  return successResponse(
    {
      message: {
        id: message.id,
        content: message.content,
        chatId: message.chatId,
        senderId: message.senderId,
        createdAt: message.createdAt,
      },
      quality: {
        score: qualityResult.score,
        warnings: qualityResult.warnings,
        factors: qualityResult.factors,
      },
      membership: isGroupChat ? {
        messageCount: membership?.messageCount || 0,
        qualityScore: membership?.qualityScore || 0,
        lastMessageAt: membership?.lastMessageAt,
        messagesLast24h: sweepDecision?.stats.messagesLast24h || 0,
        status: 'active',
      } : undefined,
      warnings: qualityResult.warnings,
      chatType: isDMChat ? 'dm' : (isGameChat ? 'game' : 'group'),
    },
    201
  )
})


