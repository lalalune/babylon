/**
 * User Mutes List API
 * GET /api/moderation/mutes
 * 
 * Get list of users muted by current user
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { GetMutesSchema } from '@/lib/validation/schemas/moderation';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  
  const { searchParams } = new URL(request.url);
  const { limit, offset } = GetMutesSchema.parse({
    limit: searchParams.get('limit') || '20',
    offset: searchParams.get('offset') || '0',
  });

  const [mutes, total] = await Promise.all([
    prisma.userMute.findMany({
      where: { muterId: authUser.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        muted: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            isActor: true,
          },
        },
      },
    }),
    prisma.userMute.count({
      where: { muterId: authUser.userId },
    }),
  ]);

  return successResponse({
    mutes,
    pagination: {
      limit,
      offset,
      total,
    },
  });
});


