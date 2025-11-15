/**
 * User Group Members API
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/api/auth-middleware';
import { generateSnowflakeId } from '@/lib/snowflake';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { z } from 'zod';
import { notifyUserGroupInvite } from '@/lib/services/notification-service';
import { Prisma } from '@prisma/client';

const addMemberSchema = z.object({
  userId: z.string(),
});

/**
 * POST /api/user-groups/[id]/members
 * Send invite to a user to join the group (admin only)
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);

  const { id: groupId } = await context.params;
  const body = await request.json();
  const { userId: inviteeId } = addMemberSchema.parse(body);

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
      { error: 'Only admins can invite members' },
      { status: 403 }
    );
  }

  // Validate that invitee is a real user (not NPC)
  const invitee = await prisma.user.findUnique({
    where: { id: inviteeId },
    select: {
      id: true,
      isActor: true,
      username: true,
      displayName: true,
    },
  });

  if (!invitee) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  if (invitee.isActor) {
    return NextResponse.json(
      { error: 'Cannot invite NPCs to user groups' },
      { status: 400 }
    );
  }

  // Check if already a member
  const existingMember = await prisma.userGroupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: inviteeId,
      },
    },
  });

  if (existingMember) {
    return NextResponse.json(
      { error: 'User is already a member' },
      { status: 400 }
    );
  }

  // Check if already invited
  const existingInvite = await prisma.userGroupInvite.findUnique({
    where: {
      groupId_invitedUserId: {
        groupId,
        invitedUserId: inviteeId,
      },
    },
  });

  if (existingInvite && existingInvite.status === 'pending') {
    return NextResponse.json(
      { error: 'User already has a pending invite' },
      { status: 400 }
    );
  }

  // Get group details for notification
  const group = await prisma.userGroup.findUnique({
    where: { id: groupId },
    select: { name: true },
  });

  // Create invite - handle unique constraint race condition
  let invite;
  try {
    invite = await prisma.userGroupInvite.create({
      data: {
        id: await generateSnowflakeId(),
        groupId,
        invitedUserId: inviteeId,
        invitedBy: user.userId,
        status: 'pending',
      },
    });
  } catch (error: unknown) {
    // Handle unique constraint violation (race condition)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = error.meta?.target as string[] | undefined
      if (target?.includes('groupId') && target?.includes('invitedUserId')) {
        // Check if there's now a pending invite (another request created it)
        const raceConditionInvite = await prisma.userGroupInvite.findUnique({
          where: {
            groupId_invitedUserId: {
              groupId,
              invitedUserId: inviteeId,
            },
          },
        });
        if (raceConditionInvite?.status === 'pending') {
          return NextResponse.json(
            { error: 'User already has a pending invite' },
            { status: 400 }
          );
        }
        // If it's not pending, we can retry or handle differently
        return NextResponse.json(
          { error: 'Failed to create invite due to existing record' },
          { status: 400 }
        );
      }
    }
    throw error;
  }

  // Send notification using service
  await notifyUserGroupInvite(
    inviteeId,
    user.userId,
    groupId,
    group?.name || 'a group',
    invite.id
  );

  return NextResponse.json({
    success: true,
    message: 'Invite sent',
    data: {
      inviteId: invite.id,
    },
  });
});

