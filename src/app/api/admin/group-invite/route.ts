/**
 * Admin Group Invite API
 * 
 * Send group chat invite on behalf of an NPC to a user
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { asSystem } from '@/lib/db/context';

/**
 * POST /api/admin/group-invite
 * Send a group chat invite from an NPC to a user
 * Admin only
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);
  
  const body = await request.json();
  const { npcId, userId, chatId, chatName } = body;
  
  // Check admin permissions using asSystem
  const dbUser = await asSystem(async (db) => {
    return await db.user.findUnique({
      where: { id: user.userId },
      select: { 
        id: true,
        username: true,
        isAdmin: true 
      },
    });
  }, 'admin-group-invite-permission-check');

  console.log('[Admin Group Invite] Auth user:', user.userId, 'DB user:', dbUser);

  if (!dbUser) {
    return NextResponse.json(
      { error: 'User not found in database' },
      { status: 404 }
    );
  }

  if (!dbUser.isAdmin) {
    return NextResponse.json(
      { 
        error: 'Admin access required',
        debug: {
          userId: user.userId,
          username: dbUser.username,
          isAdmin: dbUser.isAdmin
        }
      },
      { status: 403 }
    );
  }

  // Validate inputs
  if (!npcId || !userId) {
    return NextResponse.json(
      { error: 'npcId and userId are required' },
      { status: 400 }
    );
  }

  // Verify NPC exists
  const npc = await asSystem(async (db) => {
    const actor = await db.actor.findUnique({
      where: { id: npcId },
      select: { id: true, name: true },
    });
    
    if (!actor) {
      // Try as User with isActor=true
      return await db.user.findUnique({
        where: { id: npcId, isActor: true },
        select: { id: true, displayName: true, username: true },
      });
    }
    
    return actor;
  });

  if (!npc) {
    return NextResponse.json(
      { error: 'NPC not found' },
      { status: 404 }
    );
  }

  // Verify user exists
  const targetUser = await asSystem(async (db) => {
    return await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, displayName: true },
    });
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // Check if user is already a member
  const existingMembership = await asSystem(async (db) => {
    return await db.groupChatMembership.findFirst({
      where: {
        userId,
        chatId: chatId || `${npcId}-owned-chat`,
        isActive: true,
      },
    });
  });

  if (existingMembership) {
    return NextResponse.json(
      { error: 'User is already a member of this group' },
      { status: 400 }
    );
  }

  // Generate chat ID and name if not provided
  const finalChatId = chatId || `${npcId}-owned-chat`;
  const npcName = 'name' in npc ? npc.name : (npc.displayName || npc.username || 'Unknown');
  const finalChatName = chatName || `${npcName}'s Inner Circle`;

  // Record the invite
  await asSystem(async (db) => {
    // Use the GroupChatInvite service, but we need to bypass RLS
    // So we'll replicate the logic here with asSystem
    
    // Create chat if it doesn't exist
    await db.chat.upsert({
      where: { id: finalChatId },
      update: {},
      create: {
        id: finalChatId,
        name: finalChatName,
        isGroup: true,
        gameId: 'realtime',
        updatedAt: new Date(),
      },
    });

    // Add user to chat participants
    const { generateSnowflakeId } = await import('@/lib/snowflake');
    await db.chatParticipant.upsert({
      where: {
        chatId_userId: {
          chatId: finalChatId,
          userId,
        },
      },
      update: {},
      create: {
        id: await generateSnowflakeId(),
        chatId: finalChatId,
        userId,
      },
    });

    // Record membership
    await db.groupChatMembership.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        chatId: finalChatId,
        npcAdminId: npcId,
      },
    });

    // Send notification to user
    const { notifyGroupChatInvite } = await import('@/lib/services/notification-service');
    await notifyGroupChatInvite(userId, npcId, finalChatId, finalChatName);
  });

  return NextResponse.json({
    success: true,
    message: `Invited ${targetUser.displayName || targetUser.username} to ${finalChatName}`,
    data: {
      chatId: finalChatId,
      chatName: finalChatName,
      npcId,
      npcName,
      userId,
    },
  });
});

