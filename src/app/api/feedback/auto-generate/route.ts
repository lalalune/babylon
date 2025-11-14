/**
 * Auto-Generate Feedback API
 *
 * POST /api/feedback/auto-generate
 * Automatically generates feedback for completed games or trades
 * Calculates performance scores and updates agent metrics
 *
 * Request body should include either:
 * - Game completion: { type: 'game', agentId, gameId, metrics: GameMetrics }
 * - Trade completion: { type: 'trade', agentId, tradeId, metrics: TradeMetrics }
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import {
  generateGameCompletionFeedback,
  CompletionFormat,
} from '@/lib/reputation/reputation-service'
import { logger } from '@/lib/logger'

interface GameMetrics {
  won: boolean
  pnl: number
  positionsClosed: number
  finalBalance: number
  startingBalance: number
  decisionsCorrect: number
  decisionsTotal: number
  timeToComplete?: number
  riskManagement?: number
}

interface TradeMetrics {
  profitable: boolean
  roi: number
  holdingPeriod: number
  timingScore: number
  riskScore: number
}

interface GameFeedbackRequest {
  type: 'game'
  agentId: string
  gameId: string
  metrics: GameMetrics
}

interface TradeFeedbackRequest {
  type: 'trade'
  agentId: string
  tradeId: string
  metrics: TradeMetrics
}

type AutoGenerateFeedbackRequest = GameFeedbackRequest | TradeFeedbackRequest

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AutoGenerateFeedbackRequest

    // Validate request type
    if (!body.type || (body.type !== 'game' && body.type !== 'trade')) {
      return NextResponse.json(
        { error: 'type must be either "game" or "trade"' },
        { status: 400 }
      )
    }

    // Validate common fields
    if (!body.agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    if (!body.metrics) {
      return NextResponse.json({ error: 'metrics is required' }, { status: 400 })
    }

    // Verify agent exists
    const agent = await requireUserByIdentifier(body.agentId)

    // Generate feedback based on type
    if (body.type === 'game') {
      if (!body.gameId) {
        return NextResponse.json({ error: 'gameId is required for game feedback' }, { status: 400 })
      }

      const feedback = await generateGameCompletionFeedback(
        agent.id,
        body.gameId,
        body.metrics as GameMetrics
      )

      return NextResponse.json({
        success: true,
        feedbackId: feedback.id,
        type: 'game',
        score: feedback.score,
        message: 'Game feedback generated successfully',
      }, { status: 201 })
    } else {
      // type === 'trade'
      if (!body.tradeId) {
        return NextResponse.json(
          { error: 'tradeId is required for trade feedback' },
          { status: 400 }
        )
      }

      const feedback = await CompletionFormat(
        agent.id,
        body.tradeId,
        body.metrics as TradeMetrics
      )

      return NextResponse.json({
        success: true,
        feedbackId: feedback.id,
        type: 'trade',
        score: feedback.score,
        message: 'Trade feedback generated successfully',
      }, { status: 201 })
    }
  } catch (error) {
    logger.error('Failed to auto-generate feedback', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Failed to generate feedback' }, { status: 500 })
  }
}
