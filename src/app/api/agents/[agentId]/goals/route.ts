/**
 * Agent Goals Management API
 * 
 * @route GET/POST /api/agents/[agentId]/goals
 * 
 * Manage goals for an agent. Only accessible by the agent's manager.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticate } from '@/lib/api/auth-middleware'
import { generateSnowflakeId } from '@/lib/snowflake'
import { logger } from '@/lib/logger'

/**
 * GET - List agent's goals
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const authUser = await authenticate(req)
    const userId = authUser.userId
    const { agentId } = await params
    
    // Verify agent exists and user manages it
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { isAgent: true, managedBy: true }
    })
    
    if (!agent || !agent.isAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    
    if (agent.managedBy !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    // Get all goals for this agent
    const goals = await prisma.agentGoal.findMany({
      where: { agentUserId: agentId },
      orderBy: [
        { status: 'asc' },  // active first
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        AgentGoalAction: {
          take: 5,
          orderBy: { createdAt: 'desc' }
        }
      }
    })
    
    return NextResponse.json({
      success: true,
      goals: goals.map(g => ({
        ...g,
        target: g.target ? JSON.parse(JSON.stringify(g.target)) : null,
        recentActions: g.AgentGoalAction
      }))
    })
  } catch (error) {
    console.error('Error fetching agent goals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch goals' },
      { status: 500 }
    )
  }
}

/**
 * POST - Create new goal for agent
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const authUser = await authenticate(req)
    const userId = authUser.userId
    const { agentId } = await params
    
    // Verify agent exists and user manages it
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { isAgent: true, managedBy: true }
    })
    
    if (!agent || !agent.isAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    
    if (agent.managedBy !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    // Parse request body
    let body: Record<string, unknown>
    try {
      body = await req.json() as Record<string, unknown>
    } catch (error) {
      logger.error('Failed to parse request body', { error, agentId }, 'POST /api/agents/[agentId]/goals')
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const {
      type,
      name,
      description,
      target,
      priority = 5
    } = body
    
    // Validate required fields
    if (!type || !name || !description || typeof type !== 'string' || typeof name !== 'string' || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Missing required fields: type, name, description' },
        { status: 400 }
      )
    }
    
    // Validate type
    const validTypes = ['trading', 'social', 'learning', 'reputation', 'custom']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid goal type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Validate priority
    const priorityValue = typeof priority === 'number' ? priority : 5
    if (priorityValue < 1 || priorityValue > 10) {
      return NextResponse.json(
        { error: 'Priority must be between 1 and 10' },
        { status: 400 }
      )
    }
    
    // Create goal
    const goal = await prisma.agentGoal.create({
      data: {
        id: await generateSnowflakeId(),
        agentUserId: agentId,
        type,
        name,
        description,
        target: typeof target === 'string' ? target : undefined,
        priority: priorityValue,
        status: 'active',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })
    
    return NextResponse.json({
      success: true,
      goal: {
        ...goal,
        target: goal.target ? JSON.parse(JSON.stringify(goal.target)) : null
      }
    })
  } catch (error) {
    console.error('Error creating agent goal:', error)
    return NextResponse.json(
      { error: 'Failed to create goal' },
      { status: 500 }
    )
  }
}

