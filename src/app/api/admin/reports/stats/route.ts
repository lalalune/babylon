/**
 * Admin Reports Statistics API
 * GET /api/admin/reports/stats
 * 
 * Get comprehensive statistics about reports
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request);

  logger.info('Admin reports stats requested', {}, 'GET /api/admin/reports/stats');

  // Get counts by status
  const [
    totalReports,
    pendingReports,
    reviewingReports,
    resolvedReports,
    dismissedReports,
  ] = await Promise.all([
    prisma.report.count(),
    prisma.report.count({ where: { status: 'pending' } }),
    prisma.report.count({ where: { status: 'reviewing' } }),
    prisma.report.count({ where: { status: 'resolved' } }),
    prisma.report.count({ where: { status: 'dismissed' } }),
  ]);

  // Get counts by category
  const reportsByCategory = await prisma.report.groupBy({
    by: ['category'],
    _count: true,
    orderBy: {
      _count: {
        category: 'desc',
      },
    },
  });

  // Get counts by priority
  const reportsByPriority = await prisma.report.groupBy({
    by: ['priority'],
    _count: true,
  });

  // Get top reported users
  const topReportedUsers = await prisma.report.groupBy({
    by: ['reportedUserId'],
    where: {
      reportedUserId: { not: null },
    },
    _count: true,
    orderBy: {
      _count: {
        reportedUserId: 'desc',
      },
    },
    take: 10,
  });

  // Get user details for top reported users
  const topReportedUsersWithDetails = await Promise.all(
    topReportedUsers.map(async (item) => {
      const user = await prisma.user.findUnique({
        where: { id: item.reportedUserId! },
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          isBanned: true,
        },
      });
      return {
        user,
        reportCount: item._count,
      };
    })
  );

  // Get top reporters
  const topReporters = await prisma.report.groupBy({
    by: ['reporterId'],
    _count: true,
    orderBy: {
      _count: {
        reporterId: 'desc',
      },
    },
    take: 10,
  });

  // Get user details for top reporters
  const topReportersWithDetails = await Promise.all(
    topReporters.map(async (item) => {
      const user = await prisma.user.findUnique({
        where: { id: item.reporterId },
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
        },
      });
      return {
        user,
        reportCount: item._count,
      };
    })
  );

  // Get recent activity (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentReports = await prisma.report.count({
    where: {
      createdAt: {
        gte: sevenDaysAgo,
      },
    },
  });

  const recentResolved = await prisma.report.count({
    where: {
      resolvedAt: {
        gte: sevenDaysAgo,
      },
    },
  });

  return successResponse({
    totals: {
      total: totalReports,
      pending: pendingReports,
      reviewing: reviewingReports,
      resolved: resolvedReports,
      dismissed: dismissedReports,
    },
    byCategory: reportsByCategory.map(item => ({
      category: item.category,
      count: item._count,
    })),
    byPriority: reportsByPriority.map(item => ({
      priority: item.priority,
      count: item._count,
    })),
    topReportedUsers: topReportedUsersWithDetails,
    topReporters: topReportersWithDetails,
    recentActivity: {
      last7Days: recentReports,
      resolved7Days: recentResolved,
    },
  });
});


