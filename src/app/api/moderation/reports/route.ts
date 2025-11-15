/**
 * Reports API
 * POST /api/moderation/reports - Create a report
 * GET /api/moderation/reports - Get user's reports
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/prisma';
import { CreateReportSchema, GetReportsSchema } from '@/lib/validation/schemas/moderation';
import { logger } from '@/lib/logger';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { generateSnowflakeId } from '@/lib/snowflake';
import { evaluateReport, storeEvaluationResult } from '@/lib/moderation/report-evaluation';

/**
 * POST /api/moderation/reports
 * Create a new report
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  
  const body = await request.json();
  const data = CreateReportSchema.parse(body);

  logger.info(`Creating report`, { 
    reporterId: authUser.userId,
    reportType: data.reportType,
    category: data.category,
  }, 'POST /api/moderation/reports');

  // Validate reported user exists if reporting a user
  if (data.reportedUserId) {
    if (data.reportedUserId === authUser.userId) {
      throw new BusinessLogicError('Cannot report yourself', 'CANNOT_REPORT_SELF');
    }

    const reportedUser = await prisma.user.findUnique({
      where: { id: data.reportedUserId },
      select: { id: true, isActor: true },
    });

    if (!reportedUser) {
      throw new NotFoundError('User', data.reportedUserId);
    }

    // Check for duplicate report (same reporter + reported user + category within 24 hours)
    const recentReport = await prisma.report.findFirst({
      where: {
        reporterId: authUser.userId,
        reportedUserId: data.reportedUserId,
        category: data.category,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (recentReport) {
      throw new BusinessLogicError(
        'You have already reported this user for this reason recently',
        'DUPLICATE_REPORT'
      );
    }
  }

  // Validate reported post exists if reporting a post
  if (data.reportedPostId) {
    const reportedPost = await prisma.post.findUnique({
      where: { id: data.reportedPostId },
      select: { id: true, authorId: true },
    });

    if (!reportedPost) {
      throw new NotFoundError('Post', data.reportedPostId);
    }

    // Check for duplicate report
    const recentReport = await prisma.report.findFirst({
      where: {
        reporterId: authUser.userId,
        reportedPostId: data.reportedPostId,
        category: data.category,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });

    if (recentReport) {
      throw new BusinessLogicError(
        'You have already reported this post for this reason recently',
        'DUPLICATE_REPORT'
      );
    }
  }

  // Determine priority based on category
  let priority = 'normal';
  if (['hate_speech', 'violence', 'self_harm'].includes(data.category)) {
    priority = 'high';
  } else if (data.category === 'spam') {
    priority = 'low';
  }

  // Create report
  const report = await prisma.report.create({
    data: {
      id: await generateSnowflakeId(),
      reporterId: authUser.userId,
      reportedUserId: data.reportedUserId || null,
      reportedPostId: data.reportedPostId || null,
      reportType: data.reportType,
      category: data.category,
      reason: data.reason,
      evidence: data.evidence || null,
      priority,
      status: 'pending',
    },
    include: {
      reporter: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
      reportedUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  logger.info(`Report created successfully`, { 
    reportId: report.id,
    reporterId: authUser.userId,
    reportType: data.reportType,
    category: data.category,
    priority,
  }, 'POST /api/moderation/reports');

  // Automatically evaluate and process the report
  // This ensures fully automated moderation - no human review needed unless user stakes $10 for appeal
  try {
    const evaluation = await evaluateReport(report.id);
    await storeEvaluationResult(report.id, evaluation);

    // If evaluation indicates valid scammer/CSAM report with high confidence, automatically ban
    // Check if recommendedActions suggest banning or if reasoning indicates scamming/CSAM
    const shouldAutoBan = 
      evaluation.outcome === 'valid_report' &&
      evaluation.confidence >= 0.8 &&
      report.reportedUserId !== null &&
      (evaluation.recommendedActions.includes('ban_user') || 
       evaluation.recommendedActions.includes('ban') ||
       evaluation.recommendedActions.includes('mark_scammer') ||
       evaluation.recommendedActions.includes('mark_csam') ||
       evaluation.reasoning.toLowerCase().includes('scam') ||
       evaluation.reasoning.toLowerCase().includes('csam') ||
       evaluation.reasoning.toLowerCase().includes('child sexual abuse'))

    if (shouldAutoBan && report.reportedUserId) {
      // Determine if scammer or CSAM based on evaluation
      const isScammer = evaluation.recommendedActions.includes('mark_scammer') || 
                        evaluation.reasoning.toLowerCase().includes('scam')
      const isCSAM = evaluation.recommendedActions.includes('mark_csam') ||
                     evaluation.reasoning.toLowerCase().includes('csam') ||
                     evaluation.reasoning.toLowerCase().includes('child sexual abuse')

      // Automatically ban the reported user
      if (report.reportedUserId) {
        await prisma.user.update({
          where: { id: report.reportedUserId },
          data: {
            isBanned: true,
            bannedAt: new Date(),
            bannedReason: `Automated ban from report #${report.id}: ${evaluation.reasoning.substring(0, 200)}`,
            bannedBy: undefined, // System ban - no specific admin
            isScammer: isScammer,
            isCSAM: isCSAM,
          },
        });
      }

      // Update report status
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: 'resolved',
          resolution: `User automatically banned: ${evaluation.reasoning.substring(0, 200)}`,
          resolvedBy: null, // System resolution - no specific admin
          resolvedAt: new Date(),
        },
      });

      logger.info('User automatically banned from report', {
        reportId: report.id,
        reportedUserId: report.reportedUserId,
        evaluationOutcome: evaluation.outcome,
        confidence: evaluation.confidence,
      }, 'POST /api/moderation/reports');
    } else {
      // Store evaluation but don't auto-ban (low confidence or not scammer/CSAM)
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: 'reviewing',
          resolution: JSON.stringify(evaluation),
        },
      });
    }
  } catch (error) {
    // Don't fail report creation if evaluation fails - log and continue
    logger.error('Failed to automatically evaluate report', {
      reportId: report.id,
      error: error instanceof Error ? error.message : String(error),
    }, 'POST /api/moderation/reports');
  }

  return successResponse({
    success: true,
    message: 'Report submitted successfully. It has been automatically evaluated.',
    report,
  });
});

/**
 * GET /api/moderation/reports
 * Get current user's submitted reports
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request);
  
  const { searchParams } = new URL(request.url);
  const params = GetReportsSchema.parse({
    limit: searchParams.get('limit') || '50',
    offset: searchParams.get('offset') || '0',
    status: searchParams.get('status') || undefined,
    category: searchParams.get('category') || undefined,
    reportType: searchParams.get('reportType') || undefined,
  });

  // Build where clause
  const where: Record<string, unknown> = {
    reporterId: authUser.userId,
  };

  if (params.status) where.status = params.status;
  if (params.category) where.category = params.category;
  if (params.reportType) where.reportType = params.reportType;

  const [reports, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: params.offset,
      include: {
        reportedUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
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
    }),
    prisma.report.count({ where }),
  ]);

  return successResponse({
    reports,
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total,
    },
  });
});


