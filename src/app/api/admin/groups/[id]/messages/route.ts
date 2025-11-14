/**
 * Admin Group Messages API
 * 
 * View all messages in a specific group chat
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling } from '@/lib/errors/error-handler';

/**
 * GET /api/admin/groups/[id]/messages
 * Get all messages in a group chat
 * Admin only
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  
  // Check admin permissions
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  const { id: chatId } = await context.params;

  // Get query parameters
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Get chat details
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: {
      id: true,
      name: true,
      isGroup: true,
      createdAt: true,
    },
  });

  if (!chat) {
    return NextResponse.json(
      { error: 'Chat not found' },
      { status: 404 }
    );
  }

  // Get total message count
  const totalMessages = await prisma.message.count({
    where: { chatId },
  });

  // Get messages with pagination
  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: {
      createdAt: 'desc',
    },
    skip: offset,
    take: limit,
  });

  // Get sender details
  const senderIds = [...new Set(messages.map(m => m.senderId))];
  const [users, actors] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: senderIds } },
      select: {
        id: true,
        username: true,
        displayName: true,
        isActor: true,
        profileImageUrl: true,
      },
    }),
    prisma.actor.findMany({
      where: { id: { in: senderIds } },
      select: {
        id: true,
        name: true,
        profileImageUrl: true,
      },
    }),
  ]);

  const enrichedMessages = messages.map(m => {
    const user = users.find(u => u.id === m.senderId);
    const actor = actors.find(a => a.id === m.senderId);
    
    return {
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      sender: {
        id: m.senderId,
        name: user?.displayName || user?.username || actor?.name || 'Unknown',
        username: user?.username || null,
        isNPC: !!actor || user?.isActor,
        profileImageUrl: user?.profileImageUrl || actor?.profileImageUrl,
      },
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      chat: {
        id: chat.id,
        name: chat.name,
        isGroup: chat.isGroup,
        createdAt: chat.createdAt,
      },
      messages: enrichedMessages,
      pagination: {
        total: totalMessages,
        offset,
        limit,
        hasMore: offset + limit < totalMessages,
      },
    },
  });
});

