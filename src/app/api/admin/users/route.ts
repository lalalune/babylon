/**
 * Admin API: User Management
 * GET /api/admin/users
 * 
 * Returns user list with metrics and filtering
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  filter: z.enum(['all', 'actors', 'users', 'banned', 'admins']).default('all'),
  sortBy: z.enum(['created', 'balance', 'reputation', 'username']).default('created'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  await requireAdmin(request);

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const params = QuerySchema.parse({
    limit: searchParams.get('limit') || '50',
    offset: searchParams.get('offset') || '0',
    search: searchParams.get('search') || undefined,
    filter: searchParams.get('filter') || 'all',
    sortBy: searchParams.get('sortBy') || 'created',
    sortOrder: searchParams.get('sortOrder') || 'desc',
  });

  logger.info(`Admin users list requested`, { params }, 'GET /api/admin/users');

  // Build where clause
  const where: Record<string, unknown> = {};

  if (params.filter === 'actors') {
    where.isActor = true;
  } else if (params.filter === 'users') {
    where.isActor = false;
  } else if (params.filter === 'banned') {
    where.isBanned = true;
  } else if (params.filter === 'admins') {
    where.isAdmin = true;
  }

  if (params.search) {
    where.OR = [
      { username: { contains: params.search, mode: 'insensitive' } },
      { displayName: { contains: params.search, mode: 'insensitive' } },
      { walletAddress: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  // Build orderBy
  const orderBy: Record<string, 'asc' | 'desc'> = {};
  if (params.sortBy === 'created') {
    orderBy.createdAt = params.sortOrder;
  } else if (params.sortBy === 'balance') {
    orderBy.virtualBalance = params.sortOrder;
  } else if (params.sortBy === 'reputation') {
    orderBy.reputationPoints = params.sortOrder;
  } else if (params.sortBy === 'username') {
    orderBy.username = params.sortOrder;
  }

  // Get users
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      take: params.limit,
      skip: params.offset,
      select: {
        id: true,
        username: true,
        displayName: true,
        walletAddress: true,
        profileImageUrl: true,
        isActor: true,
        isAdmin: true,
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
        bannedBy: true,
        virtualBalance: true,
        totalDeposited: true,
        totalWithdrawn: true,
        lifetimePnL: true,
        reputationPoints: true,
        referralCount: true,
        onChainRegistered: true,
        nftTokenId: true,
        hasFarcaster: true,
        hasTwitter: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            comments: true,
            reactions: true,
            positions: true,
            following: true,
            followedBy: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return successResponse({
    users: users.map(user => ({
      ...user,
      virtualBalance: user.virtualBalance.toString(),
      totalDeposited: user.totalDeposited.toString(),
      totalWithdrawn: user.totalWithdrawn.toString(),
      lifetimePnL: user.lifetimePnL.toString(),
    })),
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total,
    },
  });
});

