/**
 * NPC Investment Actions API
 *
 * POST /api/npc/[actorId]/invest
 * Execute investment actions for an NPC actor including:
 * - Portfolio monitoring and rebalancing
 * - Risk management actions
 * - Position adjustments
 *
 * Request body:
 * - action: 'monitor' | 'rebalance' | 'execute'
 * - strategy: 'aggressive' | 'conservative' | 'balanced' (optional, inferred from personality)
 * - rebalanceAction: object (for 'execute' action)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database-service'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { NPCInvestmentManager } from '@/lib/npc/npc-investment-manager'

interface RouteParams {
  params: Promise<{
    actorId: string
  }>
}

interface MonitorRequest {
  action: 'monitor'
  strategy?: 'aggressive' | 'conservative' | 'balanced'
}

interface RebalanceRequest {
  action: 'rebalance'
  strategy?: 'aggressive' | 'conservative' | 'balanced'
}

interface ExecuteRequest {
  action: 'execute'
  rebalanceAction: {
    type: 'open' | 'close' | 'resize'
    positionId?: string
    marketType: 'perp' | 'prediction'
    ticker?: string
    marketId?: string
    side: string
    targetSize: number
    reason: string
  }
}

type InvestRequest = MonitorRequest | RebalanceRequest | ExecuteRequest

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { actorId } = await params

  const body = (await request.json()) as InvestRequest

  const actor = await requireUserByIdentifier(actorId)

  const pool = await prisma.pool.findFirst({
    where: {
      npcActorId: actor.id,
      isActive: true,
    },
    include: {
      Actor: {
        select: {
          personality: true,
        },
      },
    },
  })

  let strategy: 'aggressive' | 'conservative' | 'balanced' = 'balanced'

  if ('strategy' in body && body.strategy) {
    strategy = body.strategy
  } else if (pool!.Actor?.personality) {
    const personalityLower = pool!.Actor.personality.toLowerCase()
    const aggressiveKeywords = ['erratic', 'disaster', 'memecoin', 'degen']
    const conservativeKeywords = ['vampire', 'yacht', 'philosopher']

    if (aggressiveKeywords.some((kw) => personalityLower.includes(kw))) {
      strategy = 'aggressive'
    } else if (conservativeKeywords.some((kw) => personalityLower.includes(kw))) {
      strategy = 'conservative'
    }
  }

  if (body.action === 'monitor') {
    const actions = await NPCInvestmentManager.monitorPortfolio(
      pool!.id,
      actor.id,
      strategy
    )

    return NextResponse.json({
      success: true,
      actorId: actor.id,
      poolId: pool!.id,
      strategy,
      actions,
      actionCount: actions.length,
      message: actions.length > 0
        ? `Found ${actions.length} recommended action(s)`
        : 'Portfolio is balanced, no actions needed',
    })
  } else if (body.action === 'rebalance') {
    const actions = await NPCInvestmentManager.monitorPortfolio(
      pool!.id,
      actor.id,
      strategy
    )

    const results = []
    for (const action of actions) {
      await NPCInvestmentManager.executeRebalanceAction(actor.id, pool!.id, action)
      results.push({ action, success: true })
    }

    return NextResponse.json({
      success: true,
      actorId: actor.id,
      poolId: pool!.id,
      strategy,
      actionsExecuted: results.length,
      results,
      message: `Executed ${results.filter((r) => r.success).length} of ${results.length} actions`,
    })
  } else {
    await NPCInvestmentManager.executeRebalanceAction(
      actor.id,
      pool!.id,
      body.rebalanceAction
    )

    return NextResponse.json({
      success: true,
      actorId: actor.id,
      poolId: pool!.id,
      action: body.rebalanceAction,
      message: `Executed ${body.rebalanceAction.type} action for ${body.rebalanceAction.ticker || body.rebalanceAction.marketId}`,
    })
  }
}
