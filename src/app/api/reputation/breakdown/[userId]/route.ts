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

interface RouteParams {
  params: Promise<{
    userId: string
  }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { userId } = await params

  const user = await requireUserByIdentifier(userId)

  const breakdown = await getReputationBreakdown(user.id)

  return NextResponse.json({
    success: true,
    userId: user.id,
    reputationScore: breakdown!.reputationScore,
    trustLevel: breakdown!.trustLevel,
    confidenceScore: breakdown!.confidenceScore,
    breakdown: breakdown!.breakdown,
    metrics: breakdown!.metrics,
    weights: {
      pnl: 0.4,
      feedback: 0.4,
      activity: 0.2,
    },
  })
}
