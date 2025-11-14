/**
 * Manual Feedback Submission API
 *
 * POST /api/feedback/submit
 * Allows users to submit feedback manually with star ratings
 *
 * Request body:
 * - fromUserId: string - User giving feedback
 * - toUserId: string - User receiving feedback
 * - score: number (0-100, or will be converted from stars)
 * - stars?: number (1-5, alternative to score)
 * - comment?: string - Optional feedback comment
 * - category?: string - Feedback category (e.g., 'trade_performance', 'game_performance', 'general')
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database-service'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import { z } from 'zod'

const FeedbackSubmitSchema = z.object({
  fromUserId: z.string().min(1, 'fromUserId is required'),
  toUserId: z.string().min(1, 'toUserId is required'),
  score: z.number().min(0).max(100).optional(),
  stars: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(5000).optional(),
  category: z.string().min(1).optional(),
}).refine(
  ({ score, stars }) => score !== undefined || stars !== undefined,
  {
    message: 'Either score or stars must be provided',
    path: ['score'],
  }
)

export async function POST(request: NextRequest) {
  const json = await request.json()
  const parsed = FeedbackSubmitSchema.parse(json)

  const body = parsed

  const score = body.stars !== undefined ? body.stars * 20 : body.score!

  const fromUser = await requireUserByIdentifier(body.fromUserId)
  const toUser = await requireUserByIdentifier(body.toUserId)

  const now = new Date()
  const feedback = await prisma.feedback.create({
    data: {
      id: await generateSnowflakeId(),
      fromUserId: fromUser.id,
      toUserId: toUser.id,
      score,
      comment: body.comment ?? null,
      category: body.category ?? 'general',
      interactionType: 'user_to_agent',
      createdAt: now,
      updatedAt: now,
    },
  })

  logger.info('Feedback submitted successfully', {
    feedbackId: feedback.id,
    fromUserId: fromUser.id,
    toUserId: toUser.id,
    score,
  })

  return NextResponse.json({
    success: true,
    feedbackId: feedback.id,
    score,
    message: 'Feedback submitted successfully',
  }, { status: 201 })
}
