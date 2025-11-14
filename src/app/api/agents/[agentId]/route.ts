/**
 * Individual Agent Management API
 * 
 * @route GET /api/agents/[agentId] - Get agent details
 * @route PUT /api/agents/[agentId] - Update agent configuration
 * @route DELETE /api/agents/[agentId] - Delete agent
 * @access Authenticated (owner only)
 * 
 * @description
 * Manage individual agent details, configuration, and lifecycle. Provides
 * comprehensive agent information including performance metrics, balance,
 * autonomous action settings, and operational status.
 * 
 * **GET - Retrieve Agent Details**
 * 
 * Returns complete agent profile with real-time performance statistics:
 * - Trading performance (PnL, win rate, total trades)
 * - Points balance and spending history
 * - Autonomous action permissions
 * - System prompts and personality configuration
 * - Activity timestamps (last tick, last chat)
 * - On-chain registration status
 * 
 * @param {string} agentId - Agent user ID (path parameter)
 * 
 * @returns {object} Agent details with performance metrics
 * @property {boolean} success - Operation success
 * @property {object} agent - Complete agent profile and stats
 * 
 * **PUT - Update Agent Configuration**
 * 
 * Update agent settings, permissions, and configuration. Supports partial
 * updates - only provided fields are modified.
 * 
 * @param {string} agentId - Agent user ID (path parameter)
 * @param {string} name - Agent display name (optional)
 * @param {string} description - Agent description (optional)
 * @param {string} profileImageUrl - Profile image URL (optional)
 * @param {string} system - System prompt (optional)
 * @param {string} bio - Biography (optional)
 * @param {string} personality - Personality traits (optional)
 * @param {string} tradingStrategy - Trading strategy (optional)
 * @param {string} modelTier - Model tier: 'free' | 'pro' (optional)
 * @param {boolean} isActive - Active status (optional)
 * @param {boolean} autonomousEnabled - Enable autonomous actions (optional)
 * 
 * @returns {object} Updated agent details
 * 
 * **DELETE - Delete Agent**
 * 
 * Permanently deletes agent and all associated data. This action cannot be undone.
 * 
 * @param {string} agentId - Agent user ID (path parameter)
 * 
 * @returns {object} Success confirmation
 * 
 * @throws {404} Agent not found or unauthorized
 * @throws {401} Unauthorized - authentication required
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Get agent details
 * const agent = await fetch(`/api/agents/${agentId}`, {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * 
 * // Update agent
 * await fetch(`/api/agents/${agentId}`, {
 *   method: 'PUT',
 *   body: JSON.stringify({
 *     autonomousTrading: true,
 *     modelTier: 'pro'
 *   })
 * });
 * 
 * // Delete agent
 * await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
 * ```
 * 
 * @see {@link /lib/agents/services/AgentService} Agent service
 * @see {@link /src/app/agents/[agentId]/page.tsx} Agent detail page
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { agentService } from '@/lib/agents/services/AgentService'
import { logger } from '@/lib/logger'
import { authenticateUser } from '@/lib/server-auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const user = await authenticateUser(req)
  const { agentId } = await params

  const agent = await agentService.getAgent(agentId, user.id)
  const performance = await agentService.getPerformance(agentId)

  return NextResponse.json({
    success: true,
    agent: {
      id: agent!.id,
      username: agent!.username,
      name: agent!.displayName,
      description: agent!.bio,
      profileImageUrl: agent!.profileImageUrl,
      system: agent!.agentSystem,
      bio: agent!.bio!.split('\n').filter(b => b.trim()),
      personality: agent!.agentPersonality,
      tradingStrategy: agent!.agentTradingStrategy,
      pointsBalance: agent!.agentPointsBalance,
      totalDeposited: agent!.agentTotalDeposited,
      totalWithdrawn: agent!.agentTotalWithdrawn,
      totalPointsSpent: agent!.agentTotalPointsSpent,
      isActive: agent!.agentStatus === 'active',
      autonomousEnabled: agent!.autonomousTrading!,
      autonomousTrading: agent!.autonomousTrading,
      autonomousPosting: agent!.autonomousPosting,
      autonomousCommenting: agent!.autonomousCommenting,
      autonomousDMs: agent!.autonomousDMs,
      autonomousGroupChats: agent!.autonomousGroupChats,
      modelTier: agent!.agentModelTier,
      status: agent!.agentStatus,
      errorMessage: agent!.agentErrorMessage,
      lifetimePnL: agent!.lifetimePnL.toString(),
      totalTrades: performance.totalTrades,
      profitableTrades: performance.profitableTrades,
      winRate: performance.winRate,
      lastTickAt: agent!.agentLastTickAt?.toISOString(),
      lastChatAt: agent!.agentLastChatAt?.toISOString(),
      walletAddress: agent!.walletAddress,
      agent0TokenId: agent!.agent0TokenId,
      onChainRegistered: agent!.onChainRegistered,
      createdAt: agent!.createdAt.toISOString(),
      updatedAt: agent!.updatedAt.toISOString()
    }
  })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const user = await authenticateUser(req)
  const { agentId } = await params
  const body = await req.json()

  const { name, description, profileImageUrl, system, bio, personality, tradingStrategy, modelTier, isActive, autonomousEnabled } = body

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (profileImageUrl !== undefined) updates.profileImageUrl = profileImageUrl
  if (system !== undefined) updates.system = system
  if (bio !== undefined) updates.bio = bio
  if (personality !== undefined) updates.personality = personality
  if (tradingStrategy !== undefined) updates.tradingStrategy = tradingStrategy
  if (modelTier !== undefined) updates.modelTier = modelTier
  if (isActive !== undefined) updates.isActive = isActive
  if (autonomousEnabled !== undefined) updates.autonomousEnabled = autonomousEnabled

  const agent = await agentService.updateAgent(agentId, user.id, updates)

  logger.info(`Agent updated via API: ${agentId}`, undefined, 'AgentsAPI')

  return NextResponse.json({
    success: true,
    agent: {
      id: agent.id,
      username: agent.username,
      name: agent.displayName,
      description: agent.bio,
      profileImageUrl: agent.profileImageUrl,
      pointsBalance: agent.agentPointsBalance,
      autonomousTrading: agent.autonomousTrading,
      autonomousPosting: agent.autonomousPosting,
      modelTier: agent.agentModelTier,
      updatedAt: agent.updatedAt.toISOString()
    }
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const user = await authenticateUser(req)
  const { agentId } = await params

  await agentService.deleteAgent(agentId, user.id)

  logger.info(`Agent deleted via API: ${agentId}`, undefined, 'AgentsAPI')

  return NextResponse.json({
    success: true,
    message: 'Agent deleted successfully'
  })
}

