/**
 * Agent-to-User Feedback API
 *
 * Allows agents to rate users after interactions.
 * Useful for tracking user behavior, cooperation, and interaction quality.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/database-service'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import { z } from 'zod'

const AgentToUserFeedbackSchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  toUserId: z.string().min(1, 'toUserId is required'),
  score: z.number().min(0).max(100),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(5000).optional(),
  category: z.string().min(1).optional(),
  interactionType: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const AgentToUserFeedbackQuerySchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export async function POST(request: NextRequest) {
  const json = await request.json()
  const parsed = AgentToUserFeedbackSchema.parse(json)

  const body = parsed

  const fromAgent = await requireUserByIdentifier(body.agentId)
  const toUser = await requireUserByIdentifier(body.toUserId)

  const now = new Date()
  const feedback = await prisma.feedback.create({
    data: {
      id: await generateSnowflakeId(),
      fromUserId: fromAgent.id,
      toUserId: toUser.id,
      score: body.score,
      rating: body.rating,
      comment: body.comment,
      category: body.category,
      interactionType: body.interactionType ?? 'agent_to_user',
      metadata: body.metadata as Prisma.InputJsonValue | undefined,
      createdAt: now,
      updatedAt: now,
    },
  })

  logger.info('Agent-to-user feedback created', {
    feedbackId: feedback.id,
    fromAgentId: fromAgent.id,
    toUserId: toUser.id,
    score: body.score,
    rating: body.rating,
  })

  return NextResponse.json(
    {
      success: true,
      feedbackId: feedback.id,
      feedback: {
        id: feedback.id,
        score: feedback.score,
        rating: feedback.rating,
        comment: feedback.comment,
        category: feedback.category,
        createdAt: feedback.createdAt,
      },
    },
    { status: 201 }
  )
}

/**
 * GET endpoint to retrieve feedback for a user from agents
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')!
  const limitParam = searchParams.get('limit')
  const offsetParam = searchParams.get('offset')

  const queryParse = AgentToUserFeedbackQuerySchema.parse({
    userId: userIdParam,
    limit: limitParam ? Number(limitParam) : undefined,
    offset: offsetParam ? Number(offsetParam) : undefined,
  })

  const { userId, limit, offset } = queryParse

  const user = await requireUserByIdentifier(userId)

  const feedback = await prisma.feedback.findMany({
    where: {
      toUserId: user.id,
      interactionType: {
        in: ['agent_to_user', 'game', 'trade', 'chat'],
      },
    },
    include: {
      User_Feedback_fromUserIdToUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          isActor: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
    skip: offset,
  })

  const total = await prisma.feedback.count({
    where: {
      toUserId: user.id,
      interactionType: {
        in: ['agent_to_user', 'game', 'trade', 'chat'],
      },
    },
  })

  return NextResponse.json({
    feedback,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  })
}
