/**
 * Waitlist Mark API
 * POST /api/waitlist/mark
 * 
 * Marks the authenticated user as waitlisted (after they complete onboarding)
 * NOTE: Users should complete onboarding first via /api/users/signup with isWaitlist flag
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { authenticate } from '@/lib/api/auth-middleware'
import { WaitlistService } from '@/lib/services/waitlist-service'
import { logger } from '@/lib/logger'
import { ensureUserForAuth } from '@/lib/users/ensure-user'
import { z } from 'zod'

const MarkSchema = z.object({
  referralCode: z.string().optional(),
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authenticate user - use authenticated user's ID, not from request body
  const authUser = await authenticate(request)
  
  // Ensure user exists in database (create if needed)
  const { user: dbUser } = await ensureUserForAuth(authUser, {
    displayName: authUser.walletAddress 
      ? `${authUser.walletAddress.slice(0, 6)}...${authUser.walletAddress.slice(-4)}`
      : 'User',
  })
  
  let body: { referralCode?: string }
  try {
    body = await request.json() as { referralCode?: string }
  } catch (error) {
    logger.error('Failed to parse request body', { error, userId: dbUser.id }, 'POST /api/waitlist/mark')
    return NextResponse.json({
      success: false,
      error: 'Invalid request body'
    }, { status: 400 })
  }
  const { referralCode } = MarkSchema.parse(body)

  logger.info('Waitlist mark request', {
    userId: dbUser.id,
    hasReferral: !!referralCode,
  }, 'POST /api/waitlist/mark')

  const result = await WaitlistService.markAsWaitlisted(dbUser.id, referralCode)

  if (!result.success) {
    throw new Error(result.error || 'Failed to mark user as waitlisted')
  }

  logger.info('User marked as waitlisted', {
    userId: dbUser.id,
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

