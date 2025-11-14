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

interface AgentToUserFeedbackRequest {
  agentId: string
  toUserId: string
  score: number // 0-100 scale
  rating?: number // Optional 1-5 star rating
  comment?: string
  category?: string // e.g., "cooperation", "communication", "reliability"
  interactionType?: string // e.g., "game", "trade", "chat"
  metadata?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AgentToUserFeedbackRequest

    // Validate required fields
    if (!body.agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 })
    }

    if (!body.toUserId) {
      return NextResponse.json({ error: 'toUserId is required' }, { status: 400 })
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

    // Verify agent and user exist
    const fromAgent = await requireUserByIdentifier(body.agentId)
    const toUser = await requireUserByIdentifier(body.toUserId)

    // Prevent self-rating
    if (fromAgent.id === toUser.id) {
      return NextResponse.json({ error: 'Cannot rate yourself' }, { status: 400 })
    }

    // Create feedback record
    const feedback = await prisma.feedback.create({
      data: {
        fromUserId: fromAgent.id,
        toUserId: toUser.id,
        score: body.score,
        rating: body.rating,
        comment: body.comment,
        category: body.category,
        interactionType: body.interactionType || 'agent_to_user',
        metadata: body.metadata ? (body.metadata as unknown as Prisma.InputJsonValue) : undefined,
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Failed to create agent-to-user feedback', { 
      error: errorMessage,
      stack: errorStack 
    }, 'AgentToUserFeedback')

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Agent or user not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 })
  }
}

/**
 * GET endpoint to retrieve feedback for a user from agents
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    // Verify user exists
    const user = await requireUserByIdentifier(userId)

    // Get feedback for this user
    const feedback = await prisma.feedback.findMany({
      where: {
        toUserId: user.id,
        interactionType: {
          in: ['agent_to_user', 'game', 'trade', 'chat'],
        },
      },
      include: {
        fromUser: {
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

    // Get total count
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Failed to get agent-to-user feedback', { 
      error: errorMessage,
      stack: errorStack 
    }, 'AgentToUserFeedback')

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to get feedback' }, { status: 500 })
  }
}
