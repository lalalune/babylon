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

interface FeedbackSubmitRequest {
  fromUserId: string
  toUserId: string
  score?: number
  stars?: number
  comment?: string
  category?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FeedbackSubmitRequest

    // Validate required fields
    if (!body.fromUserId) {
      return NextResponse.json({ error: 'fromUserId is required' }, { status: 400 })
    }

    if (!body.toUserId) {
      return NextResponse.json({ error: 'toUserId is required' }, { status: 400 })
    }

    // Calculate score from stars if provided, otherwise validate score
    let score: number

    if (body.stars !== undefined) {
      // Convert stars (1-5) to score (0-100)
      if (body.stars < 1 || body.stars > 5) {
        return NextResponse.json(
          { error: 'stars must be between 1 and 5' },
          { status: 400 }
        )
      }
      score = body.stars * 20 // 1 star = 20, 5 stars = 100
    } else if (body.score !== undefined) {
      score = body.score

      // Validate score range
      if (score < 0 || score > 100) {
        return NextResponse.json(
          { error: 'score must be between 0 and 100' },
          { status: 400 }
        )
      }
    } else {
      return NextResponse.json(
        { error: 'either score or stars must be provided' },
        { status: 400 }
      )
    }

    // Verify both users exist
    const fromUser = await requireUserByIdentifier(body.fromUserId)
    const toUser = await requireUserByIdentifier(body.toUserId)

    // Prevent self-feedback
    if (fromUser.id === toUser.id) {
      return NextResponse.json(
        { error: 'Cannot submit feedback to yourself' },
        { status: 400 }
      )
    }

    // Create feedback record
    const feedback = await prisma.feedback.create({
      data: {
        fromUserId: fromUser.id,
        toUserId: toUser.id,
        score,
        comment: body.comment || null,
        category: body.category || 'general',
        interactionType: 'user_to_agent', // Manual user feedback
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
  } catch (error) {
    logger.error('Failed to submit feedback', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}
