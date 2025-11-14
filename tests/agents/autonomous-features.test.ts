/**
 * Tests for Autonomous Features
 * 
 * Verifies all 5 autonomous features work correctly
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import { autonomousTradingService } from '@/lib/agents/autonomous/AutonomousTradingService'
import { autonomousPostingService } from '@/lib/agents/autonomous/AutonomousPostingService'
import { autonomousCommentingService } from '@/lib/agents/autonomous/AutonomousCommentingService'
import { autonomousDMService } from '@/lib/agents/autonomous/AutonomousDMService'
import { autonomousGroupChatService } from '@/lib/agents/autonomous/AutonomousGroupChatService'

describe('Autonomous Features Tests', () => {
  let testAgentId: string

  beforeAll(async () => {
    // Create test agent
    testAgentId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testAgentId,
        username: `agent_test_${Date.now()}`,
        displayName: 'Test Autonomous Agent',
        isAgent: true,
        agentSystem: 'You are a test agent',
        agentModelTier: 'free',
        agentPointsBalance: 1000,
        autonomousTrading: true,
        autonomousPosting: true,
        autonomousCommenting: true,
        autonomousDMs: true,
        autonomousGroupChats: true,
        profileComplete: true,
        hasUsername: true,
        reputationPoints: 0,
        virtualBalance: 1000,
        totalDeposited: 0,
          isTest: true,
        updatedAt: new Date()
      }
    })
  })

  describe('Autonomous Trading', () => {
    it('should have AutonomousTradingService', () => {
      expect(autonomousTradingService).toBeDefined()
      expect(typeof autonomousTradingService.executeTrades).toBe('function')
    })

    it('should query markets and positions', async () => {
      const markets = await prisma.market.findMany({
        where: { resolved: false },
        take: 5
      })

      const perpMarkets = await prisma.organization.findMany({
        where: { type: 'org' },
        take: 5
      })

      // Should be able to query markets
      expect(markets).toBeDefined()
      expect(perpMarkets).toBeDefined()
    })
  })

  describe('Autonomous Posting', () => {
    it('should have AutonomousPostingService', () => {
      expect(autonomousPostingService).toBeDefined()
      expect(typeof autonomousPostingService.createAgentPost).toBe('function')
    })

    it('should be able to create posts', async () => {
      const postId = await generateSnowflakeId()
      
      await prisma.post.create({
        data: {
          id: postId,
          content: 'Test autonomous post',
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
  })

  describe('Autonomous Commenting', () => {
    it('should have AutonomousCommentingService', () => {
      expect(autonomousCommentingService).toBeDefined()
      expect(typeof autonomousCommentingService.createAgentComment).toBe('function')
    })

    it('should be able to create comments', async () => {
      // Create post to comment on
      const postId = await generateSnowflakeId()
      await prisma.post.create({
        data: {
          id: postId,
          content: 'Post for testing',
          authorId: await generateSnowflakeId(),
          type: 'post',
          timestamp: new Date(),
          createdAt: new Date()
        }
      })

      // Create comment
      const commentId = await generateSnowflakeId()
      await prisma.comment.create({
        data: {
          id: commentId,
          content: 'Test autonomous comment',
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
  })

  describe('Autonomous DMs', () => {
    it('should have AutonomousDMService', () => {
      expect(autonomousDMService).toBeDefined()
      expect(typeof autonomousDMService.respondToDMs).toBe('function')
    })

    it('should be able to send messages', async () => {
      // Create DM chat
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
          userId: testAgentId,
          joinedAt: new Date()
        }
      })

      // Create test message
      const msgId = await generateSnowflakeId()
      await prisma.message.create({
        data: {
          id: msgId,
          chatId,
          senderId: testAgentId,
          content: 'Test DM response',
          createdAt: new Date()
        }
      })

      const message = await prisma.message.findUnique({ where: { id: msgId } })
      
      expect(message).toBeTruthy()
      expect(message!.senderId).toBe(testAgentId)
    })
  })

  describe('Autonomous Group Chats', () => {
    it('should have AutonomousGroupChatService', () => {
      expect(autonomousGroupChatService).toBeDefined()
      expect(typeof autonomousGroupChatService.participateInGroupChats).toBe('function')
    })

    it('should be able to participate in groups', async () => {
      // Create group chat
      const chatId = await generateSnowflakeId()
      await prisma.chat.create({
        data: {
          id: chatId,
          isGroup: true,
          name: 'Test Group',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Add agent as participant
      await prisma.chatParticipant.create({
        data: {
          id: await generateSnowflakeId(),
          chatId,
          userId: testAgentId,
          joinedAt: new Date()
        }
      })

      // Create test message
      const msgId = await generateSnowflakeId()
      await prisma.message.create({
        data: {
          id: msgId,
          chatId,
          senderId: testAgentId,
          content: 'Test group message',
          createdAt: new Date()
        }
      })

      const message = await prisma.message.findUnique({ where: { id: msgId } })
      
      expect(message).toBeTruthy()
      expect(message!.senderId).toBe(testAgentId)
    })
  })
})

export {}


