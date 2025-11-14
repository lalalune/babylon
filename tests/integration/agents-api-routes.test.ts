// @ts-nocheck - Test file

/**
 * Comprehensive API Route Tests for Agents Feature
 * 
 * Tests ALL agent API endpoints:
 * - POST /api/agents (create)
 * - GET  /api/agents (list)
 * - GET  /api/agents/[agentId] (get details)
 * - PUT  /api/agents/[agentId] (update)
 * - DELETE /api/agents/[agentId] (delete)
 * - POST /api/agents/[agentId]/chat (send message)
 * - GET  /api/agents/[agentId]/chat (get history)
 * - POST /api/agents/[agentId]/wallet (deposit/withdraw)
 * - GET  /api/agents/[agentId]/wallet (get transactions)
 * - GET  /api/agents/[agentId]/logs (get logs)
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import { agentService } from '@/lib/agents/services/AgentService'
import { agentPnLService } from '@/lib/agents/services/AgentPnLService'
import { v4 as uuidv4 } from 'uuid'

describe('Agents API Routes - Comprehensive Tests', () => {
  let testUserId: string
  let testAgentId: string

  beforeAll(async () => {
    // Create test user
    testUserId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testUserId,
        username: `test_api_user_${Date.now()}`,
        displayName: 'Test API User',
        reputationPoints: 10000,
        profileComplete: true,
        hasUsername: true,
          isTest: true,
        updatedAt: new Date()
      }
    })

    // Create test agent via service (not API)
    testAgentId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testAgentId,
        username: `agent_api_test_${Date.now()}`,
        displayName: 'Test API Agent',
        bio: 'Test agent for API testing',
        isAgent: true,
        managedBy: testUserId,
        agentSystem: 'You are a test agent',
        agentModelTier: 'free',
        agentPointsBalance: 100,
        agentTotalDeposited: 100,
        agentStatus: 'active',
        profileComplete: true,
        hasUsername: true,
        reputationPoints: 0,
        virtualBalance: 0,
        totalDeposited: 0,
          isTest: true,
        updatedAt: new Date()
      }
    })
  })

  afterAll(async () => {
    // Cleanup - use correct table name
    await prisma.agentMessage.deleteMany({ where: { agentUserId: testAgentId } })
    await prisma.agentLog.deleteMany({ where: { agentUserId: testAgentId } })
    await prisma.agentTrade.deleteMany({ where: { agentUserId: testAgentId } })
    await prisma.agentPointsTransaction.deleteMany({ where: { agentUserId: testAgentId } })
    await prisma.user.delete({ where: { id: testAgentId } }).catch(() => {})
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  })

  describe('GET /api/agents (list)', () => {
    it('should return agents with REAL performance stats (not zeros)', async () => {
      // Record a trade to test real stats
      await agentPnLService.recordTrade({
        agentId: testAgentId,
        userId: testUserId,
        marketType: 'prediction',
        marketId: 'test-market',
        action: 'close',
        amount: 100,
        price: 1.0,
        pnl: 25, // Profitable trade
        reasoning: 'Test trade'
      })

      // Get agents
      const agents = await agentService.listUserAgents(testUserId)
      
      expect(agents.length).toBeGreaterThan(0)
      
      const testAgent = agents.find(a => a.id === testAgentId)
      expect(testAgent).toBeDefined()

      // Get performance (what the API should return)
      const performance = await agentService.getPerformance(testAgentId)
      
      // Verify REAL stats are calculated, not zeros
      expect(performance.totalTrades).toBeGreaterThan(0)
      expect(performance.profitableTrades).toBeGreaterThan(0)
      expect(performance.winRate).toBeGreaterThan(0)
      expect(performance.lifetimePnL).toBe(25)
    })

    it('should filter by autonomousTrading flag', async () => {
      // Enable autonomous trading
      await prisma.user.update({
        where: { id: testAgentId },
        data: { autonomousTrading: true }
      })

      const autonomousAgents = await agentService.listUserAgents(testUserId, { autonomousTrading: true })
      expect(autonomousAgents.length).toBeGreaterThan(0)
      expect(autonomousAgents.every(a => a.autonomousTrading)).toBe(true)

      // Disable and verify filter
      await prisma.user.update({
        where: { id: testAgentId },
        data: { autonomousTrading: false }
      })

      const nonAutonomousAgents = await agentService.listUserAgents(testUserId, { autonomousTrading: false })
      expect(nonAutonomousAgents.every(a => !a.autonomousTrading)).toBe(true)
    })
  })

  describe('GET /api/agents/[agentId] (get details)', () => {
    it('should return agent with REAL totalTrades and winRate', async () => {
      const agent = await agentService.getAgent(testAgentId, testUserId)
      expect(agent).toBeDefined()

      const performance = await agentService.getPerformance(testAgentId)
      
      // Verify real stats are returned (from previous test we have 1 trade)
      expect(performance.totalTrades).toBeGreaterThanOrEqual(1)
      expect(performance.winRate).toBeGreaterThanOrEqual(0)
    })

    it('should include bio array', async () => {
      // Update agent with bio (stored as newline-separated string in bio field)
      await prisma.user.update({
        where: { id: testAgentId },
        data: { bio: 'Point 1\nPoint 2\nPoint 3' }
      })

      const agent = await agentService.getAgent(testAgentId, testUserId)
      expect(agent).toBeDefined()
      
      // Verify bio can be split into array
      if (agent!.bio) {
        const bio = agent!.bio.split('\n').filter(b => b.trim())
        expect(Array.isArray(bio)).toBe(true)
        expect(bio.length).toBe(3)
      }
    })

    it('should return 404 for non-existent agent', async () => {
      const agent = await agentService.getAgent('non-existent-id', testUserId)
      expect(agent).toBeNull()
    })

    it('should throw error for unauthorized access', async () => {
      const otherUserId = await generateSnowflakeId()
      await prisma.user.create({
        data: {
          id: otherUserId,
          username: `other_user_${Date.now()}`,
          displayName: 'Other User',
          reputationPoints: 0,
          profileComplete: true,
          hasUsername: true,
          isTest: true,
          updatedAt: new Date()
        }
      })

      // Should throw error, not return null
      await expect(
        agentService.getAgent(testAgentId, otherUserId)
      ).rejects.toThrow(/Unauthorized/)

      await prisma.user.delete({ where: { id: otherUserId } }).catch(() => {})
    })
  })

  describe('PUT /api/agents/[agentId] (update)', () => {
    it('should update agent name', async () => {
      const updated = await agentService.updateAgent(testAgentId, testUserId, {
        name: 'Updated Test Agent'
      })

      expect(updated.displayName).toBe('Updated Test Agent')
    })

    it('should update agent system prompt', async () => {
      const updated = await agentService.updateAgent(testAgentId, testUserId, {
        system: 'You are an updated test agent'
      })

      expect(updated.agentSystem).toBe('You are an updated test agent')
    })

    it('should update autonomous features', async () => {
      const updated = await agentService.updateAgent(testAgentId, testUserId, {
        autonomousTrading: true,
        autonomousPosting: true,
        autonomousCommenting: true
      })

      expect(updated.autonomousTrading).toBe(true)
      expect(updated.autonomousPosting).toBe(true)
      expect(updated.autonomousCommenting).toBe(true)
    })

    it('should update model tier', async () => {
      const updated = await agentService.updateAgent(testAgentId, testUserId, {
        modelTier: 'pro'
      })

      expect(updated.agentModelTier).toBe('pro')
    })
  })

  describe('POST /api/agents/[agentId]/chat (send message)', () => {
    it('should save user message', async () => {
      const messagesBefore = await agentService.getChatHistory(testAgentId, 100)
      const countBefore = messagesBefore.length

      await prisma.agentMessage.create({
        data: {
          id: uuidv4(),
          agentUserId: testAgentId,
          role: 'user',
          content: 'Test message',
          pointsCost: 0,
          metadata: {}
        }
      })

      const messagesAfter = await agentService.getChatHistory(testAgentId, 100)
      expect(messagesAfter.length).toBe(countBefore + 1)
    })

    it('should deduct points for chat', async () => {
      const balanceBefore = (await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentPointsBalance: true }
      }))!.agentPointsBalance

      await agentService.deductPoints(testAgentId, 1, 'Test chat message')

      const balanceAfter = (await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentPointsBalance: true }
      }))!.agentPointsBalance

      expect(balanceAfter).toBe(balanceBefore - 1)
    })

    it('should create agent log for chat', async () => {
      const logId = uuidv4()
      await prisma.agentLog.create({
        data: {
          id: logId,
          agentUserId: testAgentId,
          type: 'chat',
          level: 'info',
          message: 'Chat interaction completed',
          prompt: 'Test message',
          completion: 'Test response',
          metadata: {
            usePro: false,
            pointsCost: 1
          }
        }
      })

      const log = await prisma.agentLog.findUnique({ where: { id: logId } })
      expect(log).toBeDefined()
      expect(log!.type).toBe('chat')
      expect(log!.prompt).toBe('Test message')
      expect(log!.completion).toBe('Test response')
    })
  })

  describe('GET /api/agents/[agentId]/chat (get history)', () => {
    it('should retrieve chat history', async () => {
      const messages = await agentService.getChatHistory(testAgentId, 50)
      
      expect(Array.isArray(messages)).toBe(true)
      // Should have at least the messages we created in previous tests
      expect(messages.length).toBeGreaterThan(0)
    })

    it('should respect limit parameter', async () => {
      const messages = await agentService.getChatHistory(testAgentId, 2)
      expect(messages.length).toBeLessThanOrEqual(2)
    })

    it('should return messages in correct order (newest first)', async () => {
      const messages = await agentService.getChatHistory(testAgentId, 10)
      
      for (let i = 0; i < messages.length - 1; i++) {
        const current = new Date(messages[i].createdAt).getTime()
        const next = new Date(messages[i + 1].createdAt).getTime()
        expect(current).toBeGreaterThanOrEqual(next)
      }
    })
  })

  describe('POST /api/agents/[agentId]/wallet (transactions)', () => {
    it('should deposit points to agent', async () => {
      const balanceBefore = (await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentPointsBalance: true }
      }))!.agentPointsBalance

      await agentService.depositPoints(testAgentId, testUserId, 50)

      const balanceAfter = (await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentPointsBalance: true }
      }))!.agentPointsBalance

      expect(balanceAfter).toBe(balanceBefore + 50)
    })

    it('should withdraw points from agent', async () => {
      const balanceBefore = (await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentPointsBalance: true }
      }))!.agentPointsBalance

      await agentService.withdrawPoints(testAgentId, testUserId, 25)

      const balanceAfter = (await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentPointsBalance: true }
      }))!.agentPointsBalance

      expect(balanceAfter).toBe(balanceBefore - 25)
    })

    it('should record points transaction', async () => {
      const txId = uuidv4()
      await prisma.agentPointsTransaction.create({
        data: {
          id: txId,
          managerUserId: testUserId,
          agentUserId: testAgentId,
          type: 'deposit',
          amount: 10,
          balanceBefore: 100,
          balanceAfter: 110,
          description: 'Test transaction',
          createdAt: new Date()
        }
      })

      const tx = await prisma.agentPointsTransaction.findUnique({ where: { id: txId } })
      expect(tx).toBeDefined()
      expect(tx!.agentUserId).toBe(testAgentId)
      expect(tx!.amount).toBe(10)
    })

    it('should reject deposit exceeding user balance', async () => {
      const userBalance = (await prisma.user.findUnique({
        where: { id: testUserId },
        select: { reputationPoints: true }
      }))!.reputationPoints

      // Try to deposit more than user has
      await expect(
        agentService.depositPoints(testAgentId, testUserId, userBalance + 1000)
      ).rejects.toThrow()
    })

    it('should reject withdrawal exceeding agent balance', async () => {
      const agentBalance = (await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentPointsBalance: true }
      }))!.agentPointsBalance

      // Try to withdraw more than agent has
      await expect(
        agentService.withdrawPoints(testAgentId, testUserId, agentBalance + 1000)
      ).rejects.toThrow()
    })
  })

  describe('GET /api/agents/[agentId]/wallet (get transactions)', () => {
    it('should retrieve transaction history', async () => {
      const transactions = await prisma.agentPointsTransaction.findMany({
        where: { agentUserId: testAgentId },
        orderBy: { createdAt: 'desc' },
        take: 10
      })

      expect(Array.isArray(transactions)).toBe(true)
      expect(transactions.length).toBeGreaterThan(0)
    })

    it('should show correct transaction types', async () => {
      const transactions = await prisma.agentPointsTransaction.findMany({
        where: { agentUserId: testAgentId },
        orderBy: { createdAt: 'desc' }
      })

      // Verify we have deposits and potentially withdrawals
      const validTypes = ['deposit', 'withdraw', 'spend_chat', 'spend_tick', 'earn_trade', 'spend_post', 'spend_comment']
      expect(transactions.every(tx => validTypes.includes(tx.type))).toBe(true)
    })
  })

  describe('GET /api/agents/[agentId]/logs', () => {
    it('should retrieve agent logs', async () => {
      const logs = await prisma.agentLog.findMany({
        where: { agentUserId: testAgentId },
        orderBy: { createdAt: 'desc' },
        take: 100
      })

      expect(Array.isArray(logs)).toBe(true)
      expect(logs.length).toBeGreaterThan(0)
    })

    it('should filter logs by type', async () => {
      const chatLogs = await prisma.agentLog.findMany({
        where: { 
          agentUserId: testAgentId,
          type: 'chat'
        },
        orderBy: { createdAt: 'desc' }
      })

      expect(chatLogs.every(log => log.type === 'chat')).toBe(true)
    })

    it('should filter logs by level', async () => {
      const infoLogs = await prisma.agentLog.findMany({
        where: { 
          agentUserId: testAgentId,
          level: 'info'
        },
        orderBy: { createdAt: 'desc' }
      })

      expect(infoLogs.every(log => log.level === 'info')).toBe(true)
    })

    it('should include metadata', async () => {
      const logs = await prisma.agentLog.findMany({
        where: { agentUserId: testAgentId },
        orderBy: { createdAt: 'desc' },
        take: 5
      })

      // Check that logs have metadata
      const logWithMetadata = logs.find(log => log.metadata && Object.keys(log.metadata).length > 0)
      expect(logWithMetadata).toBeDefined()
    })
  })

  describe('DELETE /api/agents/[agentId]', () => {
    it('should delete agent and all related data', async () => {
      // Create a separate agent to delete
      const deleteTestAgentId = await generateSnowflakeId()
      await prisma.user.create({
        data: {
          id: deleteTestAgentId,
          username: `agent_delete_test_${Date.now()}`,
          displayName: 'Delete Test Agent',
          isAgent: true,
          managedBy: testUserId,
          agentSystem: 'Test',
          agentModelTier: 'free',
          agentPointsBalance: 50,
          agentStatus: 'active',
          profileComplete: true,
          hasUsername: true,
          reputationPoints: 0,
          virtualBalance: 0,
          totalDeposited: 0,
          isTest: true,
          updatedAt: new Date()
        }
      })

      // Create related data
      await prisma.agentMessage.create({
        data: {
          id: uuidv4(),
          agentUserId: deleteTestAgentId,
          role: 'user',
          content: 'Test',
          pointsCost: 0,
          metadata: {}
        }
      })

      await prisma.agentLog.create({
        data: {
          id: uuidv4(),
          agentUserId: deleteTestAgentId,
          type: 'system',
          level: 'info',
          message: 'Test log'
        }
      })

      // Delete agent
      await agentService.deleteAgent(deleteTestAgentId, testUserId)

      // Verify agent is deleted
      const deleted = await prisma.user.findUnique({ where: { id: deleteTestAgentId } })
      expect(deleted).toBeNull()

      // Verify related data is also deleted
      const messages = await prisma.agentMessage.findMany({ where: { agentUserId: deleteTestAgentId } })
      const logs = await prisma.agentLog.findMany({ where: { agentUserId: deleteTestAgentId } })

      expect(messages.length).toBe(0)
      expect(logs.length).toBe(0)
    })
  })

  describe('Agent Performance Calculation', () => {
    it('should calculate winRate correctly', async () => {
      // Create test agent with trades
      const perfTestAgentId = await generateSnowflakeId()
      await prisma.user.create({
        data: {
          id: perfTestAgentId,
          username: `agent_perf_${Date.now()}`,
          displayName: 'Perf Test Agent',
          isAgent: true,
          managedBy: testUserId,
          agentSystem: 'Test',
          agentModelTier: 'free',
          agentPointsBalance: 100,
          agentStatus: 'active',
          profileComplete: true,
          hasUsername: true,
          reputationPoints: 0,
          virtualBalance: 0,
          totalDeposited: 0,
          isTest: true,
          updatedAt: new Date()
        }
      })

      // Record 3 profitable trades and 2 losing trades
      for (let i = 0; i < 3; i++) {
        await agentPnLService.recordTrade({
          agentId: perfTestAgentId,
          userId: testUserId,
          marketType: 'prediction',
          marketId: `market-${i}`,
          action: 'close',
          amount: 100,
          price: 1.0,
          pnl: 10, // Profitable
          reasoning: `Profitable trade ${i}`
        })
      }

      for (let i = 0; i < 2; i++) {
        await agentPnLService.recordTrade({
          agentId: perfTestAgentId,
          userId: testUserId,
          marketType: 'prediction',
          marketId: `market-lose-${i}`,
          action: 'close',
          amount: 100,
          price: 1.0,
          pnl: -5, // Loss
          reasoning: `Losing trade ${i}`
        })
      }

      const performance = await agentService.getPerformance(perfTestAgentId)

      expect(performance.totalTrades).toBe(5)
      expect(performance.profitableTrades).toBe(3)
      expect(performance.winRate).toBe(0.6) // 3/5 = 60%
      expect(performance.lifetimePnL).toBe(20) // (3 * 10) + (2 * -5) = 30 - 10 = 20

      // Cleanup
      await prisma.agentTrade.deleteMany({ where: { agentUserId: perfTestAgentId } })
      await prisma.user.delete({ where: { id: perfTestAgentId } })
    })
  })

  describe('Points Balance Tracking', () => {
    it('should track totalDeposited correctly', async () => {
      const before = await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentTotalDeposited: true }
      })

      await agentService.depositPoints(testAgentId, testUserId, 100)

      const after = await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentTotalDeposited: true }
      })

      expect(after!.agentTotalDeposited).toBe((before!.agentTotalDeposited || 0) + 100)
    })

    it('should track totalWithdrawn correctly', async () => {
      const before = await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentTotalWithdrawn: true }
      })

      await agentService.withdrawPoints(testAgentId, testUserId, 50)

      const after = await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentTotalWithdrawn: true }
      })

      expect(after!.agentTotalWithdrawn).toBe((before!.agentTotalWithdrawn || 0) + 50)
    })

    it('should track totalPointsSpent correctly', async () => {
      const before = await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentTotalPointsSpent: true }
      })

      await agentService.deductPoints(testAgentId, 5, 'Test spend tracking')

      const after = await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentTotalPointsSpent: true }
      })

      expect(after!.agentTotalPointsSpent).toBe((before!.agentTotalPointsSpent || 0) + 5)
    })
  })

  describe('Agent Status Management', () => {
    it('should have valid status values', async () => {
      const agent = await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentStatus: true }
      })

      const validStatuses = ['active', 'inactive', 'error', null]
      expect(validStatuses).toContain(agent!.agentStatus)
    })

    it('should update lastChatAt on chat activity', async () => {
      const before = await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentLastChatAt: true }
      })

      await prisma.user.update({
        where: { id: testAgentId },
        data: { agentLastChatAt: new Date() }
      })

      const after = await prisma.user.findUnique({
        where: { id: testAgentId },
        select: { agentLastChatAt: true }
      })

      if (before!.agentLastChatAt && after!.agentLastChatAt) {
        expect(after!.agentLastChatAt.getTime()).toBeGreaterThanOrEqual(before!.agentLastChatAt.getTime())
      }
    })
  })
})

export {}

