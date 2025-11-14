/**
 * NPC Position Size Recommendation API
 *
 * GET /api/npc/position-size
 * Calculates recommended position size based on portfolio metrics, strategy, and reputation
 *
 * Query parameters:
 * - npcUserId: string - NPC user ID
 * - poolId: string - Pool ID
 * - strategy: 'aggressive' | 'conservative' | 'balanced'
 *
 * Response:
 * - positionSize: number - Recommended position size as decimal (0.10 = 10%)
 * - riskAdjusted: boolean - Whether risk adjustments were applied
 * - reputationBoost: boolean - Whether reputation boosted the size
 * - portfolioMetrics: object - Current portfolio state
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { NPCInvestmentManager } from '@/lib/npc/npc-investment-manager'
import { getReputationBreakdown } from '@/lib/reputation/reputation-service'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const npcUserId = searchParams.get('npcUserId')
    const poolId = searchParams.get('poolId')
    const strategy = searchParams.get('strategy') as 'aggressive' | 'conservative' | 'balanced'

    // Validate required fields
    if (!npcUserId) {
      return NextResponse.json({ error: 'npcUserId is required' }, { status: 400 })
    }

    if (!poolId) {
      return NextResponse.json({ error: 'poolId is required' }, { status: 400 })
    }

    if (!strategy || !['aggressive', 'conservative', 'balanced'].includes(strategy)) {
      return NextResponse.json(
        { error: 'strategy must be one of: aggressive, conservative, balanced' },
        { status: 400 }
      )
    }

    // Get recommended position size
    const positionSize = await NPCInvestmentManager.getRecommendedPositionSize(
      poolId,
      npcUserId,
      strategy
    )

    // Get portfolio metrics for context
    const metrics = await NPCInvestmentManager.getPortfolioMetrics(poolId)

    // Determine if risk adjustments were applied
    const riskAdjusted = metrics.riskScore > 0.6 || metrics.utilization > 70

    // Check if reputation provided a boost
    let reputationBoost = false
    try {
      const reputation = await getReputationBreakdown(npcUserId)
      if (reputation && reputation.reputationScore >= 70) {
        reputationBoost = true
      }
    } catch (error) {
      // Reputation check is optional
      logger.debug('Could not check reputation for position size', { error })
    }

    logger.info('Position size calculated', {
      npcUserId,
      poolId,
      strategy,
      positionSize,
      riskAdjusted,
      reputationBoost,
    })

    return NextResponse.json({
      success: true,
      positionSize,
      strategy,
      riskAdjusted,
      reputationBoost,
      portfolioMetrics: {
        utilization: metrics.utilization,
        riskScore: metrics.riskScore,
        positionCount: metrics.positionCount,
        unrealizedPnL: metrics.unrealizedPnL,
      },
    })
  } catch (error) {
    logger.error('Failed to calculate position size', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Pool or NPC not found' }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to calculate position size' },
      { status: 500 }
    )
  }
}
