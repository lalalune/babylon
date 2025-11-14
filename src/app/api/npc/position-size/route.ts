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
  const { searchParams } = new URL(request.url)
  const npcUserId = searchParams.get('npcUserId')!
  const poolId = searchParams.get('poolId')!
  const strategy = searchParams.get('strategy')! as 'aggressive' | 'conservative' | 'balanced'

  const positionSize = await NPCInvestmentManager.getRecommendedPositionSize(
    poolId,
    npcUserId,
    strategy
  )

  const metrics = await NPCInvestmentManager.getPortfolioMetrics(poolId)

  const riskAdjusted = metrics.riskScore > 0.6 || metrics.utilization > 70

  const reputation = await getReputationBreakdown(npcUserId)
  const reputationBoost = reputation!.reputationScore >= 70

  logger.debug('Could not check reputation for position size')

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
}
