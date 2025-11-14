/**
 * Babylon Plugin Integration Service
 * 
 * Integrates the Babylon A2A plugin with the agent runtime manager.
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import type { HttpA2AClient } from '@/lib/a2a/client'
import { createHttpA2AClient } from '@/lib/a2a/client'
import { babylonPlugin } from './index'
import type { BabylonRuntime } from './types'
import type { AgentRuntime } from '@elizaos/core'

/**
 * Initialize A2A client for an agent
 * A2A IS REQUIRED - This must succeed for agents to work properly
 */
export async function initializeAgentA2AClient(
  agentUserId: string
): Promise<HttpA2AClient> {
  // Get agent user
  const agent = await prisma.user.findUnique({
    where: { id: agentUserId }
  })

  if (!agent || !agent.isAgent) {
    throw new Error(`Agent user ${agentUserId} not found or not an agent`)
  }

  // Check if agent has wallet (REQUIRED)
  if (!agent.walletAddress) {
    throw new Error(`Agent ${agentUserId} has no wallet address. Wallet is required for A2A protocol.`)
  }

  // Get wallet credentials (REQUIRED)
  const privateKey = process.env[`AGENT_${agentUserId}_PRIVATE_KEY`] || 
                    process.env.AGENT_DEFAULT_PRIVATE_KEY

  if (!privateKey) {
    throw new Error(`No private key configured for agent ${agentUserId}. Set AGENT_DEFAULT_PRIVATE_KEY or AGENT_${agentUserId}_PRIVATE_KEY in environment.`)
  }

  // Determine capabilities based on agent config
  const strategies = agent.agentTradingStrategy 
    ? ['autonomous-trading', 'prediction-markets', 'social-interaction', agent.agentTradingStrategy]
    : ['social-interaction', 'chat']
  
  const actions: string[] = []
  if (agent.autonomousTrading) actions.push('trade')
  if (agent.autonomousPosting) actions.push('post', 'comment')
  if (agent.autonomousDMs || agent.autonomousGroupChats) actions.push('message')
  actions.push('read', 'analyze')
  
  const capabilities = {
    strategies,
    markets: ['prediction', 'perp'],
    actions,
    version: '1.0.0'
  }

  // Get A2A endpoint (REQUIRED)
  const a2aEndpoint = process.env.BABYLON_A2A_ENDPOINT
  
  if (!a2aEndpoint) {
    throw new Error('BABYLON_A2A_ENDPOINT not configured. A2A server endpoint is required.')
  }
  
  // Create HTTP A2A client (no connection needed!)
  const a2aClient = createHttpA2AClient({
    endpoint: a2aEndpoint,
    agentId: agentUserId,
    address: agent.walletAddress,
    tokenId: agent.agent0TokenId || undefined
  })
  
  logger.info('✅ HTTP A2A client created', { 
    agentUserId, 
    agentName: agent.displayName,
    endpoint: a2aEndpoint,
    capabilities 
  })

  return a2aClient
}

/**
 * Enhance agent runtime with Babylon plugin
 * Tries A2A connection, falls back to database-only mode if A2A unavailable
 */
export async function enhanceRuntimeWithBabylon(
  runtime: AgentRuntime,
  agentUserId: string
): Promise<void> {
  const babylonRuntime = runtime as BabylonRuntime

  // Try to initialize A2A client (optional - graceful degradation)
  try {
    const a2aClient = await initializeAgentA2AClient(agentUserId)
    babylonRuntime.a2aClient = a2aClient
    
    logger.info('✅ Babylon plugin registered with A2A protocol', { 
      agentUserId,
      pluginName: babylonPlugin.name,
      providersCount: babylonPlugin.providers?.length || 0,
      actionsCount: babylonPlugin.actions?.length || 0,
      a2aConnected: true
    })
  } catch (error) {
    logger.warn('A2A client initialization failed - using database fallback mode', {
      agentUserId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Continue without A2A - autonomous services will use database fallback
  }
  
  // Always register plugin (works with or without A2A)
  runtime.registerPlugin(babylonPlugin)
  
  logger.info('Babylon plugin registered', { 
    agentUserId,
    mode: babylonRuntime.a2aClient?.isConnected() ? 'a2a' : 'database'
  })
}

/**
 * Disconnect A2A client for an agent
 */
export async function disconnectAgentA2AClient(runtime: AgentRuntime): Promise<void> {
  const babylonRuntime = runtime as BabylonRuntime
  
  if (!babylonRuntime.a2aClient?.isConnected()) {
    return
  }

  try {
    await (babylonRuntime.a2aClient as any).disconnect()
    babylonRuntime.a2aClient = undefined
    
    logger.info('A2A client disconnected', { agentId: runtime.agentId })
  } catch (error) {
    logger.error('Failed to disconnect A2A client', error, 'BabylonIntegration')
  }
}

/**
 * Check if agent runtime has active A2A connection
 */
export function hasActiveA2AConnection(runtime: AgentRuntime): boolean {
  const babylonRuntime = runtime as BabylonRuntime
  return !!babylonRuntime.a2aClient?.isConnected()
}

