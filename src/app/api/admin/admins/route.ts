/**
 * Admin Management API
 * GET /api/admin/admins
 * 
 * Returns list of all admin users
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  await requireAdmin(request);

  logger.info(`Admin list requested`, {}, 'GET /api/admin/admins');

  // Get all admin users
  const admins = await prisma.user.findMany({
    where: {
      isAdmin: true,
      isActor: false, // Exclude NPCs
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      walletAddress: true,
      profileImageUrl: true,
      isActor: true,
      isAdmin: true,
      isBanned: true,
      onChainRegistered: true,
      hasFarcaster: true,
      hasTwitter: true,
      farcasterUsername: true,
      twitterUsername: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'asc', // Oldest admins first
    },
  });

  logger.info(`Found ${admins.length} admins`, {}, 'GET /api/admin/admins');

  return successResponse({
    admins,
    total: admins.length,
  });
});


