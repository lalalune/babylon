/**
 * User Group Member Actions API
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling } from '@/lib/errors/error-handler';

/**
 * DELETE /api/user-groups/[id]/members/[userId]
 * Remove a member from the group (admin only, or user removing themselves)
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) => {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: groupId, userId: targetUserId } = await context.params;

  // Users can remove themselves, or admins can remove others
  const isRemovingSelf = user.userId === targetUserId;
  
  if (!isRemovingSelf) {
    // Check if requester is admin
    const isAdmin = await prisma.userGroupAdmin.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.userId,
        },
      },
    });

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only admins can remove other members' },
        { status: 403 }
      );
    }
  }

  // Check if target is a member
  const membership = await prisma.userGroupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: targetUserId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: 'User is not a member' },
      { status: 404 }
    );
  }

  // Don't allow removing the group creator
  const group = await prisma.userGroup.findUnique({
    where: { id: groupId },
    select: { createdById: true, name: true },
  });

  if (group?.createdById === targetUserId) {
    return NextResponse.json(
      { error: 'Cannot remove group creator' },
      { status: 400 }
    );
  }

  // Remove member
  await prisma.userGroupMember.delete({
    where: {
      groupId_userId: {
        groupId,
        userId: targetUserId,
      },
    },
  });

  // Remove from admin if they are one
  await prisma.userGroupAdmin.deleteMany({
    where: {
      groupId,
      userId: targetUserId,
    },
  });

  // Remove from chat participants
  const chat = await prisma.chat.findFirst({
    where: {
      name: group?.name,
      isGroup: true,
    },
  });

  if (chat) {
    await prisma.chatParticipant.deleteMany({
      where: {
        chatId: chat.id,
        userId: targetUserId,
      },
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Member removed',
  });
});

