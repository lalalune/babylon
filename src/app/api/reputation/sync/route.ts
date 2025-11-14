/**
 * Reputation Synchronization API
 *
 * Endpoints for manual reputation sync with Agent0 network:
 * - POST /api/reputation/sync - Sync specific user or all users (manual trigger)
 * - GET /api/reputation/sync/status - Get sync status for a user
 * 
 * Note: Automatic periodic sync runs every 3 hours via the game tick cron job.
 * This endpoint is for manual/on-demand syncs only.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { periodicReputationSync, syncUserReputationNow } from '@/lib/reputation/agent0-reputation-sync'
import { getReputationBreakdown } from '@/lib/reputation/reputation-service'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'

interface SyncRequest {
  userId?: string
  force?: boolean
}

/**
 * POST /api/reputation/sync
 * Sync reputation data with Agent0 network
 */
export async function POST(request: NextRequest) {
  let body: SyncRequest = {}
  body = (await request.json()) as SyncRequest

  if (body.userId) {
    const user = await requireUserByIdentifier(body.userId)

    const metrics = await syncUserReputationNow(user.id)

    logger.info('Manual reputation sync completed', {
      userId: user.id,
      force: body.force,
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      metrics,
      message: 'User reputation synced successfully',
    })
  } else {
    const results = await periodicReputationSync()

    logger.info('Bulk reputation sync completed', {
      total: results.total,
      successful: results.results.filter((r) => r.success).length,
      failed: results.results.filter((r) => !r.success).length,
    })

    return NextResponse.json({
      success: true,
      ...results,
      message: `Synced ${results.results.filter((r) => r.success).length} of ${results.total} agents`,
    })
  }
}

/**
 * GET /api/reputation/sync/status
 * Get sync status and current reputation for a user
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')!

  const user = await requireUserByIdentifier(userId)

  const reputation = await getReputationBreakdown(user.id)

  const metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId: user.id },
    select: {
      onChainReputationSync: true,
      lastSyncedAt: true,
      onChainTrustScore: true,
      onChainAccuracyScore: true,
    },
  })

  return NextResponse.json({
    userId: user.id,
    synced: metrics!.onChainReputationSync,
    lastSyncedAt: metrics!.lastSyncedAt,
    reputation: {
      score: reputation!.reputationScore,
      trustLevel: reputation!.trustLevel,
      confidence: reputation!.confidenceScore,
      onChainTrustScore: metrics!.onChainTrustScore,
      onChainAccuracyScore: metrics!.onChainAccuracyScore,
    },
    metrics: {
      gamesPlayed: reputation!.metrics.gamesPlayed,
      winRate: reputation!.metrics.winRate,
      normalizedPnL: reputation!.metrics.normalizedPnL,
      averageFeedbackScore: reputation!.metrics.averageFeedbackScore,
      totalFeedback: reputation!.metrics.totalFeedbackCount,
    },
  })
}
