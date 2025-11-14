/**
 * Waitlist Mark API
 * POST /api/waitlist/mark
 * 
 * Marks an existing user as waitlisted (after they complete onboarding)
 * NOTE: Users should complete onboarding first via /api/users/signup with isWaitlist flag
 */

import type { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { WaitlistService } from '@/lib/services/waitlist-service'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const MarkSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  referralCode: z.string().optional(),
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const body = await request.json()
  const { userId, referralCode } = MarkSchema.parse(body)

  logger.info('Waitlist mark request', {
    userId,
    hasReferral: !!referralCode,
  }, 'POST /api/waitlist/mark')

  const result = await WaitlistService.markAsWaitlisted(userId, referralCode)

  if (!result.success) {
    throw new Error(result.error || 'Failed to mark user as waitlisted')
  }

  logger.info('User marked as waitlisted', {
    userId,
    position: result.waitlistPosition,
    referrerRewarded: result.referrerRewarded,
  }, 'POST /api/waitlist/mark')

  return successResponse({
    waitlistPosition: result.waitlistPosition,
    inviteCode: result.inviteCode,
    points: result.points,
    referrerRewarded: result.referrerRewarded,
  })
})

