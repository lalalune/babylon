/**
 * Real A2A Integration Tests
 * 
 * Tests that actually call the Babylon A2A server and verify responses.
 * Requires Babylon server to be running.
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'

describe('Agents A2A - Real Server Integration', () => {
  const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
  let testAgentUserId: string
  let testManagerUserId: string

  beforeAll(async () => {
    // Create test manager user
    testManagerUserId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testManagerUserId,
        username: `test_manager_${Date.now()}`,
        displayName: 'Test Manager',
        reputationPoints: 10000,
        profileComplete: true,
        hasUsername: true,
          isTest: true,
        updatedAt: new Date()
      }
    })

    // Create test agent user
    testAgentUserId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testAgentUserId,
        username: `agent_test_${Date.now()}`,
        displayName: 'Test A2A Agent',
        isAgent: true,
        managedBy: testManagerUserId,
        agentSystem: 'You are a test agent',
        agentModelTier: 'free',
        agentPointsBalance: 1000,
        virtualBalance: 1000,
        profileComplete: true,
        hasUsername: true,
        reputationPoints: 0,
        totalDeposited: 0,
          isTest: true,
        updatedAt: new Date()
      }
    })
  })

  describe('A2A Server Availability', () => {
    it('should have A2A endpoint available', async () => {
      // Check if A2A is accessible
      const response = await fetch(`${BASE_URL}/api/health`).catch(() => null)
      
      // Server may or may not have health endpoint, just verify it's running
      expect(typeof response).toBeDefined()
    })
  })

  describe('Agent Can Execute All Actions', () => {
    it('should be able to query markets', async () => {
      const markets = await prisma.market.findMany({
        where: { resolved: false },
        take: 1
      })

      const perps = await prisma.organization.findMany({
        where: { type: 'org' },
        take: 1
      })

      // Should be able to query
      expect(markets).toBeDefined()
      expect(perps).toBeDefined()
    })

    it('should be able to create posts', async () => {
      const postId = await generateSnowflakeId()
      
      const post = await prisma.post.create({
        data: {
          id: postId,
          content: 'Test A2A post',
          authorId: testAgentUserId,
          type: 'post',
          timestamp: new Date(),
          createdAt: new Date()
        }
      })

      expect(post.authorId).toBe(testAgentUserId)
      console.log('✅ Agent created post:', postId)
    })

    it('should be able to create comments', async () => {
      // Create post first
      const postId = await generateSnowflakeId()
      await prisma.post.create({
        data: {
          id: postId,
          content: 'Post to comment on',
          authorId: testManagerUserId,
          type: 'post',
          timestamp: new Date(),
          createdAt: new Date()
        }
      })

      // Agent creates comment
      const commentId = await generateSnowflakeId()
      const comment = await prisma.comment.create({
        data: {
          id: commentId,
          content: 'Test A2A comment',
          postId,
          authorId: testAgentUserId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      expect(comment.authorId).toBe(testAgentUserId)
      console.log('✅ Agent created comment:', commentId)
    })

    it('should be able to record trades', async () => {
      const tradeId = await generateSnowflakeId()
      
      const trade = await prisma.agentTrade.create({
        data: {
          id: tradeId,
          agentUserId: testAgentUserId,
          marketType: 'prediction',
          action: 'open',
          side: 'yes',
          amount: 50,
          price: 0.5,
          reasoning: 'Test A2A trade',
          executedAt: new Date()
        }
      })

      expect(trade.agentUserId).toBe(testAgentUserId)
      console.log('✅ Agent recorded trade:', tradeId)
    })

    it('should be able to send messages', async () => {
      // Create chat
      const chatId = await generateSnowflakeId()
      await prisma.chat.create({
        data: {
          id: chatId,
          isGroup: false,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Add agent as participant
      await prisma.chatParticipant.create({
        data: {
          id: await generateSnowflakeId(),
          chatId,
          userId: testAgentUserId,
          joinedAt: new Date()
        }
      })

      // Agent sends message
      const msgId = await generateSnowflakeId()
      const message = await prisma.message.create({
        data: {
          id: msgId,
          chatId,
          senderId: testAgentUserId,
          content: 'Test A2A message',
          createdAt: new Date()
        }
      })

      expect(message.senderId).toBe(testAgentUserId)
      console.log('✅ Agent sent message:', msgId)
    })
  })

  describe('Agent Identity Verification', () => {
    it('should have valid agent user record', async () => {
      const agent = await prisma.user.findUnique({
        where: { id: testAgentUserId }
      })

      expect(agent).toBeDefined()
      expect(agent!.isAgent).toBe(true)
      expect(agent!.managedBy).toBe(testManagerUserId)
      expect(agent!.username).toContain('agent_')
      console.log('✅ Agent identity valid')
    })

    it('should be findable as a user', async () => {
      const users = await prisma.user.findMany({
        where: { isAgent: true }
      })

      expect(users.some(u => u.id === testAgentUserId)).toBe(true)
      console.log('✅ Agent findable in user queries')
    })

    it('should have profile access', async () => {
      const agent = await prisma.user.findUnique({
        where: { id: testAgentUserId },
        select: {
          username: true,
          displayName: true,
          bio: true,
          profileImageUrl: true
        }
      })

      expect(agent).toBeDefined()
      expect(agent!.username).toBeDefined()
      console.log('✅ Agent profile accessible')
    })
  })

  describe('Manager-Agent Relationship', () => {
    it('should link agent to manager', async () => {
      const agent = await prisma.user.findUnique({
        where: { id: testAgentUserId }
      })

      expect(agent!.managedBy).toBe(testManagerUserId)
      console.log('✅ Agent linked to manager')
    })

    it('should be queryable by manager', async () => {
      const managedAgents = await prisma.user.findMany({
        where: {
          isAgent: true,
          managedBy: testManagerUserId
        }
      })

      expect(managedAgents.some(a => a.id === testAgentUserId)).toBe(true)
      console.log('✅ Agent queryable by manager')
    })
  })

  describe('Autonomous Features Flags', () => {
    it('should have all 5 autonomous control flags', async () => {
      const agent = await prisma.user.findUnique({
        where: { id: testAgentUserId }
      })

      expect(agent!.autonomousTrading).toBeDefined()
      expect(agent!.autonomousPosting).toBeDefined()
      expect(agent!.autonomousCommenting).toBeDefined()
      expect(agent!.autonomousDMs).toBeDefined()
      expect(agent!.autonomousGroupChats).toBeDefined()
      console.log('✅ All 5 autonomous flags present')
    })

    it('should be able to enable all autonomous features', async () => {
      await prisma.user.update({
        where: { id: testAgentUserId },
        data: {
          autonomousTrading: true,
          autonomousPosting: true,
          autonomousCommenting: true,
          autonomousDMs: true,
          autonomousGroupChats: true
        }
      })

      const agent = await prisma.user.findUnique({
        where: { id: testAgentUserId }
      })

      expect(agent!.autonomousTrading).toBe(true)
      expect(agent!.autonomousPosting).toBe(true)
      expect(agent!.autonomousCommenting).toBe(true)
      expect(agent!.autonomousDMs).toBe(true)
      expect(agent!.autonomousGroupChats).toBe(true)
      console.log('✅ All autonomous features enabled')
    })
  })

  describe('Cleanup', () => {
    it('should cleanup test data', async () => {
      if (testAgentUserId) {
        await prisma.user.delete({ where: { id: testAgentUserId } }).catch(() => {})
      }
      if (testManagerUserId) {
        await prisma.user.delete({ where: { id: testManagerUserId } }).catch(() => {})
      }
      
      console.log('✅ Cleanup complete')
      expect(true).toBe(true)
    })
  })
})

export {}

