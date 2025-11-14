/**
 * API Route: /api/chats/dm
 * Methods: POST (create or get DM chat with a user)
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { DMChatCreateSchema } from '@/lib/validation/schemas';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST /api/chats/dm
 * Create or get a DM chat with another user
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);

  // Validate request body
  const body = await request.json();
  const { userId: targetUserId } = DMChatCreateSchema.parse(body);

  // Prevent DMing yourself (business rule validation)
  if (user.userId === targetUserId) {
    throw new BusinessLogicError('Cannot DM yourself', 'SELF_DM_NOT_ALLOWED');
  }

  // Create or get DM chat with RLS
  const chat = await asUser(user, async (db) => {
    // Check if target user exists and is a real user (not an NPC)
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { 
        id: true, 
        isActor: true,
        displayName: true,
        username: true,
        profileImageUrl: true,
      },
    });

    // Reject if target doesn't exist
    if (!targetUser) {
      throw new NotFoundError('User', targetUserId);
    }

    // Reject if target is an NPC actor
    if (targetUser.isActor) {
      throw new BusinessLogicError(
        'Cannot send direct messages to NPC actors. Use group chats to interact with NPCs.',
        'INVALID_DM_TARGET'
      );
    }

    // Create DM chat ID (consistent format - sort IDs for consistency)
    const sortedIds = [user.userId, targetUserId].sort();
    const chatId = `dm-${sortedIds.join('-')}`;

    // Try to find existing DM chat
    let existingChat = await db.chat.findUnique({
      where: { id: chatId },
      include: {
        participants: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!existingChat) {
      // Create new DM chat
      existingChat = await db.chat.create({
        data: {
          id: chatId,
          name: null, // DMs don't have names
          isGroup: false,
        },
        include: {
          participants: {
            select: {
              userId: true,
            },
          },
        },
      });

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
            userId: targetUserId,
          },
        }),
      ]);
    } else {
      // Chat exists, ensure both participants are added
      const participantIds = existingChat.participants.map(p => p.userId);
      
      if (!participantIds.includes(user.userId)) {
        await db.chatParticipant.create({
          data: {
            chatId,
            userId: user.userId,
          },
        });
      }

      if (!participantIds.includes(targetUserId)) {
        await db.chatParticipant.create({
          data: {
            chatId,
            userId: targetUserId,
          },
        });
      }
    }

    return { chat: existingChat, targetUser };
  });

  logger.info('DM chat created or retrieved successfully', { chatId: chat.chat.id, userId: user.userId, targetUserId }, 'POST /api/chats/dm');

  // Track DM created/opened event
  trackServerEvent(user.userId, 'dm_opened', {
    chatId: chat.chat.id,
    recipientId: targetUserId,
    isNewChat: !chat.chat.participants || chat.chat.participants.length === 0,
  }).catch((error) => {
    logger.warn('Failed to track dm_opened event', { error });
  });

  return successResponse({
    chat: {
      id: chat.chat.id,
      name: chat.chat.name,
      isGroup: chat.chat.isGroup,
      otherUser: {
        id: chat.targetUser.id,
        displayName: chat.targetUser.displayName,
        username: chat.targetUser.username,
        profileImageUrl: chat.targetUser.profileImageUrl,
      },
    },
  }, 201);
});

