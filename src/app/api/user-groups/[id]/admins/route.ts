/**
 * User Group Admins API
 */

import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const addAdminSchema = z.object({
  userId: z.string(),
});

/**
 * POST /api/user-groups/[id]/admins
 * Grant admin privileges to a member (admin only)
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const user = await authenticate(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: groupId } = await context.params;
  const body = await request.json();
  const { userId: targetUserId } = addAdminSchema.parse(body);

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
      { error: 'Only admins can grant admin privileges' },
      { status: 403 }
    );
  }

  // Check if target is a member
  const isMember = await prisma.userGroupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: targetUserId,
      },
    },
  });

  if (!isMember) {
    return NextResponse.json(
      { error: 'User must be a member first' },
      { status: 400 }
    );
  }

  // Check if already admin
  const existingAdmin = await prisma.userGroupAdmin.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: targetUserId,
      },
    },
  });

  if (existingAdmin) {
    return NextResponse.json(
      { error: 'User is already an admin' },
      { status: 400 }
    );
  }

  // Grant admin
  await prisma.userGroupAdmin.create({
    data: {
      id: await generateSnowflakeId(),
      groupId,
      userId: targetUserId,
      grantedBy: user.userId,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Admin privileges granted',
  });
});

