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
  try {
    const body = (await request.json()) as AllocationRequest

    // Validate required fields
    if (!body.npcUserId) {
      return NextResponse.json({ error: 'npcUserId is required' }, { status: 400 })
    }

    if (body.baseAmount === undefined || body.baseAmount <= 0) {
      return NextResponse.json(
        { error: 'baseAmount must be a positive number' },
        { status: 400 }
      )
    }

    // Calculate reputation-adjusted allocation
    const adjustedAmount = await NPCInvestmentManager.calculateReputationAdjustedAllocation(
      body.npcUserId,
      body.baseAmount
    )

    // Get reputation data to include in response
    let reputationScore = 0
    let multiplier = 1.0
    let usedFallback = false

    try {
      const reputation = await getReputationBreakdown(body.npcUserId)
      if (reputation) {
        reputationScore = reputation.reputationScore
        multiplier = adjustedAmount / body.baseAmount
      } else {
        usedFallback = true
      }
    } catch (error) {
      usedFallback = true
      logger.warn(`Could not retrieve reputation for ${body.npcUserId}`, { error })
    }

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
  } catch (error) {
    logger.error('Failed to calculate adjusted allocation', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'NPC user not found' }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: 'Failed to calculate allocation' },
      { status: 500 }
    )
  }
}
