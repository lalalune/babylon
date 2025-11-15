/**
 * Agent Service v2 - Agents are Users
 * 
 * ARCHITECTURE: Agents ARE users (isAgent=true), not separate entities.
 * They can post, comment, join chats, trade, and do everything users can do.
 * The creating user "manages" them via the managedBy field.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { User } from '@prisma/client'
import type { CreateAgentParams, AgentPerformance } from '../types'
import { agentRuntimeManager } from '../runtime/AgentRuntimeManager'
import { generateSnowflakeId } from '@/lib/snowflake'

export class AgentServiceV2 {
  /**
   * Create agent (creates a full User with isAgent=true)
   */
  async createAgent(params: CreateAgentParams): Promise<User> {
    const { userId: managerUserId, name, description, profileImageUrl, system, bio, personality, tradingStrategy, initialDeposit, modelTier } = params

    const manager = await prisma.user.findUnique({ where: { id: managerUserId } })
    if (!manager) throw new Error('Manager user not found')

    if (initialDeposit && initialDeposit > 0) {
      const totalPoints = manager.reputationPoints
      if (totalPoints < initialDeposit) {
        throw new Error(`Insufficient points. Have: ${totalPoints}, Need: ${initialDeposit}`)
      }
    }

    const baseUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20)
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const agentUsername = `agent_${baseUsername}_${randomSuffix}`
    const agentUserId = await generateSnowflakeId()

    const agent = await prisma.$transaction(async (tx) => {
      const newAgent = await tx.user.create({
        data: {
          id: agentUserId,
          username: agentUsername,
          displayName: name,
          bio: description || `AI agent managed by ${manager.displayName || manager.username}`,
          profileImageUrl: profileImageUrl || null,
          isAgent: true,
          managedBy: managerUserId,
          agentSystem: system,
          agentPersonality: personality,
          agentTradingStrategy: tradingStrategy,
          agentMessageExamples: bio ? JSON.parse(JSON.stringify(bio)) : undefined,
          agentModelTier: modelTier || 'free',
          agentPointsBalance: initialDeposit || 0,
          agentTotalDeposited: initialDeposit || 0,
          virtualBalance: 0,
          totalDeposited: 0,
          reputationPoints: 0,
          profileComplete: true,
          hasUsername: true,
          hasBio: Boolean(description),
          hasProfileImage: Boolean(profileImageUrl),
          updatedAt: new Date()
        }
      })

      if (initialDeposit && initialDeposit > 0) {
        const initialManagerPoints = manager.reputationPoints
        
        await tx.user.update({
          where: { id: managerUserId },
          data: {
            reputationPoints: { decrement: initialDeposit },
            agentCount: { increment: 1 }
          }
        })

        await tx.agentPointsTransaction.create({
          data: {
            id: await generateSnowflakeId(),
            agentUserId,
            managerUserId,
            type: 'deposit',
            amount: initialDeposit,
            balanceBefore: 0,
            balanceAfter: initialDeposit,
            description: 'Initial deposit'
          }
        })

        await tx.pointsTransaction.create({
          data: {
            id: await generateSnowflakeId(),
            userId: managerUserId,
            amount: -initialDeposit,
            pointsBefore: initialManagerPoints,
            pointsAfter: initialManagerPoints - initialDeposit,
            reason: `Deposit to agent: ${name}`,
            metadata: JSON.stringify({ agentUserId, agentName: name })
          }
        })
      } else {
        await tx.user.update({
          where: { id: managerUserId },
          data: { agentCount: { increment: 1 } }
        })
      }

      await tx.agentLog.create({
        data: {
          id: await generateSnowflakeId(),
          agentUserId,
          type: 'system',
          level: 'info',
          message: `Agent created: ${name}`,
          metadata: { initialDeposit: initialDeposit || 0 }
        }
      })

      return newAgent
    })

    logger.info(`Agent user created: ${agentUserId} managed by ${managerUserId}`, undefined, 'AgentService')
    return agent
  }

  async getAgent(agentUserId: string, managerUserId?: string): Promise<User | null> {
    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent) return null
    if (!agent.isAgent) throw new Error('User is not an agent')
    if (managerUserId && agent.managedBy !== managerUserId) {
      throw new Error('Unauthorized: You do not manage this agent')
    }
    return agent
  }

  async listUserAgents(managerUserId: string, filters?: { autonomousTrading?: boolean }): Promise<User[]> {
    const where: { isAgent: boolean; managedBy: string; autonomousTrading?: boolean } = { isAgent: true, managedBy: managerUserId }
    if (filters?.autonomousTrading !== undefined) {
      where.autonomousTrading = filters.autonomousTrading
    }
    return prisma.user.findMany({ where, orderBy: { createdAt: 'desc' } })
  }

  async updateAgent(agentUserId: string, managerUserId: string, updates: Partial<{
    name: string
    description: string
    profileImageUrl: string
    system: string
    personality: string
    tradingStrategy: string
    modelTier: 'free' | 'pro'
    autonomousTrading: boolean
    autonomousPosting: boolean
    autonomousCommenting: boolean
    autonomousDMs: boolean
    autonomousGroupChats: boolean
  }>): Promise<User> {
    const agent = await this.getAgent(agentUserId, managerUserId) // Verify ownership

    if (updates.system || updates.personality || updates.modelTier) {
      agentRuntimeManager.clearRuntime(agentUserId)
    }

    const userUpdates: Record<string, unknown> = {}
    if (updates.name) userUpdates.displayName = updates.name
    if (updates.description) userUpdates.bio = updates.description
    if (updates.profileImageUrl !== undefined) userUpdates.profileImageUrl = updates.profileImageUrl
    if (updates.system) userUpdates.agentSystem = updates.system
    if (updates.personality) userUpdates.agentPersonality = updates.personality
    if (updates.tradingStrategy) userUpdates.agentTradingStrategy = updates.tradingStrategy
    if (updates.modelTier) userUpdates.agentModelTier = updates.modelTier
    if (updates.autonomousTrading !== undefined) userUpdates.autonomousTrading = updates.autonomousTrading
    if (updates.autonomousPosting !== undefined) userUpdates.autonomousPosting = updates.autonomousPosting
    if (updates.autonomousCommenting !== undefined) userUpdates.autonomousCommenting = updates.autonomousCommenting
    if (updates.autonomousDMs !== undefined) userUpdates.autonomousDMs = updates.autonomousDMs
    if (updates.autonomousGroupChats !== undefined) userUpdates.autonomousGroupChats = updates.autonomousGroupChats

    const updatedAgent = await prisma.user.update({
      where: { id: agentUserId },
      data: { ...userUpdates, updatedAt: new Date() }
    })

    // If agent is registered on Agent0, sync the updates
    if (agent?.agent0TokenId && process.env.AGENT0_ENABLED === 'true') {
      try {
        const { getAgent0Client } = await import('@/agents/agent0/Agent0Client')
        const agent0Client = getAgent0Client()

        // Build capabilities from updated agent
        const actions: string[] = []
        if (updatedAgent.autonomousTrading) actions.push('trade')
        if (updatedAgent.autonomousPosting) actions.push('post', 'comment')
        if (updatedAgent.autonomousDMs || updatedAgent.autonomousGroupChats) actions.push('message')
        actions.push('read', 'analyze')

        const capabilities = {
          strategies: updatedAgent.agentTradingStrategy
            ? ['autonomous-trading', 'prediction-markets', 'social-interaction', updatedAgent.agentTradingStrategy]
            : ['social-interaction', 'chat'],
          markets: ['prediction', 'perp'],
          actions,
          version: '1.0.0'
        }

        // Update on Agent0 network
        const agent0Update = await agent0Client.updateAgent(agent.agent0TokenId, {
          name: updates.name ? updates.name : (updatedAgent.displayName || undefined),
          description: updates.description ? updates.description : (updatedAgent.bio || undefined),
          imageUrl: updates.profileImageUrl !== undefined ? updates.profileImageUrl : updatedAgent.profileImageUrl,
          walletAddress: updatedAgent.walletAddress,
          mcpEndpoint: process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/mcp`
            : undefined,
          a2aEndpoint: process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/a2a`
            : undefined,
          capabilities
        })

        // Update Agent0 metadata in database
        await prisma.user.update({
          where: { id: agentUserId },
          data: {
            agent0MetadataCID: agent0Update.metadataCID,
            updatedAt: new Date()
          }
        })

        logger.info(`Agent ${agentUserId} updated on Agent0 network`, { tokenId: agent.agent0TokenId }, 'AgentService')
      } catch (error) {
        logger.warn(`Failed to update agent ${agentUserId} on Agent0 network`, { error }, 'AgentService')
        // Continue without failing the local update
      }
    }

    await prisma.agentLog.create({
      data: {
        id: await generateSnowflakeId(),
        agentUserId,
        type: 'system',
        level: 'info',
        message: 'Agent configuration updated',
        metadata: updates
      }
    })

    logger.info(`Agent updated: ${agentUserId}`, undefined, 'AgentService')
    return updatedAgent
  }

  async deleteAgent(agentUserId: string, managerUserId: string): Promise<void> {
    const agent = await this.getAgent(agentUserId, managerUserId)
    if (!agent) throw new Error('Agent not found')

    await prisma.$transaction(async (tx) => {
      // Return remaining points to manager
      if (agent.agentPointsBalance > 0) {
        await tx.user.update({
          where: { id: managerUserId },
          data: { reputationPoints: { increment: agent.agentPointsBalance } }
        })

        await tx.pointsTransaction.create({
          data: {
            id: await generateSnowflakeId(),
            userId: managerUserId,
            amount: agent.agentPointsBalance,
            pointsBefore: 0,
            pointsAfter: 0,
            reason: `Agent deleted, points returned: ${agent.displayName}`,
            metadata: JSON.stringify({ agentUserId, agentName: agent.displayName })
          }
        })
      }

      await tx.user.update({
        where: { id: managerUserId },
        data: { agentCount: { decrement: 1 } }
      })

      // Soft delete agent user
      await tx.user.delete({ where: { id: agentUserId } })
    })

    agentRuntimeManager.clearRuntime(agentUserId)
    logger.info(`Agent deleted: ${agentUserId}`, undefined, 'AgentService')
  }

  async depositPoints(agentUserId: string, managerUserId: string, amount: number): Promise<User> {
    if (amount <= 0) throw new Error('Amount must be positive')
    const agent = await this.getAgent(agentUserId, managerUserId)
    if (!agent) throw new Error('Agent not found')

    const manager = await prisma.user.findUnique({ where: { id: managerUserId } })
    if (!manager) throw new Error('Manager not found')

    const totalPoints = manager.reputationPoints
    if (totalPoints < amount) {
      throw new Error(`Insufficient points. Have: ${totalPoints}, Need: ${amount}`)
    }

    const updatedAgent = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: agentUserId },
        data: {
          agentPointsBalance: { increment: amount },
          agentTotalDeposited: { increment: amount }
        }
      })

      await tx.user.update({
        where: { id: managerUserId },
        data: {
          reputationPoints: { decrement: amount }
        }
      })

      await tx.agentPointsTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          agentUserId,
          managerUserId,
          type: 'deposit',
          amount,
          balanceBefore: agent.agentPointsBalance,
          balanceAfter: agent.agentPointsBalance + amount,
          description: 'Points deposit'
        }
      })

      await tx.pointsTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          userId: managerUserId,
          amount: -amount,
          pointsBefore: totalPoints,
          pointsAfter: totalPoints - amount,
          reason: `Deposit to agent: ${agent.displayName}`,
          metadata: JSON.stringify({ agentUserId, agentName: agent.displayName })
        }
      })

      return updated
    })

    logger.info(`Deposited ${amount} points to agent ${agentUserId}`, undefined, 'AgentService')
    return updatedAgent
  }

  async withdrawPoints(agentUserId: string, managerUserId: string, amount: number): Promise<User> {
    if (amount <= 0) throw new Error('Amount must be positive')
    const agent = await this.getAgent(agentUserId, managerUserId)
    if (!agent) throw new Error('Agent not found')
    if (agent.agentPointsBalance < amount) {
      throw new Error(`Insufficient balance. Have: ${agent.agentPointsBalance}, Need: ${amount}`)
    }

    const updatedAgent = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: agentUserId },
        data: {
          agentPointsBalance: { decrement: amount },
          agentTotalWithdrawn: { increment: amount }
        }
      })

      await tx.user.update({
        where: { id: managerUserId },
        data: { reputationPoints: { increment: amount } }
      })

      await tx.agentPointsTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          agentUserId,
          managerUserId,
          type: 'withdraw',
          amount: -amount,
          balanceBefore: agent.agentPointsBalance,
          balanceAfter: agent.agentPointsBalance - amount,
          description: 'Points withdrawal'
        }
      })

      await tx.pointsTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          userId: managerUserId,
          amount,
          pointsBefore: 0,
          pointsAfter: 0,
          reason: `Withdrawal from agent: ${agent.displayName}`,
          metadata: JSON.stringify({ agentUserId, agentName: agent.displayName })
        }
      })

      return updated
    })

    logger.info(`Withdrew ${amount} points from agent ${agentUserId}`, undefined, 'AgentService')
    return updatedAgent
  }

  async deductPoints(agentUserId: string, amount: number, reason: string, relatedId?: string): Promise<number> {
    const agent = await prisma.user.findUnique({ where: { id: agentUserId } })
    if (!agent || !agent.isAgent) throw new Error('Agent not found')
    if (agent.agentPointsBalance < amount) {
      throw new Error(`Insufficient balance. Have: ${agent.agentPointsBalance}, Need: ${amount}`)
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: agentUserId },
        data: {
          agentPointsBalance: { decrement: amount },
          agentTotalPointsSpent: { increment: amount }
        }
      })

      // Create points transaction with proper relations
      await tx.agentPointsTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          type: reason.includes('chat') ? 'spend_chat' : reason.includes('post') ? 'spend_post' : 'spend_tick',
          amount: -amount,
          balanceBefore: agent.agentPointsBalance,
          balanceAfter: agent.agentPointsBalance - amount,
          description: reason,
          relatedId,
          agentUserId: agentUserId,
          managerUserId: agent.managedBy || agentUserId
        }
      })

      return result
    })

    return updated.agentPointsBalance
  }

  async getPerformance(agentUserId: string): Promise<AgentPerformance> {
    const agent = await prisma.user.findUnique({
      where: { id: agentUserId },
      include: { AgentTrade: { where: { pnl: { not: null } } } }
    })

    if (!agent || !agent.isAgent) throw new Error('Agent not found')

    const trades = agent.AgentTrade
    const avgTradeSize = trades.length > 0 
      ? trades.reduce((sum, t) => sum + t.amount, 0) / trades.length 
      : 0

    return {
      lifetimePnL: Number(agent.lifetimePnL),
      totalTrades: trades.length,
      profitableTrades: trades.filter(t => t.pnl && t.pnl > 0).length,
      winRate: trades.length > 0 ? trades.filter(t => t.pnl && t.pnl > 0).length / trades.length : 0,
      avgTradeSize
    }
  }

  async getChatHistory(agentUserId: string, limit = 50) {
    return prisma.agentMessage.findMany({
      where: { agentUserId },
      orderBy: { createdAt: 'desc' },
      take: limit
    })
  }

  async getLogs(agentUserId: string, filters?: { type?: string; level?: string; limit?: number }) {
    const where: { agentUserId: string; type?: string; level?: string } = { agentUserId }
    if (filters?.type) where.type = filters.type
    if (filters?.level) where.level = filters.level

    return prisma.agentLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100
    })
  }

  async createLog(agentUserId: string, log: {
    type: 'chat' | 'tick' | 'trade' | 'error' | 'system' | 'post' | 'comment' | 'dm'
    level: 'info' | 'warn' | 'error' | 'debug'
    message: string
    prompt?: string
    completion?: string
    thinking?: string
    metadata?: unknown
  }) {
    return prisma.agentLog.create({
      data: {
        id: await generateSnowflakeId(),
        agentUserId,
        type: log.type,
        level: log.level,
        message: log.message,
        prompt: log.prompt,
        completion: log.completion,
        thinking: log.thinking,
        metadata: log.metadata || undefined
      }
    })
  }
}

export const agentService = new AgentServiceV2()

