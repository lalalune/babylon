/**
 * Human Review API
 * GET /api/admin/moderation/human-review - Get appeals needing human review
 */

import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { prisma } from '@/lib/prisma'

export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireAdmin(request)

  const appeals = await prisma.user.findMany({
    where: {
      appealStatus: 'human_review',
      isBanned: true,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileImageUrl: true,
      bannedAt: true,
      bannedReason: true,
      bannedBy: true,
      isScammer: true,
      isCSAM: true,
      appealCount: true,
      appealStaked: true,
      appealStakeAmount: true,
      appealStakeTxHash: true,
      appealSubmittedAt: true,
      falsePositiveHistory: true,
      earnedPoints: true,
      totalDeposited: true,
      totalWithdrawn: true,
      lifetimePnL: true,
    },
    orderBy: {
      appealSubmittedAt: 'asc', // Oldest first
    },
  })

  return successResponse({ appeals })
})

