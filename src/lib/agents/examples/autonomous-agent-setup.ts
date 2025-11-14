/**
 * Autonomous Agent Setup Example
 * 
 * Complete example showing how to set up an autonomous agent
 * with the new batch processing and dashboard system.
 */

import { AgentRuntime, ModelType } from '@elizaos/core'
import type { Character } from '@elizaos/core'
import { babylonPlugin } from '../plugins/babylon'
import { autonomousCoordinator } from '../autonomous'
import { groqPlugin } from '../plugins/groq'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/database-service'

/**
 * Example 1: Basic Autonomous Agent Setup
 */
export async function setupBasicAutonomousAgent(agentUserId: string): Promise<{ agent: { id: string; displayName: string | null; isAgent: boolean; agentSystem: string | null }; runtime: AgentRuntime }> {
  // 1. Load agent from database
  const agent = await prisma.user.findUnique({
    where: { id: agentUserId },
    select: {
      id: true,
      username: true,
      displayName: true,
      isAgent: true,
      agentSystem: true,
      bio: true,  // Changed from agentBio
      personality: true,  // Changed from agentPersonality
      agentTradingStrategy: true,
      agentModelTier: true,
      autonomousTrading: true,  // Changed from autonomousEnabled
      autonomousPosting: true,
      autonomousCommenting: true,
      autonomousDMs: true,
      autonomousGroupChats: true
    }
  })

  if (!agent) {
    throw new Error('Agent not found')
  }

  // Check if at least one autonomous feature is enabled
  const hasAutonomousFeatures = agent.autonomousTrading || agent.autonomousPosting || 
                                  agent.autonomousCommenting || agent.autonomousDMs || 
                                  agent.autonomousGroupChats

  if (!hasAutonomousFeatures) {
    throw new Error('Agent does not have any autonomous features enabled')
  }

  // 2. Create Eliza character from agent config
  const character: Character = {
    name: agent.displayName || agent.username || 'Agent',
    username: agent.username || 'agent',
    system: agent.agentSystem || 'You are a helpful AI agent on Babylon.',
    bio: agent.bio ? JSON.parse(agent.bio) : [],
    
    settings: {
      // Use TEXT_SMALL for most operations (routes to openai/gpt-oss-120b)
      // Use TEXT_LARGE for quality content (routes to qwen/qwen3-32b)
      model: agent.agentModelTier === 'pro' 
        ? ModelType.TEXT_LARGE 
        : ModelType.TEXT_SMALL,
      temperature: 0.7,
      maxTokens: 1000
    },
    
    plugins: [] // Will be added to runtime instead
  }

  // 3. Initialize runtime with plugins
  logger.info(`Initializing runtime for agent ${agent.displayName}`, undefined, 'AgentSetup')
  logger.info(`GROQ_API_KEY available: ${!!process.env.GROQ_API_KEY}`, undefined, 'AgentSetup')
  
  const runtime = new AgentRuntime({
    agentId: agent.id as `${string}-${string}-${string}-${string}-${string}`,
    character,
    databaseAdapter: undefined // Using our own Prisma setup
  } as any)

  // CRITICAL: Set logger on runtime (use console.bind pattern from otc-agent working implementation)
  // Provide all required properties for the Logger type
  if (!runtime.logger || !runtime.logger.log) {
    runtime.logger = {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console),
      trace: console.trace ? console.trace.bind(console) : (..._args: unknown[]) => {},
      fatal: console.error.bind(console),
      success: console.info.bind(console),
      progress: console.info.bind(console),
      clear: () => console.clear ? console.clear() : undefined,
      child: (_bindings: Record<string, unknown>) => runtime.logger,
      level: 'info', // default level, adjust if necessary
    }
  }

  // Register plugins manually
  logger.info(`Registering groqPlugin...`, undefined, 'AgentSetup')
  await runtime.registerPlugin(groqPlugin)
  
  logger.info(`Registering babylonPlugin...`, undefined, 'AgentSetup')
  await runtime.registerPlugin(babylonPlugin)

  // Note: Not calling runtime.initialize() since we don't use SQL plugin
  // We have our own Prisma database setup

  logger.info(`Runtime fully initialized and ready`, undefined, 'AgentSetup')

  return { agent, runtime }
}

/**
 * Example 2: Start Autonomous Tick Loop
 */
export async function startAutonomousTickLoop(
  agentUserId: string,
  tickIntervalMinutes: number = 5
) {
  const { agent, runtime } = await setupBasicAutonomousAgent(agentUserId)

  const tickIntervalMs = tickIntervalMinutes * 60 * 1000

  logger.info(
    `Starting autonomous tick loop for ${agent.displayName} (every ${tickIntervalMinutes} minutes)`,
    undefined,
    'AgentSetup'
  )

  // Execute first tick immediately
  await executeTickWithLogging(agentUserId, runtime)

  // Set up recurring ticks
  const tickInterval = setInterval(async () => {
    await executeTickWithLogging(agentUserId, runtime)
  }, tickIntervalMs)

  // Return cleanup function
  return {
    stop: () => {
      clearInterval(tickInterval)
      logger.info(`Stopped autonomous tick loop for ${agent.displayName}`, undefined, 'AgentSetup')
    },
    agent,
    runtime
  }
}

/**
 * Helper: Execute tick with comprehensive logging
 */
