/**
 * API Route: /api/admin/fees
 * Methods: GET (fetch fee statistics)
 * 
 * Provides comprehensive fee statistics for the admin panel:
 * - Global fee totals
 * - Fee breakdown by type
 * - Top fee payers
 * - Recent fee transactions
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { errorResponse, successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';
import { FeeService } from '@/lib/services/fee-service';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/admin/fees
 * Fetch comprehensive fee statistics
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Verify admin access
  await requireAdmin(request);

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const limitParam = searchParams.get('limit');

  const startDate = startDateParam ? new Date(startDateParam) : undefined;
  if (startDateParam && startDate && Number.isNaN(startDate.getTime())) {
    return errorResponse(
      'Invalid startDate parameter. Expected an ISO 8601 date string.',
      'INVALID_QUERY_PARAM',
      400,
      { startDate: startDateParam }
    );
  }

  const endDate = endDateParam ? new Date(endDateParam) : undefined;
  if (endDateParam && endDate && Number.isNaN(endDate.getTime())) {
    return errorResponse(
      'Invalid endDate parameter. Expected an ISO 8601 date string.',
      'INVALID_QUERY_PARAM',
      400,
      { endDate: endDateParam }
    );
  }

  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 10;
  if (limitParam && (Number.isNaN(parsedLimit) || parsedLimit <= 0)) {
    return errorResponse(
      'Invalid limit parameter. Expected a positive integer.',
      'INVALID_QUERY_PARAM',
      400,
      { limit: limitParam }
    );
  }

  const limit = Math.min(parsedLimit, 100);

  const dateFilter: Prisma.TradingFeeWhereInput = startDate || endDate
    ? {
        createdAt: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      }
    : {};

  // Get platform-wide fee statistics (user fees from TradingFee table)
  const platformStats = await FeeService.getPlatformFeeStats(startDate, endDate);

  // Get NPC fees from Pool.totalFeesCollected
  const poolFeesResult = await prisma.pool.aggregate({
    _sum: {
      totalFeesCollected: true,
    },
  });
  const totalNPCFees = Number(poolFeesResult._sum.totalFeesCollected || 0);

  // Combine user and NPC fees for total
  const totalFeesCollected = platformStats.totalFeesCollected + totalNPCFees;

  // Get fee breakdown by type
  const whereClause: Prisma.TradingFeeWhereInput = {
    ...dateFilter,
  };

  const feesByType = await prisma.tradingFee.groupBy({
    by: ['tradeType'],
    where: whereClause,
    _sum: {
      feeAmount: true,
      platformFee: true,
      referrerFee: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        feeAmount: 'desc',
      },
    },
  });

  // Get top fee payers (users who paid the most fees)
  const topFeePayers = await prisma.tradingFee.groupBy({
    by: ['userId'],
    where: whereClause,
    _sum: {
      feeAmount: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        feeAmount: 'desc',
      },
    },
    take: limit,
  });

  // Enrich with user/actor data
  const enrichedTopFeePayers = await Promise.all(
    topFeePayers.map(async (item) => {
      // Try to find as User first
      const user = await prisma.user.findUnique({
        where: { id: item.userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          isActor: true,
        },
      });

      if (user) {
        return {
          userId: item.userId,
          username: user.username || 'Unknown',
          displayName: user.displayName || 'Unknown User',
          profileImageUrl: user.profileImageUrl || null,
          isNPC: user.isActor,
          totalFees: Number(item._sum.feeAmount || 0),
          tradeCount: item._count,
        };
      }

      // Try to find as Actor (NPC)
      const actor = await prisma.actor.findUnique({
        where: { id: item.userId },
        select: {
          id: true,
          name: true,
          profileImageUrl: true,
        },
      });

      return {
        userId: item.userId,
        username: actor?.name || 'Unknown NPC',
        displayName: actor?.name || 'Unknown NPC',
        profileImageUrl: actor?.profileImageUrl || null,
        isNPC: true,
        totalFees: Number(item._sum.feeAmount || 0),
        tradeCount: item._count,
      };
    })
  );

  // Get top referral fee earners
  const topReferralEarners = await prisma.tradingFee.groupBy({
    by: ['referrerId'],
    where: {
      ...dateFilter,
      referrerId: { not: null },
    },
    _sum: {
      referrerFee: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        referrerFee: 'desc',
      },
    },
    take: limit,
  });

  // Enrich with user data
  const enrichedTopReferralEarners = await Promise.all(
    topReferralEarners.map(async (item) => {
      const user = await prisma.user.findUnique({
        where: { id: item.referrerId! },
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
        },
      });

      return {
        userId: item.referrerId!,
        username: user?.username || 'Unknown',
        displayName: user?.displayName || 'Unknown User',
        profileImageUrl: user?.profileImageUrl || null,
        totalEarned: Number(item._sum.referrerFee || 0),
        referralCount: item._count,
      };
    })
  );

  // Get recent fee transactions
  const recentFees = await prisma.tradingFee.findMany({
    where: whereClause,
    select: {
      id: true,
      userId: true,
      tradeType: true,
      feeAmount: true,
      platformFee: true,
      referrerFee: true,
      createdAt: true,
      User_TradingFee_userIdToUser: {
        select: {
          username: true,
          displayName: true,
          profileImageUrl: true,
          isActor: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });

  // Try to enrich recent fees with actor data for NPCs
  const enrichedRecentFees = await Promise.all(
    recentFees.map(async (fee) => {
      let userData = fee.User_TradingFee_userIdToUser;
      
      // If no user data, try to find actor
      if (!userData) {
        const actor = await prisma.actor.findUnique({
          where: { id: fee.userId },
          select: {
            name: true,
            profileImageUrl: true,
          },
        });

        if (actor) {
          userData = {
            username: actor.name,
            displayName: actor.name,
            profileImageUrl: actor.profileImageUrl,
            isActor: true,
          };
        }
      }

      return {
        id: fee.id,
        userId: fee.userId,
        username: userData?.username || 'Unknown',
        displayName: userData?.displayName || 'Unknown',
        profileImageUrl: userData?.profileImageUrl || null,
        isNPC: userData?.isActor || false,
        tradeType: fee.tradeType,
        feeAmount: Number(fee.feeAmount),
        platformFee: Number(fee.platformFee),
        referrerFee: Number(fee.referrerFee),
        createdAt: fee.createdAt.toISOString(),
      };
    })
  );

  // Get fee trend data (daily aggregates for the past 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trendStartDate =
    startDate && startDate > thirtyDaysAgo ? startDate : thirtyDaysAgo;

  const dailyFeeRecords = await prisma.tradingFee.findMany({
    where: {
      ...dateFilter,
      createdAt: {
        gte: trendStartDate,
        ...(endDate ? { lte: endDate } : {}),
      },
    },
    select: {
      createdAt: true,
      feeAmount: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const trendMap = new Map<
    string,
    { totalFees: number; tradeCount: number }
  >();

  for (const record of dailyFeeRecords) {
    const dayKey = record.createdAt?.toISOString().split('T')[0];
    if (!dayKey) continue;
    const existing = trendMap.get(dayKey) ?? { totalFees: 0, tradeCount: 0 };

    existing.totalFees += Number(record.feeAmount || 0);
    existing.tradeCount += 1;

    trendMap.set(dayKey, existing);
  }

  const feeTrend = Array.from(trendMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, values]) => ({
      date,
      totalFees: Number(values.totalFees.toFixed(2)),
      tradeCount: values.tradeCount,
    }));

  return successResponse({
    platformStats: {
      totalFeesCollected, // Combined user + NPC fees
      totalUserFees: platformStats.totalFeesCollected,
      totalNPCFees,
      totalPlatformFees: platformStats.totalPlatformFees + totalNPCFees, // NPCs have no referrers, all goes to platform
      totalReferrerFees: platformStats.totalReferrerFees,
      totalTrades: platformStats.totalTrades,
    },
    feesByType: feesByType.map((item) => ({
      tradeType: item.tradeType,
      totalFees: Number(item._sum.feeAmount || 0),
      platformFees: Number(item._sum.platformFee || 0),
      referrerFees: Number(item._sum.referrerFee || 0),
      tradeCount: item._count,
    })),
    topFeePayers: enrichedTopFeePayers,
    topReferralEarners: enrichedTopReferralEarners,
    recentFees: enrichedRecentFees,
    feeTrend,
  });
});

