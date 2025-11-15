/**
 * Admin Report Management API
 * GET /api/admin/reports/[reportId] - Get report details
 * POST /api/admin/reports/[reportId] - Update report status
 */

import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/admin-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';
import { AdminReportActionSchema } from '@/lib/validation/schemas/moderation';
import { logger } from '@/lib/logger';
import { NotFoundError } from '@/lib/errors';
import { evaluateReport, storeEvaluationResult } from '@/lib/moderation/report-evaluation';

/**
 * GET /api/admin/reports/[reportId]
 * Get detailed report information
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) => {
  await requireAdmin(request);
  const { reportId } = await context.params;

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    include: {
      reporter: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          createdAt: true,
          reputationPoints: true,
        },
      },
      reportedUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          isBanned: true,
          bannedAt: true,
          bannedReason: true,
          createdAt: true,
          reputationPoints: true,
        },
      },
      resolver: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  if (!report) {
    throw new NotFoundError('Report', reportId);
  }

  // Get related reports for the same user/post
  const relatedReports = await prisma.report.findMany({
    where: {
      OR: [
        { reportedUserId: report.reportedUserId || undefined },
        { reportedPostId: report.reportedPostId || undefined },
      ],
      id: { not: reportId },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      category: true,
      status: true,
      priority: true,
      createdAt: true,
      reporter: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  // Parse evaluation if it exists
  let evaluation = null;
  if (report.resolution) {
    try {
      evaluation = JSON.parse(report.resolution);
    } catch {
      // Not JSON, treat as plain text resolution
    }
  }

  return successResponse({
    report: {
      ...report,
      evaluation,
    },
    relatedReports,
  });
});

/**
 * POST /api/admin/reports/[reportId]
 * Take action on a report
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ reportId: string }> }
) => {
  const adminUser = await requireAdmin(request);
  const { reportId } = await context.params;

  const body = await request.json();
  const { action, resolution } = AdminReportActionSchema.parse(body);
  
  // Handle evaluate action (doesn't require resolution)
  if (action === 'evaluate') {
    const evaluation = await evaluateReport(reportId);
    await storeEvaluationResult(reportId, evaluation);
    
    logger.info('Report evaluated', {
      reportId,
      outcome: evaluation.outcome,
      confidence: evaluation.confidence,
    }, 'POST /api/admin/reports/[reportId]');
    
    return successResponse({
      success: true,
      message: 'Report evaluated successfully',
      evaluation,
    });
  }

  logger.info(`Admin taking action on report`, { 
    adminUserId: adminUser.userId,
    reportId,
    action 
  }, 'POST /api/admin/reports/[reportId]');

  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      reportedUserId: true,
      reportedPostId: true,
      status: true,
    },
  });

  if (!report) {
    throw new NotFoundError('Report', reportId);
  }

  // Handle different actions
  if (action === 'resolve') {
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'resolved',
        resolution,
        resolvedBy: adminUser.userId,
        resolvedAt: new Date(),
      },
    });
  } else if (action === 'dismiss') {
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'dismissed',
        resolution,
        resolvedBy: adminUser.userId,
        resolvedAt: new Date(),
      },
    });
  } else if (action === 'escalate') {
    await prisma.report.update({
      where: { id: reportId },
      data: {
        priority: 'critical',
        status: 'reviewing',
        resolution,
      },
    });
  } else if (action === 'ban_user') {
    if (!report.reportedUserId) {
      throw new Error('Cannot ban user: no user associated with this report');
    }

    // Ban the reported user
    await prisma.user.update({
      where: { id: report.reportedUserId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: `Report #${reportId}: ${resolution}`,
        bannedBy: adminUser.userId,
      },
    });

    // Update report
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'resolved',
        resolution: `User banned: ${resolution}`,
        resolvedBy: adminUser.userId,
        resolvedAt: new Date(),
      },
    });
  }

  logger.info(`Admin action completed on report`, { 
    adminUserId: adminUser.userId,
    reportId,
    action 
  }, 'POST /api/admin/reports/[reportId]');

  return successResponse({
    success: true,
    message: `Report ${action} successfully`,
  });
});


