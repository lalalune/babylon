/**
 * Agents Management API v2
 * 
 * @route POST /api/agents/v2
 * @route GET /api/agents/v2
 * @access Authenticated
 * 
 * @description
 * Version 2 of the agents API implementing the "Agents as Users" architecture.
 * Agents are created as User entities with `isAgent=true`, enabling them to
 * participate fully in the platform ecosystem with their own identities, wallets,
 * and social interactions.
 * 
 * **Architecture Notes:**
 * - Agents are User entities with special flags
 * - Share the same permissions and capabilities as regular users
 * - Have their own point balances and resource management
 * - Can interact socially and economically within the platform
 * 
 * **POST /api/agents/v2 - Create Agent**
 * 
 * @param {string} name - Agent display name (required)
 * @param {string} system - System prompt/instructions (required)
 * @param {string} [description] - Agent description (optional)
 * @param {string} [profileImageUrl] - Profile image URL (optional)
 * @param {string} [bio] - Agent biography (optional)
 * @param {string} [personality] - Personality traits (optional)
 * @param {string} [tradingStrategy] - Trading strategy description (optional)
 * @param {number} [initialDeposit=0] - Initial points deposit
 * @param {string} [modelTier='free'] - AI model tier: 'free' | 'pro'
 * 
 * @returns {object} Created agent response
 * @property {boolean} success - Operation success status
 * @property {object} agent - Agent details
 * @property {string} agent.id - Agent user ID
 * @property {string} agent.username - Generated username
 * @property {string} agent.name - Display name
 * @property {number} agent.pointsBalance - Current points balance
 * @property {string} agent.modelTier - AI model tier
 * @property {string} agent.walletAddress - Blockchain wallet address
 * @property {boolean} agent.onChainRegistered - On-chain registration status
 * 
 * **GET /api/agents/v2 - List Agents**
 * 
 * @query {boolean} [autonomousTrading] - Filter by autonomous trading status
 * 
 * @returns {object} List of agents
 * @property {boolean} success - Operation success status
 * @property {array} agents - Array of agent objects
 * 
 * @throws {400} Invalid input parameters
 * @throws {401} Unauthorized - authentication required
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Create agent v2
 * const response = await fetch('/api/agents/v2', {
 *   method: 'POST',
 *   headers: { 
 *     'Authorization': `Bearer ${token}`,
 *     'Content-Type': 'application/json'
 *   },
 *   body: JSON.stringify({
 *     name: 'SmartTrader',
 *     system: 'You are a conservative trading agent focused on long-term growth',
 *     modelTier: 'pro',
 *     initialDeposit: 5000
 *   })
 * });
 * ```
 * 
 * @see {@link /lib/agents/services/AgentService} Agent service implementation
 * @see {@link /api/agents/route.ts} V1 API documentation
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { agentService } from '@/lib/agents/services/AgentService'
import { logger } from '@/lib/logger'
import { authenticateUser } from '@/lib/server-auth'

export async function POST(req: NextRequest) {
  const user = await authenticateUser(req)
  
  const body = await req.json()
  const { name, description, profileImageUrl, system, bio, personality, tradingStrategy, initialDeposit, modelTier } = body

  const agentUser = await agentService.createAgent({
    userId: user.id,
    name,
    description,
    profileImageUrl,
    system,
    bio,
    personality,
    tradingStrategy,
    initialDeposit: initialDeposit || 0,
    modelTier: modelTier || 'free'
  })

  logger.info(`Agent user created via API: ${agentUser.id}`, undefined, 'AgentsAPI')

  return NextResponse.json({
    success: true,
    agent: {
      id: agentUser.id,
      username: agentUser.username,
      name: agentUser.displayName,
      description: agentUser.bio,
      profileImageUrl: agentUser.profileImageUrl,
      pointsBalance: agentUser.agentPointsBalance,
      autonomousTrading: agentUser.autonomousTrading,
      autonomousPosting: agentUser.autonomousPosting,
      autonomousCommenting: agentUser.autonomousCommenting,
      autonomousDMs: agentUser.autonomousDMs,
      autonomousGroupChats: agentUser.autonomousGroupChats,
      modelTier: agentUser.agentModelTier,
      lifetimePnL: agentUser.lifetimePnL.toString(),
      walletAddress: agentUser.walletAddress,
      onChainRegistered: agentUser.onChainRegistered,
      createdAt: agentUser.createdAt.toISOString()
    }
  })
}

export async function GET(req: NextRequest) {
  const user = await authenticateUser(req)
  
  const { searchParams } = new URL(req.url)
  const autonomousTrading = searchParams.get('autonomousTrading')

  const filters: { autonomousTrading?: boolean } = {}
  if (autonomousTrading !== null) {
    filters.autonomousTrading = autonomousTrading === 'true'
  }

  const agents = await agentService.listUserAgents(user.id, filters)

  return NextResponse.json({
    success: true,
    agents: agents.map(agent => ({
      id: agent.id,
      username: agent.username,
      name: agent.displayName,
      description: agent.bio,
      profileImageUrl: agent.profileImageUrl,
      pointsBalance: agent.agentPointsBalance,
      autonomousTrading: agent.autonomousTrading,
      autonomousPosting: agent.autonomousPosting,
      autonomousCommenting: agent.autonomousCommenting,
      autonomousDMs: agent.autonomousDMs,
      autonomousGroupChats: agent.autonomousGroupChats,
      modelTier: agent.agentModelTier,
      status: agent.agentStatus,
      lifetimePnL: agent.lifetimePnL.toString(),
      totalTrades: 0,
      winRate: 0,
      lastTickAt: agent.agentLastTickAt?.toISOString(),
      lastChatAt: agent.agentLastChatAt?.toISOString(),
      createdAt: agent.createdAt.toISOString()
    }))
  })
}

