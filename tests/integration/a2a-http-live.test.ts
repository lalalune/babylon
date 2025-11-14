/**
 * A2A HTTP Live Server Tests
 * 
 * Requires: npm run dev (server must be running)
 * 
 * Tests the HTTP A2A endpoints against a live Next.js server
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import { createHttpA2AClient } from '@/lib/a2a/client'

const SERVER_RUNNING = process.env.TEST_LIVE_SERVER === 'true'
const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

describe('A2A HTTP - Live Server Tests', () => {
  let testUserId: string
  let testMarketId: string | null = null
  let a2aClient: ReturnType<typeof createHttpA2AClient>

  beforeAll(async () => {
    if (!SERVER_RUNNING) {
      console.log('⚠️  Skipping live server tests (set TEST_LIVE_SERVER=true to enable)')
      return
    }

    // Create test user
    testUserId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testUserId,
        username: `test_a2a_${Date.now()}`,
        displayName: 'A2A Test User',
        virtualBalance: 5000,
        reputationPoints: 100,
        profileComplete: true,
        hasUsername: true,
          isTest: true,
        updatedAt: new Date()
      }
    })

    // Get existing market
    const market = await prisma.market.findFirst({
      where: { resolved: false }
    })
    testMarketId = market?.id || null

    // Create HTTP A2A client
    a2aClient = createHttpA2AClient({
      endpoint: `${BASE_URL}/api/a2a`,
      agentId: 'test-agent-http',
      address: '0xTestAddress'
    })

    console.log('✅ Test setup complete')
    console.log(`   User ID: ${testUserId}`)
    console.log(`   Market ID: ${testMarketId || 'none'}`)
  })

  afterAll(async () => {
    if (!SERVER_RUNNING) return

    // Cleanup
    await prisma.user.delete({
      where: { id: testUserId }
    })
  })

  describe('Agent Discovery', () => {
    it('should fetch agent card', async () => {
      if (!SERVER_RUNNING) return

      const response = await fetch(`${BASE_URL}/.well-known/agent-card.json`)
      expect(response.ok).toBe(true)

      const card = await response.json()
      expect(card.id).toBeDefined()
      expect(card.supportedMethods).toContain('a2a.getBalance')
      
      console.log('✅ Agent card accessible')
      console.log(`   Supports ${card.supportedMethods.length} methods`)
    })
  })

  describe('Portfolio Methods (via Client)', () => {
    it('should get user balance', async () => {
      if (!SERVER_RUNNING) return

      const result = await a2aClient.getBalance(testUserId)
      
      expect(result).toBeDefined()
      expect((result as any).balance).toBe(5000)
      
      console.log('✅ getBalance works via HTTP client')
      console.log(`   Balance: ${(result as any).balance}`)
    })

    it('should get user positions', async () => {
      if (!SERVER_RUNNING) return

      const result = await a2aClient.getPositions(testUserId)
      
      expect(result).toBeDefined()
      expect((result as any).perpPositions).toBeDefined()
      expect((result as any).marketPositions).toBeDefined()
      
      console.log('✅ getPositions works via HTTP client')
    })

    it('should get complete wallet data', async () => {
      if (!SERVER_RUNNING) return

      const result = await a2aClient.getUserWallet(testUserId)
      
      expect(result).toBeDefined()
      expect((result as any).balance).toBeDefined()
      expect((result as any).positions).toBeDefined()
      
      console.log('✅ getUserWallet works via HTTP client')
    })
  })

  describe('Market Methods (via Client)', () => {
    it('should get market data if market exists', async () => {
      if (!SERVER_RUNNING || !testMarketId) {
        console.log('⚠️  Skipping - no market available')
        return
      }

      const result = await a2aClient.getMarketData(testMarketId)
      
      expect(result).toBeDefined()
      expect((result as any).marketId).toBe(testMarketId)
      expect((result as any).question).toBeDefined()
      
      console.log('✅ getMarketData works')
      console.log(`   Question: ${(result as any).question}`)
    })

    it('should get market prices if market exists', async () => {
      if (!SERVER_RUNNING || !testMarketId) {
        console.log('⚠️  Skipping - no market available')
        return
      }

      const result = await a2aClient.getMarketPrices(testMarketId)
      
      expect(result).toBeDefined()
      expect((result as any).marketId).toBe(testMarketId)
      expect(Array.isArray((result as any).prices)).toBe(true)
      
      console.log('✅ getMarketPrices works')
    })
  })

  describe('Coalition Methods (via Client)', () => {
    it('should create coalition', async () => {
      if (!SERVER_RUNNING) return

      const result = await a2aClient.proposeCoalition({
        name: 'Test Coalition HTTP',
        strategy: 'test-strategy',
        targetMarket: testMarketId || 'test-market'
      })
      
      expect(result).toBeDefined()
      expect((result as any).coalitionId).toBeDefined()
      
      console.log('✅ proposeCoalition works')
      console.log(`   Coalition ID: ${(result as any).coalitionId}`)
    })
  })

  describe('Analysis Sharing (via Client)', () => {
    it('should share analysis', async () => {
      if (!SERVER_RUNNING || !testMarketId) {
        console.log('⚠️  Skipping - no market available')
        return
      }

      const result = await a2aClient.shareAnalysis({
        marketId: testMarketId,
        prediction: 0.7,
        confidence: 0.85,
        reasoning: 'HTTP test analysis',
        timestamp: Date.now()
      })
      
      expect(result).toBeDefined()
      expect((result as any).shared).toBe(true)
      expect((result as any).analysisId).toBeDefined()
      
      console.log('✅ shareAnalysis works')
    })

    it('should retrieve analyses', async () => {
      if (!SERVER_RUNNING || !testMarketId) {
        console.log('⚠️  Skipping - no market available')
        return
      }

      const result = await a2aClient.getAnalyses(testMarketId)
      
      expect(result).toBeDefined()
      expect(Array.isArray((result as any).analyses)).toBe(true)
      
      console.log('✅ getAnalyses works')
      console.log(`   Found ${(result as any).analyses.length} analyses`)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid method gracefully', async () => {
      if (!SERVER_RUNNING) return

      try {
        await a2aClient.request('a2a.invalidMethod', {})
        throw new Error('Should have thrown')
      } catch (error) {
        expect(error).toBeDefined()
        expect((error as Error).message).toContain('Error')
        console.log('✅ Invalid method properly rejected')
      }
    })
  })
})

export {}

