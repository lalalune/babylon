/**
 * Agent Autonomous Tick Handler v2
 * 
 * POST /api/cron/agent-tick - Run all autonomous agents
 * 
 * IMPORTANT: Agents are Users (isAgent=true). They can:
 * - Trade (autonomousTrading)
 * - Post (autonomousPosting)
 * - Comment (autonomousCommenting)  
 * - Send DMs (autonomousDMs)
 * - Participate in group chats (autonomousGroupChats)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager'
import { agentService } from '@/lib/agents/services/AgentService'
import { ModelType } from '@elizaos/core'

export async function POST(_req: NextRequest) {
  const startTime = Date.now()
  logger.info('Agent tick started', undefined, 'AgentTick')

  const agents = await prisma.user.findMany({
    where: {
      isAgent: true,
      agentPointsBalance: { gte: 1 },
      OR: [
        { autonomousTrading: true },
        { autonomousPosting: true },
        { autonomousCommenting: true },
        { autonomousDMs: true },
        { autonomousGroupChats: true }
      ]
    }
  })

  logger.info(`Found ${agents.length} autonomous agents to run`, undefined, 'AgentTick')

  const results = []

  for (const agent of agents) {
    const agentStartTime = Date.now()
    
    const pointsCost = agent.agentModelTier === 'pro' ? 2 : 1
    
    await agentService.deductPoints(agent.id, pointsCost, 'Autonomous tick')

    const runtime = await agentRuntimeManager.getRuntime(agent.id)

    const enabledFeatures = []
    if (agent.autonomousTrading) enabledFeatures.push('trading')
    if (agent.autonomousPosting) enabledFeatures.push('posting')
    if (agent.autonomousCommenting) enabledFeatures.push('commenting')
    if (agent.autonomousDMs) enabledFeatures.push('DMs')
    if (agent.autonomousGroupChats) enabledFeatures.push('group chats')

    const prompt = `${agent.agentSystem}

You are ${agent.displayName}, running autonomously.
Enabled features: ${enabledFeatures.join(', ')}
Trading strategy: ${agent.agentTradingStrategy!}
Current P&L: ${agent.lifetimePnL}

Task: Evaluate what actions you should take this tick.
Consider the current state and decide if you should:
${agent.autonomousTrading ? '- Make any trades' : ''}
${agent.autonomousPosting ? '- Create any posts' : ''}
${agent.autonomousCommenting ? '- Comment on anything' : ''}
${agent.autonomousDMs ? '- Respond to any DMs' : ''}
${agent.autonomousGroupChats ? '- Participate in group chats' : ''}

Respond with your analysis and intended actions.`

    const modelType = agent.agentModelTier === 'pro' ? ModelType.TEXT_LARGE : ModelType.TEXT_SMALL
    const thinking = await runtime.useModel(modelType, {
      prompt,
      temperature: 0.7,
      maxTokens: 500
    })

    await agentService.createLog(agent.id, {
      type: 'tick',
      level: 'info',
      message: 'Autonomous tick completed',
      prompt,
      thinking,
      metadata: {
        pointsCost,
        duration: Date.now() - agentStartTime,
        modelUsed: agent.agentModelTier === 'pro' ? 'groq-70b' : 'groq-8b',
        enabledFeatures
      }
    })

    await prisma.user.update({
      where: { id: agent.id },
      data: {
        agentLastTickAt: new Date(),
        agentStatus: 'running'
      }
    })

    results.push({
      agentId: agent.id,
      name: agent.displayName,
      status: 'success',
      pointsDeducted: pointsCost,
      duration: Date.now() - agentStartTime
    })

    logger.info(`Agent ${agent.displayName} tick completed in ${Date.now() - agentStartTime}ms`, undefined, 'AgentTick')
  }

  const duration = Date.now() - startTime
  logger.info(`Agent tick completed in ${duration}ms`, undefined, 'AgentTick')

  return NextResponse.json({
    success: true,
    processed: results.length,
    duration,
    results
  })
}

