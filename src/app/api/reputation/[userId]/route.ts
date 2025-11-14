/**
 * User Reputation API
 *
 * GET /api/reputation/[userId]
 * Returns comprehensive reputation data for a user including:
 * - Overall reputation score and trust level
 * - Feedback statistics
 * - Game performance metrics
 * - Trading performance
 */


import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database-service'
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

  await getReputationBreakdown(user.id)

  const metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId: user.id },
    select: {
      gamesPlayed: true,
      gamesWon: true,
      averageGameScore: true,
      winRate: true,
      totalFeedbackCount: true,
      averageFeedbackScore: true,
      reputationScore: true,
      trustLevel: true,
      lastActivityAt: true,
    },
  })

  const rank = await prisma.agentPerformanceMetrics.count({
    where: {
      reputationScore: {
        gt: metrics!.reputationScore,
      },
    },
  })

  const totalUsers = await prisma.agentPerformanceMetrics.count()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const recentTrend = 0

  return NextResponse.json({
    success: true,
    userId: user.id,
    reputationPoints: Math.round(metrics!.reputationScore),
    averageFeedbackScore: metrics!.averageFeedbackScore,
    totalFeedbackReceived: metrics!.totalFeedbackCount,
    performance: {
      gamesPlayed: metrics!.gamesPlayed,
      gamesWon: metrics!.gamesWon,
      averageGameScore: metrics!.averageGameScore,
      winRate: metrics!.winRate,
    },
    recentTrend,
    trustLevel: metrics!.trustLevel,
    rank: rank + 1,
    totalUsers,
  })
}
