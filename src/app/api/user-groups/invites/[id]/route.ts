/**
 * User Group Invite Actions API
 * 
 * Accept or decline group invites
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/api/auth-middleware';
import { generateSnowflakeId } from '@/lib/snowflake';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';

/**
 * POST /api/user-groups/invites/[id]
 * Accept a group invite
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  const { id: inviteId } = await context.params;

  // Get invite
  const invite = await prisma.userGroupInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite) {
    return NextResponse.json(
      { error: 'Invite not found' },
      { status: 404 }
    );
  }

  // Verify invite is for this user
  if (invite.invitedUserId !== user.userId) {
    return NextResponse.json(
      { error: 'This invite is not for you' },
      { status: 403 }
    );
  }

  // Check if already responded
  if (invite.status !== 'pending') {
    return NextResponse.json(
      { error: `Invite already ${invite.status}` },
      { status: 400 }
    );
  }

  // Update invite status
  await prisma.userGroupInvite.update({
    where: { id: inviteId },
    data: {
      status: 'accepted',
      respondedAt: new Date(),
    },
  });

  // Add user to group
  await prisma.userGroupMember.create({
    data: {
      id: await generateSnowflakeId(),
      groupId: invite.groupId,
      userId: user.userId,
      addedBy: invite.invitedBy,
    },
  });

  // Add to chat participants
  const group = await prisma.userGroup.findUnique({
    where: { id: invite.groupId },
    select: { name: true },
  });

  // Find the chat for this group
  const chat = await prisma.chat.findFirst({
    where: {
      name: group?.name,
      isGroup: true,
    },
  });

  if (chat) {
    await prisma.chatParticipant.upsert({
      where: {
        chatId_userId: {
          chatId: chat.id,
          userId: user.userId,
        },
      },
      update: {},
      create: {
        id: await generateSnowflakeId(),
        chatId: chat.id,
        userId: user.userId,
      },
    });
  }

  // Mark notification as read
  await prisma.notification.updateMany({
    where: {
      userId: user.userId,
      type: 'group_invite',
      actorId: invite.invitedBy,
    },
    data: {
      read: true,
    },
  });

  return successResponse({
    data: {
      message: 'Invite accepted',
      groupId: invite.groupId,
      chatId: chat?.id,
    },
  });
});

/**
 * DELETE /api/user-groups/invites/[id]
 * Decline a group invite
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  const { id: inviteId } = await context.params;

  // Get invite
  const invite = await prisma.userGroupInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite) {
    return NextResponse.json(
      { error: 'Invite not found' },
      { status: 404 }
    );
  }

  // Verify invite is for this user
  if (invite.invitedUserId !== user.userId) {
    return NextResponse.json(
      { error: 'This invite is not for you' },
      { status: 403 }
    );
  }

  // Check if already responded
  if (invite.status !== 'pending') {
    return NextResponse.json(
      { error: `Invite already ${invite.status}` },
      { status: 400 }
    );
  }

  // Update invite status
  await prisma.userGroupInvite.update({
    where: { id: inviteId },
    data: {
      status: 'declined',
      respondedAt: new Date(),
    },
  });

  // Mark notification as read
  await prisma.notification.updateMany({
    where: {
      userId: user.userId,
      type: 'group_invite',
      actorId: invite.invitedBy,
    },
    data: {
      read: true,
    },
  });

  return successResponse({
    data: {
      message: 'Invite declined',
    },
  });
});

/**
 * GET /api/user-groups/invites/[id]
 * Get invite details
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  const { id: inviteId } = await context.params;

  // Get invite with group and inviter details
  const invite = await prisma.userGroupInvite.findUnique({
    where: { id: inviteId },
  });

  if (!invite) {
    return NextResponse.json(
      { error: 'Invite not found' },
      { status: 404 }
    );
  }

  // Verify invite is for this user
  if (invite.invitedUserId !== user.userId) {
    return NextResponse.json(
      { error: 'This invite is not for you' },
      { status: 403 }
    );
  }

  // Get group details
  const group = await prisma.userGroup.findUnique({
    where: { id: invite.groupId },
    include: {
      UserGroupMember: {
        select: {
          userId: true,
        },
      },
    },
  });

  // Get inviter details
  const inviter = await prisma.user.findUnique({
    where: { id: invite.invitedBy },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
    },
  });

  return successResponse({
    data: {
      invite: {
        id: invite.id,
        status: invite.status,
        invitedAt: invite.invitedAt,
        respondedAt: invite.respondedAt,
      },
      group: group ? {
        id: group.id,
        name: group.name,
        description: group.description,
        memberCount: group.UserGroupMember.length,
      } : null,
      inviter: inviter ? {
        id: inviter.id,
        name: inviter.displayName || inviter.username,
        username: inviter.username,
        profileImageUrl: inviter.profileImageUrl,
      } : null,
    },
  });
});

