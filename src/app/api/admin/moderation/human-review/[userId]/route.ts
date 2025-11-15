/**
 * Human Review API - Process Individual Appeal
 * POST /api/admin/moderation/human-review/[userId]
 */

import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { createNotification } from '@/lib/services/notification-service'
import { WalletService } from '@/lib/services/wallet-service'
import type { Prisma } from '@prisma/client'

const HumanReviewActionSchema = z.object({
  action: z.enum(['approve', 'deny']),
  reasoning: z.string().min(10).max(2000),
})

export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  const adminUser = await requireAdmin(request)
  const { userId } = await context.params

  const body = await request.json()
  const { action, reasoning } = HumanReviewActionSchema.parse(body)

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      appealStatus: true,
      isBanned: true,
      appealStaked: true,
      appealStakeAmount: true,
      falsePositiveHistory: true,
    },
  })

  if (!user || user.appealStatus !== 'human_review') {
    return successResponse({ success: false, error: 'Appeal not in human review' }, 400)
  }

  if (action === 'approve') {
    // Mark as false positive and restore account
    const falsePositiveHistory = (user.falsePositiveHistory as Array<Record<string, unknown>> | null) || []
    falsePositiveHistory.push({
      date: new Date().toISOString(),
      reason: reasoning,
      reviewedBy: adminUser.userId,
      type: 'human_review',
    })

    await prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        isScammer: false,
        isCSAM: false,
        bannedAt: null,
        bannedBy: null,
        bannedReason: null,
        appealStatus: 'approved',
        appealReviewedAt: new Date(),
        falsePositiveHistory: falsePositiveHistory as Prisma.InputJsonValue,
      },
    })

    // Refund stake if staked
    if (user.appealStaked && user.appealStakeAmount) {
      await refundAppealStake(userId, Number(user.appealStakeAmount))
    }

    await createNotification({
      userId,
      type: 'system',
      title: 'Appeal Approved - Account Restored',
      message: `A moderator reviewed your appeal and restored your account. ${reasoning}`,
    })

    logger.info('Human review approved', {
      userId,
      adminUserId: adminUser.userId,
      reasoning,
    }, 'HumanReview')

    return successResponse({
      success: true,
      message: 'Appeal approved - account restored',
    })
  } else {
    // Deny - permanent ban
    await prisma.user.update({
      where: { id: userId },
      data: {
        appealStatus: 'denied',
        appealReviewedAt: new Date(),
        // Keep banned, scammer, CSAM flags
      },
    })

    await createNotification({
      userId,
      type: 'system',
      title: 'Appeal Denied - Permanent Ban',
      message: `After human review, your appeal was denied. ${reasoning}`,
    })

    logger.info('Human review denied', {
      userId,
      adminUserId: adminUser.userId,
      reasoning,
    }, 'HumanReview')

    return successResponse({
      success: true,
      message: 'Appeal denied - permanent ban confirmed',
    })
  }
})

/**
 * Refund appeal stake to user's virtual balance
 */
async function refundAppealStake(userId: string, stakeAmount: number): Promise<void> {
  try {
    await WalletService.credit(
      userId,
      stakeAmount,
      'appeal_stake_refund',
      `Appeal stake refund - account restored via human review`,
      undefined
    )

    // Clear stake flags
    await prisma.user.update({
      where: { id: userId },
      data: {
        appealStaked: false,
        appealStakeAmount: null,
        appealStakeTxHash: null,
      },
    })

    logger.info('Appeal stake refunded', {
      userId,
      stakeAmount,
    }, 'HumanReview')
  } catch (error) {
    logger.error('Failed to refund appeal stake', { error, userId, stakeAmount }, 'HumanReview')
    // Don't throw - refund failure shouldn't block account restoration
  }
}

