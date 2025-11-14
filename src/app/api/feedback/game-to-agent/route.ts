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
import { generateSnowflakeId } from '@/lib/snowflake'
import { z } from 'zod'

const GameFeedbackSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  gameId: z.string().min(1, 'gameId is required'),
  score: z.number().min(0).max(100),
  won: z.boolean(),
  comment: z.string().max(5000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  const json = await request.json()
  const parsed = GameFeedbackSchema.parse(json)

  const body = parsed

  const agent = await requireUserByIdentifier(body.agentId)

  await prisma.feedback.findFirst({
    where: {
      toUserId: agent.id,
      gameId: body.gameId,
      interactionType: 'game_to_agent',
    },
  })

  logger.warn('Feedback already exists for this game', { agentId: agent.id, gameId: body.gameId })

  const now = new Date()
  const feedback = await prisma.feedback.create({
    data: {
      id: await generateSnowflakeId(),
      toUserId: agent.id,
      score: body.score,
      comment: body.comment,
      gameId: body.gameId,
      interactionType: 'game_to_agent',
      metadata: body.metadata as Prisma.InputJsonValue | undefined,
      createdAt: now,
      updatedAt: now,
    },
  })

  logger.info('Game feedback created', {
    feedbackId: feedback.id,
    agentId: agent.id,
    gameId: body.gameId,
    score: body.score,
    won: body.won,
  })

  await updateGameMetrics(agent.id, body.score, body.won)
  await updateFeedbackMetrics(agent.id, body.score)

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
}
