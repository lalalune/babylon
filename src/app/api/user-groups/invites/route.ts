/**
 * User Group Invites API
 * 
 * Get all pending invites for the authenticated user
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';

/**
 * GET /api/user-groups/invites
 * Get all pending invites for the authenticated user
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request);

  // Get pending invites
  const invites = await prisma.userGroupInvite.findMany({
    where: {
      invitedUserId: user.userId,
      status: 'pending',
    },
    orderBy: {
      invitedAt: 'desc',
    },
  });

  // Get group and inviter details for each invite
  const enrichedInvites = await Promise.all(
    invites.map(async (invite) => {
      const [group, inviter] = await Promise.all([
        prisma.userGroup.findUnique({
          where: { id: invite.groupId },
          include: {
            UserGroupMember: {
              select: {
                userId: true,
              },
            },
          },
        }),
        prisma.user.findUnique({
          where: { id: invite.invitedBy },
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
          },
        }),
      ]);

      return {
        id: invite.id,
        groupId: invite.groupId,
        invitedAt: invite.invitedAt,
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
      };
    })
  );

  return successResponse({
    data: {
      invites: enrichedInvites,
      total: enrichedInvites.length,
    },
  });
});

