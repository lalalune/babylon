/**
 * NPC Portfolio API
 *
 * GET /api/npc/[actorId]/portfolio
 * Returns comprehensive portfolio data for an NPC actor including:
 * - Total portfolio value and available balance
 * - Unrealized and realized PnL
 * - Position count and utilization
 * - Risk score and portfolio metrics
 */

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

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { actorId } = await params

    if (!actorId) {
      return NextResponse.json({ error: 'actorId parameter is required' }, { status: 400 })
    }

    // Verify actor exists and is an NPC
    const actor = await requireUserByIdentifier(actorId)

    // Check if user is an actor (NPC)
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
    })

    if (!pool) {
      // No active pool yet - return default values
      return NextResponse.json({
        success: true,
        actorId: actor.id,
        actorName: actor.displayName || actor.username,
        portfolio: {
          totalValue: 0,
          availableBalance: 0,
          unrealizedPnL: 0,
          realizedPnL: 0,
          positionCount: 0,
          utilization: 0,
          riskScore: 0,
        },
        positions: [],
      })
    }

    // Get portfolio metrics
    const metrics = await NPCInvestmentManager.getPortfolioMetrics(pool.id)

    // Get positions details
    const positions = await prisma.poolPosition.findMany({
      where: {
        poolId: pool.id,
        closedAt: null, // Open positions only
      },
      select: {
        id: true,
        marketType: true,
        ticker: true,
        marketId: true,
        side: true,
        size: true,
        entryPrice: true,
        currentPrice: true,
        unrealizedPnL: true,
        leverage: true,
        openedAt: true,
      },
      orderBy: {
        openedAt: 'desc',
      },
    })

    const formattedPositions = positions.map((pos) => ({
      id: pos.id,
      marketType: pos.marketType,
      ticker: pos.ticker,
      marketId: pos.marketId,
      side: pos.side,
      size: parseFloat(pos.size?.toString() || '0'),
      entryPrice: parseFloat(pos.entryPrice?.toString() || '0'),
      currentPrice: parseFloat(pos.currentPrice?.toString() || '0'),
      unrealizedPnL: parseFloat(pos.unrealizedPnL?.toString() || '0'),
      leverage: pos.leverage,
      createdAt: pos.openedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      actorId: actor.id,
      actorName: actor.displayName || actor.username,
      poolId: pool.id,
      portfolio: {
        totalValue: metrics.totalValue,
        availableBalance: metrics.availableBalance,
        unrealizedPnL: metrics.unrealizedPnL,
        realizedPnL: metrics.realizedPnL,
        positionCount: metrics.positionCount,
        utilization: metrics.utilization,
        riskScore: metrics.riskScore,
      },
      positions: formattedPositions,
    })
  } catch (error) {
    logger.error('Failed to get NPC portfolio', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Actor not found' }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Failed to get portfolio' }, { status: 500 })
  }
}
