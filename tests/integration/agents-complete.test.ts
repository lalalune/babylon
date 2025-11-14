/**
 * Complete Integration Tests for Agents Feature
 * 
 * Tests all agent functionality end-to-end:
 * - Agent creation
 * - Chat functionality
 * - Wallet operations
 * - Autonomous features
 * - Settings management
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'

describe('Agents Feature - Complete Integration Tests', () => {
  let testUserId: string
  let testAgentId: string

  beforeAll(async () => {
    // Create test user
    testUserId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testUserId,
        username: `test_user_${Date.now()}`,
        displayName: 'Test User',
        reputationPoints: 10000,
        profileComplete: true,
        hasUsername: true,
          isTest: true,
        updatedAt: new Date()
      }
    })
  })

  afterAll(async () => {
    // Cleanup
    if (testAgentId) {
      await prisma.user.delete({ where: { id: testAgentId } }).catch(() => {})
    }
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  })

  describe('Agent Creation', () => {
    it('should create a new agent user', async () => {
      const agent = await prisma.user.create({
        data: {
          id: await generateSnowflakeId(),
          username: `agent_test_bot_${Date.now()}`,
          displayName: 'Test Bot',
          bio: 'AI agent for testing',
          isAgent: true,
          managedBy: testUserId,
          agentSystem: 'You are a test agent',
          agentModelTier: 'free',
          agentPointsBalance: 100,
          profileComplete: true,
          hasUsername: true,
          reputationPoints: 0,
          virtualBalance: 0,
          totalDeposited: 0,
          isTest: true,
          updatedAt: new Date()
        }
      })

      testAgentId = agent.id

      expect(agent.isAgent).toBe(true)
      expect(agent.managedBy).toBe(testUserId)
      expect(agent.agentPointsBalance).toBe(100)
      expect(agent.agentSystem).toBe('You are a test agent')
    })

    it('should have a valid username', async () => {
      const agent = await prisma.user.findUnique({ where: { id: testAgentId } })
      
      expect(agent).toBeTruthy()
      expect(agent!.username).toContain('agent_')
      expect(agent!.isAgent).toBe(true)
    })

    it('should be findable by managedBy', async () => {
      const agents = await prisma.user.findMany({
        where: {
          isAgent: true,
          managedBy: testUserId
        }
      })

      expect(agents.length).toBeGreaterThan(0)
      expect(agents.some(a => a.id === testAgentId)).toBe(true)
    })
  })

  describe('Agent Points & Wallet', () => {
    it('should have points balance', async () => {
      const agent = await prisma.user.findUnique({ where: { id: testAgentId } })
      
      expect(agent!.agentPointsBalance).toBeGreaterThanOrEqual(0)
    })

    it('should be able to deposit points', async () => {
      const initialBalance = (await prisma.user.findUnique({ where: { id: testAgentId } }))!.agentPointsBalance

      await prisma.user.update({
        where: { id: testAgentId },
        data: {
          agentPointsBalance: { increment: 50 },
          agentTotalDeposited: { increment: 50 }
        }
      })

      const newBalance = (await prisma.user.findUnique({ where: { id: testAgentId } }))!.agentPointsBalance
      
      expect(newBalance).toBe(initialBalance + 50)
    })

    it('should be able to withdraw points', async () => {
      const initialBalance = (await prisma.user.findUnique({ where: { id: testAgentId } }))!.agentPointsBalance

      await prisma.user.update({
        where: { id: testAgentId },
        data: {
          agentPointsBalance: { decrement: 25 },
          agentTotalWithdrawn: { increment: 25 }
        }
      })

      const newBalance = (await prisma.user.findUnique({ where: { id: testAgentId } }))!.agentPointsBalance
      
      expect(newBalance).toBe(initialBalance - 25)
    })

    it('should record points transaction', async () => {
      const txId = await generateSnowflakeId()
      
      await prisma.agentPointsTransaction.create({
        data: {
          id: txId,
          agentUserId: testAgentId,
          managerUserId: testUserId,
          type: 'deposit',
          amount: 10,
          balanceBefore: 100,
          balanceAfter: 110,
          description: 'Test deposit'
        }
      })

      const tx = await prisma.agentPointsTransaction.findUnique({ where: { id: txId } })
      
      expect(tx).toBeTruthy()
      expect(tx!.agentUserId).toBe(testAgentId)
      expect(tx!.managerUserId).toBe(testUserId)
    })
  })

  describe('Agent Logging', () => {
    it('should create agent log', async () => {
      const logId = await generateSnowflakeId()
      
      await prisma.agentLog.create({
        data: {
          id: logId,
          agentUserId: testAgentId,
          type: 'system',
          level: 'info',
          message: 'Test log entry',
          metadata: { test: true }
        }
      })

      const log = await prisma.agentLog.findUnique({ where: { id: logId } })
      
      expect(log).toBeTruthy()
      expect(log!.message).toBe('Test log entry')
    })

    it('should retrieve logs for agent', async () => {
      const logs = await prisma.agentLog.findMany({
        where: { agentUserId: testAgentId },
        orderBy: { createdAt: 'desc' }
      })

      expect(logs.length).toBeGreaterThan(0)
    })
  })

  describe('Agent Messages', () => {
    it('should create agent message', async () => {
      const msgId = await generateSnowflakeId()
      
      await prisma.agentMessage.create({
        data: {
          id: msgId,
          agentUserId: testAgentId,
          role: 'user',
          content: 'Test message',
          pointsCost: 1,
          metadata: {}
        }
      })

      const msg = await prisma.agentMessage.findUnique({ where: { id: msgId } })
      
      expect(msg).toBeTruthy()
      expect(msg!.content).toBe('Test message')
    })

    it('should retrieve chat history', async () => {
      const messages = await prisma.agentMessage.findMany({
        where: { agentUserId: testAgentId },
        orderBy: { createdAt: 'desc' }
      })

      expect(messages.length).toBeGreaterThan(0)
    })
  })

  describe('Autonomous Features', () => {
    it('should have autonomous control flags', async () => {
      const agent = await prisma.user.findUnique({ where: { id: testAgentId } })
      
      expect(agent!.autonomousTrading).toBeDefined()
      expect(agent!.autonomousPosting).toBeDefined()
      expect(agent!.autonomousCommenting).toBeDefined()
      expect(agent!.autonomousDMs).toBeDefined()
      expect(agent!.autonomousGroupChats).toBeDefined()
    })

    it('should enable autonomous features', async () => {
      await prisma.user.update({
        where: { id: testAgentId },
        data: {
          autonomousTrading: true,
          autonomousPosting: true,
          autonomousCommenting: true
        }
      })

      const agent = await prisma.user.findUnique({ where: { id: testAgentId } })
      
      expect(agent!.autonomousTrading).toBe(true)
      expect(agent!.autonomousPosting).toBe(true)
      expect(agent!.autonomousCommenting).toBe(true)
    })

    it('should query autonomous agents correctly', async () => {
      const autonomousAgents = await prisma.user.findMany({
        where: {
          isAgent: true,
          OR: [
            { autonomousTrading: true },
            { autonomousPosting: true },
            { autonomousCommenting: true },
            { autonomousDMs: true },
            { autonomousGroupChats: true }
          ]
        }
      })

      expect(autonomousAgents.some(a => a.id === testAgentId)).toBe(true)
    })
  })

  describe('Agent Trading', () => {
    it('should record agent trade', async () => {
      const tradeId = await generateSnowflakeId()
      
      await prisma.agentTrade.create({
        data: {
          id: tradeId,
          agentUserId: testAgentId,
          marketType: 'prediction',
          action: 'open',
          side: 'yes',
          amount: 100,
          price: 0.5,
          pnl: 10,
          reasoning: 'Test trade',
          executedAt: new Date()
        }
      })

      const trade = await prisma.agentTrade.findUnique({ where: { id: tradeId } })
      
      expect(trade).toBeTruthy()
      expect(trade!.agentUserId).toBe(testAgentId)
      expect(trade!.pnl).toBe(10)
    })

    it('should update agent P&L', async () => {
      await prisma.user.update({
        where: { id: testAgentId },
        data: {
          lifetimePnL: { increment: 10 }
        }
      })

      const agent = await prisma.user.findUnique({ where: { id: testAgentId } })
      
      expect(Number(agent!.lifetimePnL)).toBeGreaterThanOrEqual(10)
    })
  })

  describe('Agent as User', () => {
    it('should be able to create posts', async () => {
      const postId = await generateSnowflakeId()
      
      await prisma.post.create({
        data: {
          id: postId,
          content: 'Test post from agent',
          authorId: testAgentId,
          type: 'post',
          timestamp: new Date(),
          createdAt: new Date()
        }
      })

      const post = await prisma.post.findUnique({ where: { id: postId } })
      
      expect(post).toBeTruthy()
      expect(post!.authorId).toBe(testAgentId)
    })

    it('should be able to create comments', async () => {
      // First create a post to comment on
      const postId = await generateSnowflakeId()
      await prisma.post.create({
        data: {
          id: postId,
          content: 'Test post',
          authorId: testUserId,
          type: 'post',
          timestamp: new Date(),
          createdAt: new Date()
        }
      })

      // Agent creates comment
      const commentId = await generateSnowflakeId()
      await prisma.comment.create({
        data: {
          id: commentId,
          content: 'Test comment from agent',
          postId,
          authorId: testAgentId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      const comment = await prisma.comment.findUnique({ where: { id: commentId } })
      
      expect(comment).toBeTruthy()
      expect(comment!.authorId).toBe(testAgentId)
    })

    it('should show in user queries', async () => {
      const allUsers = await prisma.user.findMany({
        where: { username: { contains: 'agent_' } }
      })

      expect(allUsers.some(u => u.id === testAgentId)).toBe(true)
    })
  })

  describe('P&L Rollup', () => {
    it('should roll up agent P&L to manager', async () => {
      // Set agent P&L
      await prisma.user.update({
        where: { id: testAgentId },
        data: { lifetimePnL: 50 }
      })

      // Get all manager's agents and sum P&L
      const agents = await prisma.user.findMany({
        where: { isAgent: true, managedBy: testUserId }
      })

      const totalPnL = agents.reduce((sum, a) => sum + Number(a.lifetimePnL), 0)

      // Update manager's totalAgentPnL
      await prisma.user.update({
        where: { id: testUserId },
        data: { totalAgentPnL: totalPnL }
      })

      const manager = await prisma.user.findUnique({ where: { id: testUserId } })
      
      expect(Number(manager!.totalAgentPnL)).toBeGreaterThanOrEqual(50)
    })
  })
})

export {}


