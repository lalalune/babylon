/**
 * Autonomous Agent Tick Cron Job
 * 
 * @route POST /api/cron/agent-tick
 * @access Cron (requires CRON_SECRET)
 * 
 * @description
 * Scheduled cron job that runs all autonomous agents, executing their
 * configured autonomous actions. Processes agents in sequence, deducting
 * points and logging all activities. Automatically pauses agents with
 * insufficient points.
 * 
 * **Agent Capabilities:**
 * Each agent can have multiple autonomous features enabled:
 * - **autonomousTrading:** Execute trades on prediction/perp markets
 * - **autonomousPosting:** Create social media posts
 * - **autonomousCommenting:** Reply to posts and comments
 * - **autonomousDMs:** Send direct messages to users
 * - **autonomousGroupChats:** Participate in group conversations
 * 
 * **Execution Flow:**
 * 1. Query all agents with autonomous features enabled
 * 2. Check points balance (minimum 1 point required)
 * 3. Deduct points based on model tier (free: 1 point, pro: 2 points)
 * 4. Load agent runtime with personality and configuration
 * 5. Execute coordinated autonomous tick via AutonomousCoordinator
 * 6. Log all actions and update agent status
 * 7. Handle errors and auto-pause if insufficient points
 * 
 * **Coordinated Execution:**
 * Uses AutonomousCoordinator for intelligent decision-making:
 * - Dashboard context for situational awareness
 * - Batch response processing for efficiency
 * - Coordinated action planning across all features
 * - Comprehensive logging and analytics
 * 
 * **Points System:**
 * - Free tier: 1 point per tick
 * - Pro tier: 2 points per tick
 * - Auto-pause when balance < required points
 * - Points refunded on errors
 * 
 * **Agent States:**
 * - **running:** Successfully executing autonomous actions
 * - **paused:** Insufficient points or manually paused
 * - **error:** Encountered error during execution
 * 
 * **Authentication:**
 * Requires `Authorization: Bearer ${CRON_SECRET}` header
 * 
 * @returns {object} Execution summary
 * @property {boolean} success - Overall operation success
 * @property {number} processed - Number of agents processed
 * @property {number} duration - Total execution time (ms)
 * @property {array} results - Per-agent execution results
 * 
 * **Result Object:**
 * @property {string} agentId - Agent user ID
 * @property {string} name - Agent display name
 * @property {string} status - Execution status (success/error/paused)
 * @property {number} pointsDeducted - Points deducted for tick (if successful)
 * @property {number} duration - Agent execution time (ms)
 * @property {string} error - Error message (if failed)
 * @property {string} reason - Failure reason (if paused)
 * 
 * @throws {401} Unauthorized - invalid or missing CRON_SECRET
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Trigger cron job (Vercel Cron, GitHub Actions, etc.)
 * const response = await fetch('https://your-domain.com/api/cron/agent-tick', {
 *   method: 'POST',
 *   headers: {
 *     'Authorization': `Bearer ${process.env.CRON_SECRET}`
 *   }
 * });
 * 
 * const { processed, duration, results } = await response.json();
 * console.log(`Processed ${processed} agents in ${duration}ms`);
 * 
 * // Check results
 * results.forEach(result => {
 *   if (result.status === 'success') {
 *     console.log(`✓ ${result.name}: ${result.duration}ms`);
 *   } else {
 *     console.log(`✗ ${result.name}: ${result.error || result.reason}`);
 *   }
 * });
 * ```
 * 
 * **Cron Schedule (vercel.json):**
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/cron/agent-tick",
 *     "schedule": "* * * * *"
 *   }]
 * }
 * ```
 * 
 * @see {@link /lib/agents/runtime/AgentRuntimeManager} Runtime management
 * @see {@link /lib/agents/autonomous} Autonomous coordinator
 * @see {@link /lib/agents/services/AgentService} Agent service
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager'
import { agentService } from '@/lib/agents/services/AgentService'
import { autonomousCoordinator, AutonomousCoordinatorWithRecording } from '@/lib/agents/autonomous'

// Vercel function configuration
export const maxDuration = 300; // 5 minutes max for agent tick
export const dynamic = 'force-dynamic';

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

    // Use recording coordinator for RL training data collection
    // Can be toggled via environment variable
    const shouldRecord = process.env.RECORD_AGENT_TRAJECTORIES === 'true';
    const coordinator = shouldRecord 
      ? new AutonomousCoordinatorWithRecording() 
      : autonomousCoordinator;
    
    const tickResult = await coordinator.executeAutonomousTick(agent.id, runtime)

    const actions = {
      trades: tickResult.actionsExecuted.trades,
      posts: tickResult.actionsExecuted.posts,
      comments: tickResult.actionsExecuted.comments,
      dms: tickResult.actionsExecuted.messages,
      groupMessages: tickResult.actionsExecuted.groupMessages
    }

    await agentService.createLog(agent.id, {
      type: 'tick',
      level: 'info',
      message: `Tick completed: ${actions.trades} trades, ${actions.posts} posts, ${actions.comments} comments, ${actions.dms} DMs, ${actions.groupMessages} group messages`,
      metadata: {
        pointsCost,
        duration: Date.now() - agentStartTime,
        modelUsed: agent.agentModelTier === 'pro' ? 'groq-70b' : 'groq-8b',
        enabledFeatures,
        actions
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

