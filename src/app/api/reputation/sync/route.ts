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
  try {
    // Parse body, default to empty object if no body provided (e.g., from cron)
    let body: SyncRequest = {}
    try {
      body = (await request.json()) as SyncRequest
    } catch {
      // Empty body from cron job is fine, defaults to syncing all users
      body = {}
    }

    // Sync specific user or all users
    if (body.userId) {
      // Verify user exists
      const user = await requireUserByIdentifier(body.userId)

      // Sync specific user
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
      // Periodic sync for all users with Agent0 registration
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
  } catch (error) {
    logger.error('Failed to sync reputation', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      if (error.message.includes('no Agent0 token ID')) {
        return NextResponse.json(
          { error: 'User not registered with Agent0' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to sync reputation' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/reputation/sync/status
 * Get sync status and current reputation for a user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      )
    }

    // Verify user exists
    const user = await requireUserByIdentifier(userId)

    // Get reputation breakdown
    const reputation = await getReputationBreakdown(user.id)

    if (!reputation) {
      return NextResponse.json({
        userId: user.id,
        synced: false,
        message: 'No reputation data available',
      })
    }

    // Get on-chain sync fields from database
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
      synced: metrics?.onChainReputationSync ?? false,
      lastSyncedAt: metrics?.lastSyncedAt ?? null,
      reputation: {
        score: reputation.reputationScore,
        trustLevel: reputation.trustLevel,
        confidence: reputation.confidenceScore,
        onChainTrustScore: metrics?.onChainTrustScore ?? null,
        onChainAccuracyScore: metrics?.onChainAccuracyScore ?? null,
      },
      metrics: {
        gamesPlayed: reputation.metrics.gamesPlayed,
        winRate: reputation.metrics.winRate,
        normalizedPnL: reputation.metrics.normalizedPnL,
        averageFeedbackScore: reputation.metrics.averageFeedbackScore,
        totalFeedback: reputation.metrics.totalFeedbackCount,
      },
    })
  } catch (error) {
    logger.error('Failed to get reputation sync status', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
