/**
 * Admin API: Debug DM
 * GET /api/admin/debug-dm?userId=xxx
 * 
 * Check what DM chats exist for a user (bypasses RLS)
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  await requireAdmin(request);

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return successResponse({
      error: 'userId parameter required',
    });
  }

  logger.info('Debug DM lookup', { userId }, 'GET /api/admin/debug-dm');

  // Get user info (try by ID, username, or privyId)
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      privyId: true,
      username: true,
      displayName: true,
    },
  });

  if (!user) {
    // Try by username
    user = await prisma.user.findUnique({
      where: { username: userId },
      select: {
        id: true,
        privyId: true,
        username: true,
        displayName: true,
      },
    });
  }

  if (!user) {
    // Try by privyId
    user = await prisma.user.findUnique({
      where: { privyId: userId },
      select: {
        id: true,
        privyId: true,
        username: true,
        displayName: true,
      },
    });
  }

  // Use the resolved user ID
  const resolvedUserId = user?.id || user?.privyId || userId;

  // Get all ChatParticipant records for this user (bypass RLS)
  const participants = await prisma.chatParticipant.findMany({
    where: {
      userId: resolvedUserId,
    },
  });

  // Get details for each chat
  const chatIds = participants.map(p => p.chatId);
  const chats = await prisma.chat.findMany({
    where: {
      id: { in: chatIds },
    },
    include: {
      ChatParticipant: true,
      Message: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  // Get all user IDs from participants
  const participantUserIds = [...new Set(chats.flatMap(chat => chat.ChatParticipant.map(p => p.userId)))];
  const participantUsers = await prisma.user.findMany({
    where: {
      id: { in: participantUserIds },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  });

  const usersMap = new Map(participantUsers.map(u => [u.id, u]));

  logger.info('Debug DM results', { 
    userId, 
    participantsCount: participants.length,
    chatsCount: chats.length 
  }, 'GET /api/admin/debug-dm');

  // Get actual message counts for each chat
  const messageCounts = await Promise.all(
    chats.map(chat =>
      prisma.message.count({
        where: { chatId: chat.id },
      })
    )
  );

  return successResponse({
    user,
    note: user ? `User database ID: ${user.id}, Privy ID: ${user.privyId}` : 'User not found',
    participantRecords: participants,
    chats: chats.map((chat, index) => ({
      id: chat.id,
      name: chat.name,
      isGroup: chat.isGroup,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      participants: chat.ChatParticipant.map((p: { id: string; userId: string }) => {
        const user = usersMap.get(p.userId);
        return {
          id: p.id,
          userId: p.userId,
          username: user?.username || null,
          displayName: user?.displayName || null,
        };
      }),
      totalMessageCount: messageCounts[index],
      loadedMessageCount: chat.Message.length,
      recentMessages: chat.Message.slice(0, 3).map((m: { id: string; content: string; senderId: string; createdAt: Date }) => ({
        id: m.id,
        content: m.content.substring(0, 50),
        senderId: m.senderId,
        createdAt: m.createdAt,
      })),
    })),
  });
});

