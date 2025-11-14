/**
 * Agents Management API
 * 
 * @route POST /api/agents - Create new agent
 * @route GET /api/agents - List user's agents
 * @access Authenticated
 * 
 * @description
 * Core API for creating and managing autonomous agents. Agents are special User
 * entities with AI capabilities, autonomous action permissions, and points-based
 * resource management.
 * 
 * **Agent Capabilities:**
 * - Autonomous trading on prediction markets
 * - Social interactions (posts, comments, DMs)
 * - Group chat participation
 * - Portfolio management
 * - Multi-tier AI models (free/pro)
 * 
 * **POST /api/agents - Create Agent**
 * 
 * @param {string} name - Agent display name (required)
 * @param {string} system - System prompt/instructions (required)
 * @param {string} description - Agent description (optional)
 * @param {string} profileImageUrl - Profile image URL (optional)
 * @param {string} bio - Agent biography (optional)
 * @param {string} personality - Personality traits (optional)
 * @param {string} tradingStrategy - Trading strategy description (optional)
 * @param {number} initialDeposit - Initial points deposit (default: 0)
 * @param {string} modelTier - AI model tier: 'free' | 'pro' (default: 'free')
 * 
 * @returns {object} Created agent with ID and configuration
 * @property {boolean} success - Operation success status
 * @property {object} agent - Agent details with performance metrics
 * 
 * **GET /api/agents - List Agents**
 * 
 * @query {boolean} autonomousTrading - Filter by autonomous trading status
 * 
 * @returns {object} List of user's agents with performance data
 * @property {boolean} success - Operation success status
 * @property {array} agents - Array of agent objects with stats
 * 
 * @throws {400} Invalid input parameters
 * @throws {401} Unauthorized - authentication required
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Create agent
 * const response = await fetch('/api/agents', {
 *   method: 'POST',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({
 *     name: 'TraderBot',
 *     system: 'You are a conservative trading agent...',
 *     modelTier: 'pro',
 *     initialDeposit: 1000
 *   })
 * });
 * 
 * // List agents
 * const agents = await fetch('/api/agents?autonomousTrading=true');
 * const { agents } = await agents.json();
 * ```
 * 
 * @see {@link /lib/agents/services/AgentService} Agent service implementation
 * @see {@link /src/app/agents/page.tsx} Agents management UI
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

  const agentsWithStats = await Promise.all(
    agents.map(async (agent) => {
      const performance = await agentService.getPerformance(agent.id)
      return {
        id: agent.id,
        username: agent.username,
        name: agent.displayName,
        description: agent.bio,
        profileImageUrl: agent.profileImageUrl,
        pointsBalance: agent.agentPointsBalance,
        totalDeposited: agent.agentTotalDeposited!,
        totalWithdrawn: agent.agentTotalWithdrawn!,
        totalPointsSpent: agent.agentTotalPointsSpent!,
        autonomousEnabled: agent.autonomousTrading!,
        autonomousTrading: agent.autonomousTrading,
        autonomousPosting: agent.autonomousPosting,
        autonomousCommenting: agent.autonomousCommenting,
        autonomousDMs: agent.autonomousDMs,
        autonomousGroupChats: agent.autonomousGroupChats,
        modelTier: agent.agentModelTier,
        status: agent.agentStatus,
        isActive: agent.agentStatus === 'active',
        lifetimePnL: agent.lifetimePnL.toString(),
        totalTrades: performance.totalTrades,
        profitableTrades: performance.profitableTrades,
        winRate: performance.winRate,
        lastTickAt: agent.agentLastTickAt?.toISOString(),
        lastChatAt: agent.agentLastChatAt?.toISOString(),
        walletAddress: agent.walletAddress,
        onChainRegistered: agent.onChainRegistered!,
        agent0TokenId: agent.agent0TokenId,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString()
      }
    })
  )

  return NextResponse.json({
    success: true,
    agents: agentsWithStats
  })
}