async function executeTickWithLogging(agentUserId: string, runtime: AgentRuntime) {
  logger.info(`Starting tick for agent ${agentUserId}`, undefined, 'AgentTick')

  const result = await autonomousCoordinator.executeAutonomousTick(
    agentUserId,
    runtime
  )

  logger.info(
    `Tick completed for agent ${agentUserId}`,
    {
      success: result.success,
      trades: result.actionsExecuted.trades,
      posts: result.actionsExecuted.posts,
      comments: result.actionsExecuted.comments,
      messages: result.actionsExecuted.messages,
      engagements: result.actionsExecuted.engagements
    },
    'AgentTick'
  )

  // Alert on anomalies
  if (result.duration > 30000) {
    logger.warn(`Slow tick detected: ${result.duration}ms`, { agentUserId }, 'AgentTick')
  }

  return result
}

/**
 * Example 3: Advanced Setup with Custom Config
 */
export async function setupAdvancedAutonomousAgent(
  agentUserId: string,
  config: {
    tickInterval?: number
    enableTrading?: boolean
    enablePosting?: boolean
    enableCommenting?: boolean
    maxActionsPerTick?: number
  }
) {
  const { agent, runtime } = await setupBasicAutonomousAgent(agentUserId)

  async function customTick() {
    logger.info(`Dashboard loaded for ${agent.displayName}`, undefined, 'AgentTick')

    // Execute coordinated tick
    const result = await autonomousCoordinator.executeAutonomousTick(
      agentUserId,
      runtime
    )

    // Check limits
    const totalActions = Object.values(result.actionsExecuted).reduce((sum, count) => sum + count, 0)

    if (config.maxActionsPerTick && totalActions > config.maxActionsPerTick) {
      logger.warn(
        `Agent exceeded max actions per tick: ${totalActions} > ${config.maxActionsPerTick}`,
        { agentUserId },
        'AgentTick'
      )
    }

    return result
  }

  // Start with custom config
  const tickInterval = setInterval(
    customTick,
    (config.tickInterval || 5) * 60 * 1000
  )

  return {
    stop: () => clearInterval(tickInterval),
    agent,
    runtime,
    executeCustomTick: customTick
  }
}

/**
 * Example 4: Multi-Agent Coordinator
 */
export async function startMultiAgentSystem(agentUserIds: string[]) {
  const agents: Array<{ stop: () => void; agent: { id: string; displayName: string | null; isAgent: boolean; agentSystem: string | null }; runtime: AgentRuntime }> = []

  for (const agentUserId of agentUserIds) {
    try {
      const setup = await startAutonomousTickLoop(agentUserId, 5)
      agents.push(setup)
      
      logger.info(
        `Started agent ${setup.agent.displayName}`,
        undefined,
        'MultiAgentSystem'
      )
    } catch (error) {
      logger.error(`Failed to start agent ${agentUserId}`, error, 'MultiAgentSystem')
    }
  }

  logger.info(
    `Multi-agent system started with ${agents.length} agents`,
    undefined,
    'MultiAgentSystem'
  )

  // Return control interface
  return {
    agents,
    stopAll: () => {
      agents.forEach(agent => agent.stop())
      logger.info('All agents stopped', undefined, 'MultiAgentSystem')
    },
    getAgents: () => {
      return agents.map(({ agent }) => ({
        agentId: agent.id,
        displayName: agent.displayName
      }))
    }
  }
}

/**
 * Example 5: Test Single Tick (for debugging)
 */
export async function testSingleTick(agentUserId: string) {
  logger.info('=== Testing Single Autonomous Tick ===', undefined, 'AgentTest')

  const { agent, runtime } = await setupBasicAutonomousAgent(agentUserId)

  logger.info(`Testing agent: ${agent.displayName} (${agent.id})`, undefined, 'AgentTest')

  // Execute one tick
  const result = await autonomousCoordinator.executeAutonomousTick(
    agentUserId,
    runtime
  )

  // Calculate total actions
  const totalActions = Object.values(result.actionsExecuted).reduce((sum, count) => sum + count, 0)

  logger.info('=== Tick Test Complete ===', undefined, 'AgentTest')
  logger.info(`Success: ${result.success}`, undefined, 'AgentTest')
  logger.info(`Method: ${result.method}`, undefined, 'AgentTest')
  logger.info(`Duration: ${result.duration}ms`, undefined, 'AgentTest')
  logger.info(`Total Actions: ${totalActions}`, undefined, 'AgentTest')
  logger.info(`Breakdown:`, result.actionsExecuted, 'AgentTest')

  return {
    agent,
    result,
    totalActions
  }
}

/**
 * Example Usage in Application:
 * 
 * ```typescript
 * import { startAutonomousTickLoop } from '@/lib/agents/examples/autonomous-agent-setup'
 * 
 * // Start an autonomous agent
 * const { stop } = await startAutonomousTickLoop('agent-user-id', 5)
 * 
 * // Stop it later
 * stop()
 * ```
 * 
 * Or for multiple agents:
 * 
 * ```typescript
 * import { startMultiAgentSystem } from '@/lib/agents/examples/autonomous-agent-setup'
 * 
 * const system = await startMultiAgentSystem([
 *   'agent-1-id',
 *   'agent-2-id',
 *   'agent-3-id'
 * ])
 * 
 * // Check stats
 * const stats = await system.getStats()
 * console.log(stats)
 * 
 * // Stop all agents
 * system.stopAll()
 * ```
 */

