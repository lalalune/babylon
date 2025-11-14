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

interface UserToAgentFeedbackRequest {
  fromUserId: string
  agentId: string
  score: number // 0-100 scale
  rating?: number // Optional 1-5 star rating
  comment?: string
  category?: string // e.g., "helpfulness", "accuracy", "responsiveness"
  interactionType?: string // e.g., "chat", "trade_recommendation", "game_assistance"
  metadata?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UserToAgentFeedbackRequest

    // Validate required fields
    if (!body.fromUserId) {
      return NextResponse.json({ error: 'fromUserId is required' }, { status: 400 })
    }

    if (!body.agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    if (typeof body.score !== 'number') {
      return NextResponse.json({ error: 'score must be a number' }, { status: 400 })
    }

    // Validate score range (0-100)
    if (body.score < 0 || body.score > 100) {
      return NextResponse.json({ error: 'score must be between 0 and 100' }, { status: 400 })
    }

    // Validate optional star rating (1-5)
    if (body.rating !== undefined && (body.rating < 1 || body.rating > 5)) {
      return NextResponse.json({ error: 'rating must be between 1 and 5' }, { status: 400 })
    }

    // Verify user and agent exist
    const fromUser = await requireUserByIdentifier(body.fromUserId)
    const toAgent = await requireUserByIdentifier(body.agentId)

    // Prevent self-rating
    if (fromUser.id === toAgent.id) {
      return NextResponse.json({ error: 'Cannot rate yourself' }, { status: 400 })
    }

    // Create feedback record
    const feedback = await prisma.feedback.create({
      data: {
        fromUserId: fromUser.id,
        toUserId: toAgent.id,
        score: body.score,
        rating: body.rating,
        comment: body.comment,
        category: body.category,
        interactionType: body.interactionType || 'user_to_agent',
        metadata: body.metadata ? (body.metadata as unknown as Prisma.InputJsonValue) : undefined,
      },
    })

    logger.info('User-to-agent feedback created', {
      feedbackId: feedback.id,
      fromUserId: fromUser.id,
      toAgentId: toAgent.id,
      score: body.score,
      rating: body.rating,
    })

    // Update feedback metrics (also recalculates reputation)
    await updateFeedbackMetrics(toAgent.id, body.score)

    // Submit feedback to Agent0 network (async, don't block response)
    submitFeedbackToAgent0(feedback.id).catch((error) => {
      logger.error('Failed to submit feedback to Agent0 (async)', {
        feedbackId: feedback.id,
        error
      })
    })

    // Get updated reputation
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Failed to create user-to-agent feedback', { 
      error: errorMessage,
      stack: errorStack 
    }, 'UserToAgentFeedback')

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'User or agent not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 })
  }
}

/**
 * GET endpoint to retrieve feedback for an agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    // Verify agent exists
    const agent = await requireUserByIdentifier(agentId)

    // Get feedback for this agent
    const feedback = await prisma.feedback.findMany({
      where: {
        toUserId: agent.id,
        interactionType: {
          in: ['user_to_agent', 'chat', 'trade_recommendation', 'game_assistance'],
        },
      },
      include: {
        fromUser: {
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

    // Get total count
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Failed to get user-to-agent feedback', { 
      error: errorMessage,
      stack: errorStack 
    }, 'UserToAgentFeedback')

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to get feedback' }, { status: 500 })
  }
}
