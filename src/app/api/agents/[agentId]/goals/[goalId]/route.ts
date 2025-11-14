/**
 * Single Goal Management API
 * 
 * @route GET/PUT/DELETE /api/agents/[agentId]/goals/[goalId]
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticate } from '@/lib/api/auth-middleware'

/**
 * GET - Get single goal
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string; goalId: string }> }
) {
  try {
    const authUser = await authenticate(req)
    const userId = authUser.userId
    const { agentId, goalId } = await params
    
    // Verify ownership
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { isAgent: true, managedBy: true }
    })
    
    if (!agent?.isAgent || agent.managedBy !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    const goal = await prisma.agentGoal.findUnique({
      where: { id: goalId },
      include: {
        AgentGoalAction: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    })
    
    if (!goal || goal.agentUserId !== agentId) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      goal: {
        ...goal,
        target: goal.target ? JSON.parse(JSON.stringify(goal.target)) : null
      }
    })
  } catch (error) {
    console.error('Error fetching goal:', error)
    return NextResponse.json(
      { error: 'Failed to fetch goal' },
      { status: 500 }
    )
  }
}

/**
 * PUT - Update goal
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string; goalId: string }> }
) {
  try {
    const authUser = await authenticate(req)
    const userId = authUser.userId
    const { agentId, goalId } = await params
    
    // Verify ownership
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { isAgent: true, managedBy: true }
    })
    
    if (!agent?.isAgent || agent.managedBy !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    // Get existing goal
    const existingGoal = await prisma.agentGoal.findUnique({
      where: { id: goalId }
    })
    
    if (!existingGoal || existingGoal.agentUserId !== agentId) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
    
    // Parse updates
    const body = await req.json()
    const { name, description, target, priority, status } = body
    
    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date()
    }
    
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (target !== undefined) updates.target = target
    if (priority !== undefined) {
      if (priority < 1 || priority > 10) {
        return NextResponse.json(
          { error: 'Priority must be between 1 and 10' },
          { status: 400 }
        )
      }
      updates.priority = priority
    }
    if (status !== undefined) {
      const validStatuses = ['active', 'paused', 'completed', 'failed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        )
      }
      updates.status = status
      
      if (status === 'completed' && !existingGoal.completedAt) {
        updates.completedAt = new Date()
      }
    }
    
    // Update goal
    const updatedGoal = await prisma.agentGoal.update({
      where: { id: goalId },
      data: updates
    })
    
    return NextResponse.json({
      success: true,
      goal: {
        ...updatedGoal,
        target: updatedGoal.target ? JSON.parse(JSON.stringify(updatedGoal.target)) : null
      }
    })
  } catch (error) {
    console.error('Error updating goal:', error)
    return NextResponse.json(
      { error: 'Failed to update goal' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Delete goal
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string; goalId: string }> }
) {
  try {
    const authUser = await authenticate(req)
    const userId = authUser.userId
    const { agentId, goalId } = await params
    
    // Verify ownership
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { isAgent: true, managedBy: true }
    })
    
    if (!agent?.isAgent || agent.managedBy !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    // Verify goal exists and belongs to agent
    const goal = await prisma.agentGoal.findUnique({
      where: { id: goalId }
    })
    
    if (!goal || goal.agentUserId !== agentId) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
    
    // Delete goal (cascades to goal actions)
    await prisma.agentGoal.delete({
      where: { id: goalId }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Goal deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting goal:', error)
    return NextResponse.json(
      { error: 'Failed to delete goal' },
      { status: 500 }
    )
  }
}

