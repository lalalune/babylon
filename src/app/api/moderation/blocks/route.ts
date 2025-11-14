/**
 * User Blocks List API
 * GET /api/moderation/blocks
 * 
 * Get list of users blocked by current user
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { GetBlocksSchema } from '@/lib/validation/schemas/moderation';

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  
  const { searchParams } = new URL(request.url);
  const { limit, offset } = GetBlocksSchema.parse({
    limit: searchParams.get('limit') || '20',
    offset: searchParams.get('offset') || '0',
  });

  const [blocks, total] = await Promise.all([
    prisma.userBlock.findMany({
      where: { blockerId: authUser.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        blocked: {
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
    prisma.userBlock.count({
      where: { blockerId: authUser.userId },
    }),
  ]);

  return successResponse({
    blocks,
    pagination: {
      limit,
      offset,
      total,
    },
  });
});


