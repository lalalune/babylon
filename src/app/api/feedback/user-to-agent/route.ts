/**
 * User-to-Agent Feedback API
 *
 * Allows users to rate agents after interactions (like Yelp/App Store).
 * Users can provide a score, optional star rating, and comments.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/database-service'
import { updateFeedbackMetrics } from '@/lib/reputation/reputation-service'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { logger } from '@/lib/logger'
import { submitFeedbackToAgent0 } from '@/lib/reputation/agent0-reputation-sync'
import { generateSnowflakeId } from '@/lib/snowflake'
import { z } from 'zod'

const UserToAgentFeedbackSchema = z.object({
  fromUserId: z.string().min(1, 'fromUserId is required'),
  agentId: z.string().min(1, 'agentId is required'),
  score: z.number().min(0).max(100),
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(5000).optional(),
  category: z.string().min(1).optional(),
  interactionType: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const UserToAgentFeedbackQuerySchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

export async function POST(request: NextRequest) {
  const json = await request.json()
  const parsed = UserToAgentFeedbackSchema.parse(json)

  const body = parsed

  const fromUser = await requireUserByIdentifier(body.fromUserId)
  const toAgent = await requireUserByIdentifier(body.agentId)

  const now = new Date()
  const feedback = await prisma.feedback.create({
    data: {
      id: await generateSnowflakeId(),
      fromUserId: fromUser.id,
      toUserId: toAgent.id,
      score: body.score,
      rating: body.rating,
      comment: body.comment,
      category: body.category,
      interactionType: body.interactionType ?? 'user_to_agent',
      metadata: body.metadata as Prisma.InputJsonValue | undefined,
      createdAt: now,
      updatedAt: now,
    },
  })

  logger.info('User-to-agent feedback created', {
    feedbackId: feedback.id,
    fromUserId: fromUser.id,
    toAgentId: toAgent.id,
    score: body.score,
    rating: body.rating,
  })

  await updateFeedbackMetrics(toAgent.id, body.score)

  submitFeedbackToAgent0(feedback.id)

  const metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId: toAgent.id },
    select: {
      reputationScore: true,
      trustLevel: true,
      confidenceScore: true,
      averageFeedbackScore: true,
      averageRating: true,
      totalFeedbackCount: true,
      positiveCount: true,
      neutralCount: true,
      negativeCount: true,
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

/**
 * GET endpoint to retrieve feedback for an agent
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const agentIdParam = searchParams.get('agentId')!
  const limitParam = searchParams.get('limit')
  const offsetParam = searchParams.get('offset')

  const queryParse = UserToAgentFeedbackQuerySchema.parse({
    agentId: agentIdParam,
    limit: limitParam ? Number(limitParam) : undefined,
    offset: offsetParam ? Number(offsetParam) : undefined,
  })

  const { agentId, limit, offset } = queryParse

  const agent = await requireUserByIdentifier(agentId)

  const feedback = await prisma.feedback.findMany({
    where: {
      toUserId: agent.id,
      interactionType: {
        in: ['user_to_agent', 'chat', 'trade_recommendation', 'game_assistance'],
      },
    },
    include: {
      User_Feedback_fromUserIdToUser: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
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
      toUserId: agent.id,
      interactionType: {
        in: ['user_to_agent', 'chat', 'trade_recommendation', 'game_assistance'],
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
