/**
 * User Group Details API
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling } from '@/lib/errors/error-handler';

/**
 * GET /api/user-groups/[id]
 * Get group details with members and admins
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: groupId } = await context.params;

  // Check if user is a member
  const membership = await prisma.userGroupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: user.userId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json(
      { error: 'Not a member of this group' },
      { status: 403 }
    );
  }

  // Get group with members and admins
  const group = await prisma.userGroup.findUnique({
    where: { id: groupId },
    include: {
      UserGroupMember: {
        select: {
          userId: true,
          joinedAt: true,
          addedBy: true,
        },
      },
      UserGroupAdmin: {
        select: {
          userId: true,
          grantedAt: true,
          grantedBy: true,
        },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  // Get user details for members
  const memberIds = group.UserGroupMember.map(m => m.userId);
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: memberIds,
      },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
    },
  });

  // Map users to members
  const members = group.UserGroupMember.map(member => {
    const userDetails = users.find(u => u.id === member.userId);
    return {
      userId: member.userId,
      username: userDetails?.username,
      displayName: userDetails?.displayName,
      profileImageUrl: userDetails?.profileImageUrl,
      joinedAt: member.joinedAt,
      addedBy: member.addedBy,
      isAdmin: group.UserGroupAdmin.some(admin => admin.userId === member.userId),
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      id: group.id,
      name: group.name,
      description: group.description,
      createdById: group.createdById,
      createdAt: group.createdAt,
      members,
      isCurrentUserAdmin: group.UserGroupAdmin.some(admin => admin.userId === user.userId),
    },
  });
});

/**
 * PUT /api/user-groups/[id]
 * Update group details (name, description) - admin only
 */
export const PUT = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: groupId } = await context.params;
  const body = await request.json();

  // Validate input
  const { z } = await import('zod');
  const updateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
  });

  const validatedData = updateSchema.parse(body);

  // Check if user is admin
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
      { error: 'Only admins can update group details' },
      { status: 403 }
    );
  }

  // Update the group
  const updatedGroup = await prisma.userGroup.update({
    where: { id: groupId },
    data: {
      ...validatedData,
      updatedAt: new Date(),
    },
  });

  // If name changed, update associated chat name
  if (validatedData.name) {
    const chat = await prisma.chat.findFirst({
      where: {
        isGroup: true,
        ChatParticipant: {
          some: {
            userId: user.userId,
          },
        },
      },
    });

    if (chat) {
      await prisma.chat.update({
        where: { id: chat.id },
        data: {
          name: validatedData.name,
          updatedAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Group updated',
    data: {
      id: updatedGroup.id,
      name: updatedGroup.name,
      description: updatedGroup.description,
    },
  });
});

/**
 * DELETE /api/user-groups/[id]
 * Delete a group (admin only)
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: groupId } = await context.params;

  // Check if user is admin
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
      { error: 'Only admins can delete groups' },
      { status: 403 }
    );
  }

  // Delete the group (cascade will delete members and admins)
  await prisma.userGroup.delete({
    where: { id: groupId },
  });

  return NextResponse.json({
    success: true,
    message: 'Group deleted',
  });
});

