/**
 * Reports API
 * POST /api/moderation/reports - Create a report
 * GET /api/moderation/reports - Get user's reports
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { prisma } from '@/lib/database-service';
import { CreateReportSchema, GetReportsSchema } from '@/lib/validation/schemas/moderation';
import { logger } from '@/lib/logger';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { generateSnowflakeId } from '@/lib/snowflake';

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

  return successResponse({
    success: true,
    message: 'Report submitted successfully. Our moderation team will review it.',
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


