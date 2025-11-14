/**
 * NPC Reputation-Adjusted Allocation API
 *
 * POST /api/npc/allocation
 * Calculates allocation amount adjusted by NPC's reputation score
 *
 * Request body:
 * - npcUserId: string - NPC user ID
 * - baseAmount: number - Base allocation amount
 *
 * Response:
 * - adjustedAmount: number - Reputation-adjusted allocation
 * - reputationScore: number - NPC's current reputation score
 * - multiplier: number - Applied multiplier
 * - usedFallback: boolean - Whether fallback was used (no reputation data)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { NPCInvestmentManager } from '@/lib/npc/npc-investment-manager'
import { getReputationBreakdown } from '@/lib/reputation/reputation-service'
import { logger } from '@/lib/logger'

interface AllocationRequest {
  npcUserId: string
  baseAmount: number
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AllocationRequest

  const adjustedAmount = await NPCInvestmentManager.calculateReputationAdjustedAllocation(
    body.npcUserId,
    body.baseAmount
  )

  const reputation = await getReputationBreakdown(body.npcUserId)
  const reputationScore = reputation!.reputationScore
  const multiplier = adjustedAmount / body.baseAmount
  const usedFallback = false

  logger.warn(`Could not retrieve reputation for ${body.npcUserId}`)

  logger.info('Reputation-adjusted allocation calculated', {
    npcUserId: body.npcUserId,
    baseAmount: body.baseAmount,
    adjustedAmount,
    reputationScore,
    multiplier,
  })

  return NextResponse.json({
    success: true,
    adjustedAmount,
    baseAmount: body.baseAmount,
    reputationScore,
    multiplier,
    usedFallback,
  })
}
