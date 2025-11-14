/**
 * NPC Performance Leaderboard API
 *
 * GET /api/npc/performance/leaderboard
 * Returns ranked list of NPC actors by portfolio performance
 * Includes filtering options for minimum portfolio value and result limit
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database-service'
import type { Prisma } from '@prisma/client'

// Type for pool with included relations
type PoolWithRelations = Prisma.PoolGetPayload<{
  include: {
    Actor: {
      select: {
        id: true
        name: true
        profileImageUrl: true
        personality: true
      }
    }
    PoolPosition: {
      select: {
        unrealizedPnL: true
      }
    }
  }
}>

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const limitParam = searchParams.get('limit')
  const minValueParam = searchParams.get('minValue')

  const limit = limitParam ? parseInt(limitParam, 10) : 50
  const minValue = minValueParam ? parseFloat(minValueParam) : 0

  const pools: PoolWithRelations[] = await prisma.pool.findMany({
    where: {
      isActive: true,
      totalValue: { gte: minValue },
    },
    include: {
      Actor: {
        select: {
          id: true,
          name: true,
          profileImageUrl: true,
          personality: true,
        },
      },
      PoolPosition: {
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

  const leaderboard = pools.map((pool, index) => {
    const totalValue = parseFloat(pool.totalValue!.toString())
    const availableBalance = parseFloat(pool.availableBalance!.toString())
    const initialValue = parseFloat(pool.totalDeposits!.toString())

    const unrealizedPnL = pool.PoolPosition.reduce((sum: number, pos) => {
      return sum + parseFloat(pos.unrealizedPnL!.toString())
    }, 0)

    const roi = ((totalValue - initialValue) / initialValue) * 100

    const invested = totalValue - availableBalance
    const utilization = (invested / totalValue) * 100

    return {
      rank: index + 1,
      actorId: pool.Actor!.id,
      actorName: pool.Actor!.name,
      personality: pool.Actor!.personality,
      profileImageUrl: pool.Actor!.profileImageUrl,
      poolId: pool.id,
      performance: {
        totalValue: Math.round(totalValue),
        roi: parseFloat(roi.toFixed(2)),
        unrealizedPnL: Math.round(unrealizedPnL),
        positionCount: pool.PoolPosition.length,
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
}
