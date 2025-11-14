/**
 * NPC Performance Leaderboard API
 *
 * GET /api/npc/performance/leaderboard
 * Returns ranked list of NPC actors by portfolio performance
 * Includes filtering options for minimum portfolio value and result limit
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

// Type for pool with included relations
type PoolWithRelations = Prisma.PoolGetPayload<{
  include: {
    npcActor: {
      select: {
        id: true
        name: true
        profileImageUrl: true
        personality: true
      }
    }
    positions: {
      select: {
        unrealizedPnL: true
      }
    }
  }
}>

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters with defaults
    const limitParam = searchParams.get('limit')
    const minValueParam = searchParams.get('minValue')

    const limit = limitParam ? parseInt(limitParam, 10) : 50
    const minValue = minValueParam ? parseFloat(minValueParam) : 0

    // Validate parameters
    if (isNaN(limit) || limit < 1 || limit > 200) {
      return NextResponse.json(
        { error: 'limit must be a number between 1 and 200' },
        { status: 400 }
      )
    }

    if (isNaN(minValue) || minValue < 0) {
      return NextResponse.json(
        { error: 'minValue must be a non-negative number' },
        { status: 400 }
      )
    }

    // Get all active NPC pools with their performance metrics
    const pools: PoolWithRelations[] = await prisma.pool.findMany({
      where: {
        isActive: true,
        totalValue: { gte: minValue },
      },
      include: {
        npcActor: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
            personality: true,
          },
        },
        positions: {
          where: { closedAt: null },
          select: {
            unrealizedPnL: true,
          },
        },
      },
      orderBy: {
        totalValue: 'desc',
      },
      take: limit,
    })

    // Calculate performance metrics for each pool
    const leaderboard = pools.map((pool, index) => {
      const totalValue = parseFloat(pool.totalValue?.toString() || '0')
      const availableBalance = parseFloat(pool.availableBalance?.toString() || '0')
      const initialValue = parseFloat(pool.totalDeposits?.toString() || '1000') // Use total deposits as initial value

      // Calculate unrealized PnL from open positions
      const unrealizedPnL = pool.positions.reduce((sum: number, pos) => {
        return sum + parseFloat(pos.unrealizedPnL?.toString() || '0')
      }, 0)

      // Calculate ROI
      const roi = initialValue > 0 ? ((totalValue - initialValue) / initialValue) * 100 : 0

      // Calculate utilization
      const invested = totalValue - availableBalance
      const utilization = totalValue > 0 ? (invested / totalValue) * 100 : 0

      return {
        rank: index + 1,
        actorId: pool.npcActor?.id || '',
        actorName: pool.npcActor?.name || 'Unknown',
        personality: pool.npcActor?.personality || null,
        profileImageUrl: pool.npcActor?.profileImageUrl || null,
        poolId: pool.id,
        performance: {
          totalValue: Math.round(totalValue),
          roi: parseFloat(roi.toFixed(2)),
          unrealizedPnL: Math.round(unrealizedPnL),
          positionCount: pool.positions.length,
          utilization: parseFloat(utilization.toFixed(1)),
        },
      }
    })

    return NextResponse.json({
      success: true,
      leaderboard,
      metadata: {
        count: leaderboard.length,
        limit,
        minValue,
      },
    })
  } catch (error) {
    logger.error('Failed to get NPC performance leaderboard', error)
    return NextResponse.json({ error: 'Failed to get leaderboard' }, { status: 500 })
  }
}
