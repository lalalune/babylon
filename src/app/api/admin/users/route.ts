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
  sortBy: z.enum([
    'created', 
    'balance', 
    'reputation', 
    'username',
    'reports_received',
    'blocks_received',
    'mutes_received',
    'report_ratio',
    'block_ratio',
    'bad_user_score'
  ]).default('created'),
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

  // Get users with moderation metrics
  let users = await prisma.user.findMany({
    where,
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
          Comment: true,
          Reaction: true,
          Position: true,
          Follow_Follow_followerIdToUser: true,
          Follow_Follow_followingIdToUser: true,
          Report_Report_reportedUserIdToUser: true,
          UserBlock_UserBlock_blockedIdToUser: true,
          UserMute_UserMute_mutedIdToUser: true,
          Report_Report_reporterIdToUser: true,
        },
      },
    },
  });

  const total = await prisma.user.count({ where });

  // Calculate moderation metrics and bad user scores
  const usersWithMetrics = users.map(user => {
    const followers = user._count.Follow_Follow_followingIdToUser;
    const reportsReceived = user._count.Report_Report_reportedUserIdToUser;
    const blocksReceived = user._count.UserBlock_UserBlock_blockedIdToUser;
    const mutesReceived = user._count.UserMute_UserMute_mutedIdToUser;
    const reportsSent = user._count.Report_Report_reporterIdToUser;

    // Calculate ratios (avoid division by zero)
    const reportRatio = followers > 0 ? reportsReceived / followers : reportsReceived;
    const blockRatio = followers > 0 ? blocksReceived / followers : blocksReceived;
    const muteRatio = followers > 0 ? mutesReceived / followers : mutesReceived;

    // Calculate combined bad user score
    // Formula: (reportRatio * 5) + (blockRatio * 3) + (muteRatio * 1)
    // This weighs reports more heavily than blocks, and blocks more than mutes
    const badUserScore = (reportRatio * 5) + (blockRatio * 3) + (muteRatio * 1);

    return {
      ...user,
      _moderation: {
        reportsReceived,
        blocksReceived,
        mutesReceived,
        reportsSent,
        reportRatio,
        blockRatio,
        muteRatio,
        badUserScore,
      },
    };
  });

  // Sort based on query parameter (for moderation metrics, we sort after fetching)
  if (params.sortBy === 'reports_received') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.reportsReceived - a._moderation.reportsReceived;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'blocks_received') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.blocksReceived - a._moderation.blocksReceived;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'mutes_received') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.mutesReceived - a._moderation.mutesReceived;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'report_ratio') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.reportRatio - a._moderation.reportRatio;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'block_ratio') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.blockRatio - a._moderation.blockRatio;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else if (params.sortBy === 'bad_user_score') {
    usersWithMetrics.sort((a, b) => {
      const diff = b._moderation.badUserScore - a._moderation.badUserScore;
      return params.sortOrder === 'asc' ? -diff : diff;
    });
  } else {
    // Standard sorting using Prisma orderBy
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

    // Re-fetch with proper ordering for non-moderation sorts
    if (Object.keys(orderBy).length > 0) {
      users = await prisma.user.findMany({
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
              Comment: true,
              Reaction: true,
              Position: true,
              Follow_Follow_followerIdToUser: true,
              Follow_Follow_followingIdToUser: true,
              Report_Report_reportedUserIdToUser: true,
              UserBlock_UserBlock_blockedIdToUser: true,
              UserMute_UserMute_mutedIdToUser: true,
              Report_Report_reporterIdToUser: true,
            },
          },
        },
      });

      // Recalculate metrics for re-fetched data
      usersWithMetrics.length = 0;
      users.forEach(user => {
        const followers = user._count.Follow_Follow_followingIdToUser;
        const reportsReceived = user._count.Report_Report_reportedUserIdToUser;
        const blocksReceived = user._count.UserBlock_UserBlock_blockedIdToUser;
        const mutesReceived = user._count.UserMute_UserMute_mutedIdToUser;
        const reportsSent = user._count.Report_Report_reporterIdToUser;

        const reportRatio = followers > 0 ? reportsReceived / followers : reportsReceived;
        const blockRatio = followers > 0 ? blocksReceived / followers : blocksReceived;
        const muteRatio = followers > 0 ? mutesReceived / followers : mutesReceived;
        const badUserScore = (reportRatio * 5) + (blockRatio * 3) + (muteRatio * 1);

        usersWithMetrics.push({
          ...user,
          _moderation: {
            reportsReceived,
            blocksReceived,
            mutesReceived,
            reportsSent,
            reportRatio,
            blockRatio,
            muteRatio,
            badUserScore,
          },
        });
      });
    }
  }

  return successResponse({
    users: usersWithMetrics.map(user => ({
      ...user,
      virtualBalance: user.virtualBalance.toString(),
      totalDeposited: user.totalDeposited.toString(),
      totalWithdrawn: user.totalWithdrawn.toString(),
      lifetimePnL: user.lifetimePnL.toString(),
      _count: {
        comments: user._count.Comment,
        reactions: user._count.Reaction,
        positions: user._count.Position,
        following: user._count.Follow_Follow_followerIdToUser,
        followedBy: user._count.Follow_Follow_followingIdToUser,
        reportsReceived: user._count.Report_Report_reportedUserIdToUser,
        blocksReceived: user._count.UserBlock_UserBlock_blockedIdToUser,
        mutesReceived: user._count.UserMute_UserMute_mutedIdToUser,
        reportsSent: user._count.Report_Report_reporterIdToUser,
      },
      _moderation: {
        reportsReceived: user._moderation.reportsReceived,
        blocksReceived: user._moderation.blocksReceived,
        mutesReceived: user._moderation.mutesReceived,
        reportsSent: user._moderation.reportsSent,
        reportRatio: Number(user._moderation.reportRatio.toFixed(2)),
        blockRatio: Number(user._moderation.blockRatio.toFixed(2)),
        muteRatio: Number(user._moderation.muteRatio.toFixed(2)),
        badUserScore: Number(user._moderation.badUserScore.toFixed(2)),
      },
    })),
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total,
    },
  });
});

