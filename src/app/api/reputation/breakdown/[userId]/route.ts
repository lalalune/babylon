/**
 * Reputation Breakdown API
 *
 * GET /api/reputation/breakdown/[userId]
 * Returns detailed breakdown of reputation score components:
 * - PNL Component (40% weight)
 * - Feedback Component (40% weight)
 * - Activity Component (20% weight)
 * - Raw metrics and confidence scores
 */


import { NextResponse } from 'next/server'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { getReputationBreakdown } from '@/lib/reputation/reputation-service'
import { logger } from '@/lib/logger'

interface RouteParams {
  params: Promise<{
    userId: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 })
    }

    // Verify user exists
    const user = await requireUserByIdentifier(userId)

    // Get detailed reputation breakdown
    const breakdown = await getReputationBreakdown(user.id)

    if (!breakdown) {
      // No reputation data yet - return default breakdown
      return NextResponse.json({
        success: true,
        userId: user.id,
        reputationScore: 1000,
        trustLevel: 'newcomer',
        confidenceScore: 0,
        breakdown: {
          pnlComponent: 0,
          feedbackComponent: 0,
          activityComponent: 0,
        },
        metrics: {
          normalizedPnL: 0,
          averageFeedbackScore: 50,
          gamesPlayed: 0,
          totalFeedbackCount: 0,
          winRate: 0,
        },
        weights: {
          pnl: 0.4,
          feedback: 0.4,
          activity: 0.2,
        },
      })
    }

    return NextResponse.json({
      success: true,
      userId: user.id,
      reputationScore: breakdown.reputationScore,
      trustLevel: breakdown.trustLevel,
      confidenceScore: breakdown.confidenceScore,
      breakdown: breakdown.breakdown,
      metrics: breakdown.metrics,
      weights: {
        pnl: 0.4,
        feedback: 0.4,
        activity: 0.2,
      },
    })
  } catch (error) {
    logger.error('Failed to get reputation breakdown', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Failed to get reputation breakdown' }, { status: 500 })
  }
}
