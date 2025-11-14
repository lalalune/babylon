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

    // Get reputation breakdown
    const reputation = await getReputationBreakdown(user.id)

    if (!reputation) {
      // No reputation data yet - return default values
      return NextResponse.json({
        success: true,
        userId: user.id,
        reputationPoints: 1000, // Default starting reputation
        averageFeedbackScore: 50,
        totalFeedbackReceived: 0,
        performance: {
          gamesPlayed: 0,
          gamesWon: 0,
          averageGameScore: 0,
          winRate: 0,
        },
        recentTrend: 0,
        trustLevel: 'newcomer',
        rank: null,
        totalUsers: 0,
      })
    }

    // Get agent metrics for additional data
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

    if (!metrics) {
      return NextResponse.json({
        success: true,
        userId: user.id,
        reputationPoints: 1000,
        averageFeedbackScore: 50,
        totalFeedbackReceived: 0,
        performance: {
          gamesPlayed: 0,
          gamesWon: 0,
          averageGameScore: 0,
          winRate: 0,
        },
        recentTrend: 0,
        trustLevel: 'newcomer',
        rank: null,
        totalUsers: 0,
      })
    }

    // Calculate rank (number of users with higher reputation)
    const rank = await prisma.agentPerformanceMetrics.count({
      where: {
        reputationScore: {
          gt: metrics.reputationScore,
        },
      },
    })

    // Get total users with reputation data
    const totalUsers = await prisma.agentPerformanceMetrics.count()

    // Calculate recent trend (simple version - compare to 7 days ago)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // For now, return 0 trend (would need historical data for accurate trend)
    const recentTrend = 0

    return NextResponse.json({
      success: true,
      userId: user.id,
      reputationPoints: Math.round(metrics.reputationScore),
      averageFeedbackScore: metrics.averageFeedbackScore,
      totalFeedbackReceived: metrics.totalFeedbackCount,
      performance: {
        gamesPlayed: metrics.gamesPlayed,
        gamesWon: metrics.gamesWon,
        averageGameScore: metrics.averageGameScore,
        winRate: metrics.winRate,
      },
      recentTrend,
      trustLevel: metrics.trustLevel,
      rank: rank + 1, // +1 because count gives 0-indexed position
      totalUsers,
    })
  } catch (error) {
    logger.error('Failed to get user reputation', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Failed to get reputation' }, { status: 500 })
  }
}
