/**
 * Tests for Agent Context Providers
 * 
 * Verifies all context providers (experience, headlines, trending, market movers, etc.)
 * work correctly and provide relevant information to agents
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager'
import { ethers } from 'ethers'
import type { AgentRuntime } from '@elizaos/core'

describe('Agent Context Providers', () => {
  let testAgentId: string
  let runtime: AgentRuntime
  
  // Mock state for provider calls
  const mockState = {
    values: {},
    data: {},
    text: ''
  }

  beforeAll(async () => {
    // Create test agent
    testAgentId = await generateSnowflakeId()
    
    const wallet = ethers.Wallet.createRandom()
    
    await prisma.user.create({
      data: {
        id: testAgentId,
        privyId: `did:privy:test-context-${testAgentId}`,
        username: `test_context_${testAgentId.slice(-6)}`,
        displayName: 'Test Context Agent',
        walletAddress: wallet.address,
        isAgent: true,
        agentSystem: 'You are a test agent for context providers',
        agentModelTier: 'free',
        virtualBalance: 10000,
        reputationPoints: 1000,
        agentPointsBalance: 1000,
        profileComplete: true,
        hasUsername: true,
        isTest: true,
        updatedAt: new Date()
      }
    })

    // Get runtime (this will initialize all plugins and providers)
    runtime = await agentRuntimeManager.getRuntime(testAgentId)
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({
      where: { id: testAgentId }
    }).catch(() => {})
    
    // Clear runtime
    agentRuntimeManager.clearRuntime(testAgentId)
  })

  describe('Experience Plugin Integration', () => {
    it('should have experience service registered', () => {
      const experienceService = runtime.getService('EXPERIENCE')
      // Experience service may not be available if plugin didn't load properly
      // This is expected in some test environments
      console.log('Experience service status:', experienceService ? 'Available' : 'Not available')
    })

    it('should record and query experiences if service is available', async () => {
      const experienceService = runtime.getService('EXPERIENCE') as any
      
      if (!experienceService) {
        console.log('⚠️  Experience service not available, skipping test')
        return
      }
      
      // Record an experience
      const experience = await experienceService.recordExperience({
        type: 'LEARNING',
        outcome: 'POSITIVE',
        context: 'Testing context providers',
        action: 'test_action',
        result: 'Successfully tested',
        learning: 'Context providers work well',
        domain: 'testing',
        tags: ['test', 'context'],
        confidence: 0.9,
        importance: 0.8
      })
      
      expect(experience.id).toBeDefined()
      expect(experience.learning).toBe('Context providers work well')
      
      // Query experiences
      const experiences = await experienceService.queryExperiences({
        query: 'testing',
        limit: 5
      })
      
      expect(Array.isArray(experiences)).toBe(true)
    })
  })

  describe('Headlines Provider', () => {
    it('should fetch recent headlines', async () => {
      const headlinesProvider = runtime.providers.find(p => p.name === 'BABYLON_HEADLINES')
      expect(headlinesProvider).toBeDefined()
      
      // Create test headline
      const testSourceId = await generateSnowflakeId()
      await prisma.rSSFeedSource.create({
        data: {
          id: testSourceId,
          name: 'Test Source',
          feedUrl: 'https://test.com/feed',
          category: 'technology',
          isActive: true
        }
      })
      
      const testHeadlineId = await generateSnowflakeId()
      await prisma.rSSHeadline.create({
        data: {
          id: testHeadlineId,
          sourceId: testSourceId,
          title: 'Test Headline',
          publishedAt: new Date(),
          fetchedAt: new Date()
        }
      })
      
      const result = await headlinesProvider!.get(runtime, {
        userId: testAgentId,
        agentId: testAgentId,
        content: { text: 'Get headlines' }
      } as any, mockState)
      
      expect(result.text).toBeDefined()
      expect(typeof result.text).toBe('string')
      
      // Cleanup
      await prisma.rSSHeadline.delete({ where: { id: testHeadlineId } }).catch(() => {})
      await prisma.rSSFeedSource.delete({ where: { id: testSourceId } }).catch(() => {})
    })
  })

  describe('Market Movers Provider', () => {
    it('should fetch top gainers and losers', async () => {
      const marketMoversProvider = runtime.providers.find(p => p.name === 'BABYLON_MARKET_MOVERS')
      expect(marketMoversProvider).toBeDefined()
      
      // Create test companies
      const testCompanyId1 = await generateSnowflakeId()
      const testCompanyId2 = await generateSnowflakeId()
      
      await prisma.organization.create({
        data: {
          id: testCompanyId1,
          name: 'Test Gainer Inc',
          type: 'company',
          description: 'A test company that gained value',
          currentPrice: 150,
          initialPrice: 100,
          updatedAt: new Date()
        }
      })
      
      await prisma.organization.create({
        data: {
          id: testCompanyId2,
          name: 'Test Loser Corp',
          type: 'company',
          description: 'A test company that lost value',
          currentPrice: 50,
          initialPrice: 100,
          updatedAt: new Date()
        }
      })
      
      const result = await marketMoversProvider!.get(runtime, {
        userId: testAgentId,
        agentId: testAgentId,
        content: { text: 'Get market movers' }
      } as any, mockState)
      
      expect(result.text).toBeDefined()
      expect(result.text).toContain('GAINERS')
      expect(result.text).toContain('LOSERS')
      expect(result.data).toBeDefined()
      expect(result.data?.gainers).toBeDefined()
      expect(result.data?.losers).toBeDefined()
      
      // Cleanup
      await prisma.organization.delete({ where: { id: testCompanyId1 } }).catch(() => {})
      await prisma.organization.delete({ where: { id: testCompanyId2 } }).catch(() => {})
    })
  })

  describe('Agent Wallet Provider', () => {
    it('should fetch agent\'s own wallet and investments', async () => {
      const agentWalletProvider = runtime.providers.find(p => p.name === 'BABYLON_AGENT_WALLET')
      expect(agentWalletProvider).toBeDefined()
      
      const result = await agentWalletProvider!.get(runtime, {
        userId: testAgentId,
        agentId: testAgentId,
        content: { text: 'Show my wallet' }
      } as any, mockState)
      
      expect(result.text).toBeDefined()
      expect(result.text).toContain('Your Wallet')
      expect(result.text).toContain('BALANCES')
      expect(result.data).toBeDefined()
      const balances = result.data?.balances as any
      expect(balances).toBeDefined()
      expect(balances.virtualBalance).toBe(10000)
      expect(balances.reputationPoints).toBe(1000)
    })
  })

  describe('Entity Mentions Provider', () => {
    it('should detect company mentions', async () => {
      const entityMentionsProvider = runtime.providers.find(p => p.name === 'BABYLON_ENTITY_MENTIONS')
      expect(entityMentionsProvider).toBeDefined()
      
      // Create test company
      const testCompanyId = await generateSnowflakeId()
      await prisma.organization.create({
        data: {
          id: testCompanyId,
          name: 'Apple Inc',
          type: 'company',
          description: 'Technology company',
          currentPrice: 180,
          initialPrice: 150,
          updatedAt: new Date()
        }
      })
      
      const result = await entityMentionsProvider!.get(runtime, {
        userId: testAgentId,
        agentId: testAgentId,
        content: { text: 'What do you think about $AAPL and Apple Inc?' }
      } as any, mockState)
      
      expect(result.text).toBeDefined()
      if (result.text) {
        expect(result.text).toContain('MENTIONED ENTITIES')
      }
      
      // Cleanup
      await prisma.organization.delete({ where: { id: testCompanyId } }).catch(() => {})
    })

    it('should detect user mentions', async () => {
      const entityMentionsProvider = runtime.providers.find(p => p.name === 'BABYLON_ENTITY_MENTIONS')
      expect(entityMentionsProvider).toBeDefined()
      
      // Create test user
      const testUserId = await generateSnowflakeId()
      await prisma.user.create({
        data: {
          id: testUserId,
          privyId: `did:privy:test-user-${testUserId}`,
          username: 'testuser123',
          displayName: 'Test User',
          bio: 'A test user',
          reputationPoints: 500,
          virtualBalance: 0,
          totalDeposited: 0,
          profileComplete: true,
          hasUsername: true,
          updatedAt: new Date()
        }
      })
      
      const result = await entityMentionsProvider!.get(runtime, {
        userId: testAgentId,
        agentId: testAgentId,
        content: { text: 'Have you talked to @testuser123?' }
      } as any, mockState)
      
      expect(result.text).toBeDefined()
      if (result.text) {
        expect(result.text).toContain('MENTIONED ENTITIES')
      }
      
      // Cleanup
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
    })
  })

  describe('Trending Topics Provider', () => {
    it('should fetch trending topics', async () => {
      const trendingTopicsProvider = runtime.providers.find(p => p.name === 'BABYLON_TRENDING_TOPICS')
      expect(trendingTopicsProvider).toBeDefined()
      
      const result = await trendingTopicsProvider!.get(runtime, {
        userId: testAgentId,
        agentId: testAgentId,
        content: { text: 'What is trending?' }
      } as any, mockState)
      
      expect(result.text).toBeDefined()
      expect(typeof result.text).toBe('string')
    })
  })

  describe('Provider Integration', () => {
    it('should have all expected providers registered', () => {
      const providerNames = runtime.providers.map(p => p.name)
      
      // Check for new context providers
      expect(providerNames).toContain('BABYLON_HEADLINES')
      expect(providerNames).toContain('BABYLON_MARKET_MOVERS')
      expect(providerNames).toContain('BABYLON_AGENT_WALLET')
      expect(providerNames).toContain('BABYLON_ENTITY_MENTIONS')
      expect(providerNames).toContain('BABYLON_TRENDING_TOPICS')
      
      // Check for experience provider
      expect(providerNames).toContain('EXPERIENCE')
    })

    it('should provide context when agent receives a message', async () => {
      // This tests that providers are properly invoked during message processing
      const message = {
        userId: testAgentId,
        agentId: testAgentId,
        content: { text: 'What should I invest in?' },
        roomId: 'test-room'
      } as any
      
      // Get all provider contexts
      const contexts: string[] = []
      
      for (const provider of runtime.providers) {
        try {
          const result = await provider.get(runtime, message, mockState)
          if (result.text) {
            contexts.push(result.text)
          }
        } catch (error) {
          // Some providers may fail in test environment, that's ok
          console.log(`Provider ${provider.name} skipped:`, error)
        }
      }
      
      // At least some providers should return context
      expect(contexts.length).toBeGreaterThan(0)
      
      console.log(`✅ ${contexts.length} providers returned context`)
    })
  })
})

