/**
 * Game-to-Agent Feedback API
 *
 * Allows games to submit performance feedback for agents.
 * This is the primary mechanism for rating agent performance in games.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/database-service'
import { updateGameMetrics, updateFeedbackMetrics } from '@/lib/reputation/reputation-service'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { logger } from '@/lib/logger'

interface GameFeedbackRequest {
  agentId: string
  gameId: string
  score: number // 0-100 scale
  won: boolean
  comment?: string
  metadata?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GameFeedbackRequest

    // Validate required fields
    if (!body.agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    if (!body.gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 })
    }

    if (typeof body.score !== 'number') {
      return NextResponse.json({ error: 'score must be a number' }, { status: 400 })
    }

    if (typeof body.won !== 'boolean') {
      return NextResponse.json({ error: 'won must be a boolean' }, { status: 400 })
    }

    // Validate score range (0-100)
    if (body.score < 0 || body.score > 100) {
      return NextResponse.json({ error: 'score must be between 0 and 100' }, { status: 400 })
    }

    // Verify agent exists
    const agent = await requireUserByIdentifier(body.agentId)

    // Check if feedback already exists for this game
    const existingFeedback = await prisma.feedback.findFirst({
      where: {
        toUserId: agent.id,
        gameId: body.gameId,
        interactionType: 'game_to_agent',
      },
    })

    if (existingFeedback) {
      logger.warn('Feedback already exists for this game', { agentId: agent.id, gameId: body.gameId })
      return NextResponse.json(
        {
          error: 'Feedback already submitted for this game',
          feedbackId: existingFeedback.id,
        },
        { status: 409 }
      )
    }

    // Create feedback record
    const feedback = await prisma.feedback.create({
      data: {
        toUserId: agent.id,
        score: body.score,
        comment: body.comment,
        gameId: body.gameId,
        interactionType: 'game_to_agent',
        metadata: body.metadata ? (body.metadata as unknown as Prisma.InputJsonValue) : undefined,
      },
    })

    logger.info('Game feedback created', {
      feedbackId: feedback.id,
      agentId: agent.id,
      gameId: body.gameId,
      score: body.score,
      won: body.won,
    })

    // Update game metrics (which also recalculates reputation)
    await updateGameMetrics(agent.id, body.score, body.won)

    // Update feedback metrics (also recalculates reputation)
    await updateFeedbackMetrics(agent.id, body.score)

    // Get updated reputation
    const metrics = await prisma.agentPerformanceMetrics.findUnique({
      where: { userId: agent.id },
      select: {
        reputationScore: true,
        trustLevel: true,
        confidenceScore: true,
        gamesPlayed: true,
        gamesWon: true,
        averageGameScore: true,
        averageFeedbackScore: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        feedbackId: feedback.id,
        reputation: metrics,
      },
      { status: 201 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Failed to create game feedback', { 
      error: errorMessage,
      stack: errorStack 
    }, 'GameToAgentFeedback')

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 })
  }
}
