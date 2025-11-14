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
import { logger } from '@/lib/logger'

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
  try {
    const { actorId } = await params

    if (!actorId) {
      return NextResponse.json({ error: 'actorId parameter is required' }, { status: 400 })
    }

    const body = (await request.json()) as InvestRequest

    // Validate action
    if (!body.action || !['monitor', 'rebalance', 'execute'].includes(body.action)) {
      return NextResponse.json(
        { error: 'action must be one of: monitor, rebalance, execute' },
        { status: 400 }
      )
    }

    // Verify actor exists and is an NPC
    const actor = await requireUserByIdentifier(actorId)

    if (!actor.isActor) {
      return NextResponse.json(
        { error: 'User is not an NPC actor' },
        { status: 400 }
      )
    }

    // Get the actor's pool
    const pool = await prisma.pool.findFirst({
      where: {
        npcActorId: actor.id,
        isActive: true,
      },
      include: {
        npcActor: {
          select: {
            personality: true,
          },
        },
      },
    })

    if (!pool) {
      return NextResponse.json(
        { error: 'No active pool found for this actor' },
        { status: 404 }
      )
    }

    // Determine strategy from request or personality
    let strategy: 'aggressive' | 'conservative' | 'balanced' = 'balanced'

    if ('strategy' in body && body.strategy) {
      strategy = body.strategy
    } else if (pool.npcActor?.personality) {
      const personalityLower = pool.npcActor.personality.toLowerCase()
      const aggressiveKeywords = ['erratic', 'disaster', 'memecoin', 'degen']
      const conservativeKeywords = ['vampire', 'yacht', 'philosopher']

      if (aggressiveKeywords.some((kw) => personalityLower.includes(kw))) {
        strategy = 'aggressive'
      } else if (conservativeKeywords.some((kw) => personalityLower.includes(kw))) {
        strategy = 'conservative'
      }
    }

    if (body.action === 'monitor') {
      // Monitor portfolio and return suggested actions
      const actions = await NPCInvestmentManager.monitorPortfolio(
        pool.id,
        actor.id,
        strategy
      )

      return NextResponse.json({
        success: true,
        actorId: actor.id,
        poolId: pool.id,
        strategy,
        actions,
        actionCount: actions.length,
        message: actions.length > 0
          ? `Found ${actions.length} recommended action(s)`
          : 'Portfolio is balanced, no actions needed',
      })
    } else if (body.action === 'rebalance') {
      // Monitor and execute all recommended actions
      const actions = await NPCInvestmentManager.monitorPortfolio(
        pool.id,
        actor.id,
        strategy
      )

      // Execute all actions
      const results = []
      for (const action of actions) {
        try {
          await NPCInvestmentManager.executeRebalanceAction(actor.id, pool.id, action)
          results.push({ action, success: true })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          results.push({ action, success: false, error: errorMessage })
        }
      }

      return NextResponse.json({
        success: true,
        actorId: actor.id,
        poolId: pool.id,
        strategy,
        actionsExecuted: results.length,
        results,
        message: `Executed ${results.filter((r) => r.success).length} of ${results.length} actions`,
      })
    } else {
      // action === 'execute'
      if (!body.rebalanceAction) {
        return NextResponse.json(
          { error: 'rebalanceAction is required for execute action' },
          { status: 400 }
        )
      }

      // Execute single rebalance action
      await NPCInvestmentManager.executeRebalanceAction(
        actor.id,
        pool.id,
        body.rebalanceAction
      )

      return NextResponse.json({
        success: true,
        actorId: actor.id,
        poolId: pool.id,
        action: body.rebalanceAction,
        message: `Executed ${body.rebalanceAction.type} action for ${body.rebalanceAction.ticker || body.rebalanceAction.marketId}`,
      })
    }
  } catch (error) {
    logger.error('Failed to execute NPC investment action', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Actor or pool not found' }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Failed to execute investment action' }, { status: 500 })
  }
}
