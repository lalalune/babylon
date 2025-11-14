/**
 * Waitlist Position API
 * GET /api/waitlist/position?userId={userId}
 */

import type { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { WaitlistService } from '@/lib/services/waitlist-service'
import { logger } from '@/lib/logger'
import { NotFoundError } from '@/lib/errors'

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    throw new Error('userId parameter is required')
  }

  logger.info('Waitlist position request', { userId }, 'GET /api/waitlist/position')

  const position = await WaitlistService.getWaitlistPosition(userId)

  if (!position) {
    throw new NotFoundError('Waitlist position', userId)
  }

  return successResponse({
    // IMPORTANT: Return leaderboardRank as "position" for UI compatibility
    position: position.leaderboardRank,      // Dynamic rank based on invite points
    leaderboardRank: position.leaderboardRank,
    waitlistPosition: position.waitlistPosition, // Historical record
    totalAhead: position.totalAhead,
    totalCount: position.totalCount,
    percentile: position.percentile,
    inviteCode: position.inviteCode,
    points: position.points,
    pointsBreakdown: {
      total: position.points,
      invite: position.invitePoints,
      earned: position.earnedPoints,
      bonus: position.bonusPoints,
    },
    referralCount: position.referralCount,
  })
})

