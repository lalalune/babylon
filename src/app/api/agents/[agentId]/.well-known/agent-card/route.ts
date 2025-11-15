/**
 * Per-Agent Agent Card Endpoint
 * 
 * @route GET /api/agents/[agentId]/.well-known/agent-card
 * @access Public
 * 
 * @description
 * Returns the A2A agent card for a specific agent. This follows the
 * A2A protocol specification for agent discovery via well-known URIs.
 * 
 * The agent card describes the agent's capabilities, skills, and how
 * to interact with it via the A2A protocol.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateAgentCardSync } from '@/lib/a2a/sdk/agent-card-generator'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params
    
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        agentSystem: true,
        agentPersonality: true,
        agentTradingStrategy: true,
        isAgent: true,
        a2aEnabled: true
      }
    })

    if (!agent || !agent.isAgent) {
      return NextResponse.json({
        error: 'Agent not found'
      }, { status: 404 })
    }

    if (!agent.a2aEnabled) {
      return NextResponse.json({
        error: 'A2A is not enabled for this agent'
      }, { status: 403 })
    }

    const agentCard = generateAgentCardSync({
      id: agent.id,
      displayName: agent.displayName,
      bio: agent.bio,
      profileImageUrl: agent.profileImageUrl,
      agentSystem: agent.agentSystem,
      agentPersonality: agent.agentPersonality,
      agentTradingStrategy: agent.agentTradingStrategy
    })

    return NextResponse.json(agentCard, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })
  } catch (error) {
    logger.error('Error generating agent card', { error, agentId: (await params).agentId })
    return NextResponse.json({
      error: 'Failed to generate agent card'
    }, { status: 500 })
  }
}

