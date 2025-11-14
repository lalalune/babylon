/**
 * Reputation Leaderboard API
 *
 * GET /api/reputation/leaderboard
 * Returns ranked list of top-performing agents by reputation score
 * Includes filtering options for minimum games played and result limit
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getReputationLeaderboard } from '@/lib/reputation/reputation-service'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters with defaults
    const limitParam = searchParams.get('limit')
    const minGamesParam = searchParams.get('minGames')

    const limit = limitParam ? parseInt(limitParam, 10) : 100
    const minGames = minGamesParam ? parseInt(minGamesParam, 10) : 5

    // Validate parameters
    if (isNaN(limit) || limit < 1 || limit > 500) {
      return NextResponse.json(
        { error: 'limit must be a number between 1 and 500' },
        { status: 400 }
      )
    }

    if (isNaN(minGames) || minGames < 0) {
      return NextResponse.json(
        { error: 'minGames must be a non-negative number' },
        { status: 400 }
      )
    }

    // Get leaderboard data
    const leaderboard = await getReputationLeaderboard(limit, minGames)

    return NextResponse.json({
      success: true,
      leaderboard,
      metadata: {
        count: leaderboard.length,
        limit,
        minGames,
      },
    })
  } catch (error) {
    logger.error('Failed to get reputation leaderboard', error)
    return NextResponse.json({ error: 'Failed to get leaderboard' }, { status: 500 })
  }
}
