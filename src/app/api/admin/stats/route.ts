/**
 * Admin API: System Statistics
 * GET /api/admin/stats
 * 
 * Returns system-wide statistics and metrics
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Require admin authentication
  await requireAdmin(request);

  logger.info(`Admin stats requested`, {}, 'GET /api/admin/stats');

  // Get current date for time-based queries
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  // Run all queries in parallel
  const [
    // User counts
    totalUsers,
    totalActors,
    totalRealUsers,
    bannedUsers,
    adminUsers,
    usersToday,
    usersThisWeek,
    usersThisMonth,
    
    // Market and trading data
    totalMarkets,
    activeMarkets,
    resolvedMarkets,
    totalPositions,
    totalBalanceTransactions,
    totalNPCTrades,
    
    // Social engagement
    totalPosts,
    totalComments,
    totalReactions,
    postsToday,
    
    // Financial metrics
    totalVirtualBalance,
    totalDeposited,
    totalWithdrawn,
    totalLifetimePnL,
    
    // Pools
    totalPools,
    activePools,
    totalPoolDeposits,
    
    // Referrals and reputation
    totalReferrals,
    totalPointsTransactions,
  ] = await Promise.all([
    // User counts
    prisma.user.count(),
    prisma.user.count({ where: { isActor: true } }),
    prisma.user.count({ where: { isActor: false } }),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.user.count({ where: { isAdmin: true } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.user.count({ where: { createdAt: { gte: lastWeek } } }),
    prisma.user.count({ where: { createdAt: { gte: lastMonth } } }),
    
    // Market and trading data
    prisma.market.count(),
    prisma.market.count({ where: { resolved: false, endDate: { gte: now } } }),
    prisma.market.count({ where: { resolved: true } }),
    prisma.position.count(),
    prisma.balanceTransaction.count(),
    prisma.nPCTrade.count(),
    
    // Social engagement
    prisma.post.count(),
    prisma.comment.count(),
    prisma.reaction.count(),
    prisma.post.count({ where: { createdAt: { gte: today } } }),
    
    // Financial metrics
    prisma.user.aggregate({
      _sum: { virtualBalance: true },
    }),
    prisma.user.aggregate({
      _sum: { totalDeposited: true },
    }),
    prisma.user.aggregate({
      _sum: { totalWithdrawn: true },
    }),
    prisma.user.aggregate({
      _sum: { lifetimePnL: true },
    }),
    
    // Pools
    prisma.pool.count(),
    prisma.pool.count({ where: { isActive: true } }),
    prisma.poolDeposit.count(),
    
    // Referrals and reputation
    prisma.referral.count(),
    prisma.pointsTransaction.count(),
  ]);

  // Get top users by balance
  const topUsersByBalance = await prisma.user.findMany({
    where: { isActor: false },
    orderBy: { virtualBalance: 'desc' },
    take: 10,
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      virtualBalance: true,
      lifetimePnL: true,
    },
  });

  // Get top users by reputation
  const topUsersByReputation = await prisma.user.findMany({
    where: { isActor: false },
    orderBy: { reputationPoints: 'desc' },
    take: 10,
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      reputationPoints: true,
    },
  });

  // Get recent signups
  const recentSignups = await prisma.user.findMany({
    where: { isActor: false },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      walletAddress: true,
      createdAt: true,
      onChainRegistered: true,
      hasFarcaster: true,
      hasTwitter: true,
    },
  });

  return successResponse({
    users: {
      total: totalUsers,
      actors: totalActors,
      realUsers: totalRealUsers,
      banned: bannedUsers,
      admins: adminUsers,
      signups: {
        today: usersToday,
        thisWeek: usersThisWeek,
        thisMonth: usersThisMonth,
      },
    },
    markets: {
      total: totalMarkets,
      active: activeMarkets,
      resolved: resolvedMarkets,
      positions: totalPositions,
    },
    trading: {
      balanceTransactions: totalBalanceTransactions,
      npcTrades: totalNPCTrades,
    },
    social: {
      posts: totalPosts,
      postsToday: postsToday,
      comments: totalComments,
      reactions: totalReactions,
    },
    financial: {
      totalVirtualBalance: totalVirtualBalance._sum.virtualBalance?.toString() || '0',
      totalDeposited: totalDeposited._sum.totalDeposited?.toString() || '0',
      totalWithdrawn: totalWithdrawn._sum.totalWithdrawn?.toString() || '0',
      totalLifetimePnL: totalLifetimePnL._sum.lifetimePnL?.toString() || '0',
    },
    pools: {
      total: totalPools,
      active: activePools,
      deposits: totalPoolDeposits,
    },
    engagement: {
      referrals: totalReferrals,
      pointsTransactions: totalPointsTransactions,
    },
    topUsers: {
      byBalance: topUsersByBalance.map(u => ({
        ...u,
        virtualBalance: u.virtualBalance.toString(),
        lifetimePnL: u.lifetimePnL.toString(),
      })),
      byReputation: topUsersByReputation,
    },
    recentSignups,
  });
});

