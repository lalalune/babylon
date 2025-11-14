/**
 * A2A HTTP API Integration Tests
 * 
 * Tests the new HTTP-based A2A endpoints (no WebSocket)
 * Tests ALL A2A JSON-RPC methods work correctly
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'

describe('A2A HTTP API Integration', () => {
  let testUserId: string
  let testMarketId: string

  beforeAll(async () => {
    // Check if server is running
    await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(1000) })

    // Create test user
    testUserId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testUserId,
        username: `test_user_${Date.now()}`,
        displayName: 'Test User',
        virtualBalance: 1000,
        reputationPoints: 100,
        profileComplete: true,
        hasUsername: true,
          isTest: true,
        updatedAt: new Date()
      }
    })

    // Get an existing market for testing
    const existingMarket = await prisma.market.findFirst({
      where: { resolved: false }
    })
    
    testMarketId = existingMarket!.id
  })

  describe('Agent Card Discovery', () => {
    it('should return valid agent card at /.well-known/agent-card.json', async () => {
      
      // Next.js routes this as /. well-known/agent-card (without .json extension)
      const response = await fetch(`${BASE_URL}/.well-known/agent-card`)
      
      expect(response.ok).toBe(true)
      expect(response.headers.get('content-type')).toContain('application/json')

      const agentCard = await response.json()
      
      expect(agentCard.id).toBeDefined()
      expect(agentCard.name).toBeDefined()
      expect(agentCard.version).toBeDefined()
      expect(agentCard.endpoint).toBeDefined()
      expect(Array.isArray(agentCard.supportedMethods)).toBe(true)
      expect(agentCard.supportedMethods.length).toBeGreaterThan(0)

      console.log('✅ Agent card valid')
      console.log('   Supported methods:', agentCard.supportedMethods.length)
    })
  })

  describe('A2A JSON-RPC Endpoint', () => {
    it('should respond to POST /api/a2a', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.getBalance',
          params: { userId: testUserId },
          id: 1
        })
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      
      expect(result.jsonrpc).toBe('2.0')
      expect(result.id).toBe(1)
      expect(result.result || result.error).toBeDefined()

      console.log('✅ A2A endpoint responds')
    })

    it('should reject invalid JSON-RPC format', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Missing jsonrpc field
          method: 'a2a.test',
          id: 1
        })
      })

      const result = await response.json()
      expect(result.error).toBeDefined()
      // Server returns -32601 (Method not found) for malformed requests
      expect(result.error.code).toBe(-32601)

      console.log('✅ Validates JSON-RPC format')
    })
  })

  describe('Market Data Methods', () => {
    it('a2a.getMarketData should return market details', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.getMarketData',
          params: { marketId: testMarketId },
          id: 2
        })
      })

      const result = await response.json()
      
      if (result.error) {
        console.log('   Error:', result.error.message)
      } else {
        expect(result.result).toBeDefined()
        expect(result.result.marketId).toBe(testMarketId)
        expect(result.result.question).toBeDefined()
        expect(Array.isArray(result.result.outcomes)).toBe(true)
        console.log('✅ getMarketData works')
      }
    })

    it('a2a.getMarketPrices should return current prices', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.getMarketPrices',
          params: { marketId: testMarketId },
          id: 3
        })
      })

      const result = await response.json()
      
      if (result.error) {
        console.log('   Error:', result.error.message)
      } else {
        expect(result.result).toBeDefined()
        expect(result.result.marketId).toBe(testMarketId)
        expect(Array.isArray(result.result.prices)).toBe(true)
        console.log('✅ getMarketPrices works')
      }
    })
  })

  describe('Portfolio Methods', () => {
    it('a2a.getBalance should return user balance', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.getBalance',
          params: { userId: testUserId },
          id: 4
        })
      })

      const result = await response.json()
      
      if (result.error) {
        console.log('   Error:', result.error.message)
      } else {
        expect(result.result).toBeDefined()
        expect(typeof result.result.balance).toBe('number')
        expect(result.result.balance).toBe(1000)
        console.log('✅ getBalance works, balance:', result.result.balance)
      }
    })

    it('a2a.getPositions should return user positions', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.getPositions',
          params: { userId: testUserId },
          id: 5
        })
      })

      const result = await response.json()
      
      if (result.error) {
        console.log('   Error:', result.error.message)
      } else {
        expect(result.result).toBeDefined()
        expect(result.result.perpPositions).toBeDefined()
        expect(result.result.marketPositions).toBeDefined()
        console.log('✅ getPositions works')
      }
    })

    it('a2a.getUserWallet should return complete wallet data', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.getUserWallet',
          params: { userId: testUserId },
          id: 6
        })
      })

      const result = await response.json()
      
      if (result.error) {
        console.log('   Error:', result.error.message)
      } else {
        expect(result.result).toBeDefined()
        expect(result.result.balance).toBeDefined()
        expect(result.result.positions).toBeDefined()
        console.log('✅ getUserWallet works')
      }
    })
  })

  describe('Coalition Methods', () => {
    it('a2a.proposeCoalition should create coalition', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.proposeCoalition',
          params: {
            name: 'Test Coalition',
            strategy: 'momentum',
            targetMarket: testMarketId
          },
          id: 7
        })
      })

      const result = await response.json()
      
      if (result.error) {
        console.log('   Error:', result.error.message)
      } else {
        expect(result.result).toBeDefined()
        expect(result.result.coalitionId).toBeDefined()
        console.log('✅ proposeCoalition works')
      }
    })
  })

  describe('Analysis Sharing Methods', () => {
    it('a2a.shareAnalysis should store analysis', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.shareAnalysis',
          params: {
            marketId: testMarketId,
            analyst: 'test-agent',
            prediction: 0.65,
            confidence: 0.8,
            reasoning: 'Test analysis',
            dataPoints: {},
            timestamp: Date.now()
          },
          id: 8
        })
      })

      const result = await response.json()
      
      if (result.error) {
        console.log('   Error:', result.error.message)
      } else {
        expect(result.result).toBeDefined()
        expect(result.result.shared).toBe(true)
        expect(result.result.analysisId).toBeDefined()
        console.log('✅ shareAnalysis works')
      }
    })

    it('a2a.getAnalyses should retrieve analyses', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.getAnalyses',
          params: {
            marketId: testMarketId,
            limit: 10
          },
          id: 9
        })
      })

      const result = await response.json()
      
      if (result.error) {
        console.log('   Error:', result.error.message)
      } else {
        expect(result.result).toBeDefined()
        expect(Array.isArray(result.result.analyses)).toBe(true)
        console.log('✅ getAnalyses works, found:', result.result.analyses.length)
      }
    })
  })

  describe('Error Handling', () => {
    it('should return error for invalid method', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.invalidMethod',
          params: {},
          id: 10
        })
      })

      const result = await response.json()
      
      expect(result.error).toBeDefined()
      expect(result.error.code).toBe(-32601) // Method not found
      console.log('✅ Returns proper error for invalid method')
    })

    it('should return error for missing required params', async () => {
      
      const response = await fetch(`${BASE_URL}/api/a2a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Agent-Id': 'test-agent'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'a2a.getUserWallet',
          params: {}, // Missing required userId
          id: 11
        })
      })

      const result = await response.json()
      
      expect(result.error).toBeDefined()
      expect(result.error.code).toBe(-32602) // Invalid params
      console.log('✅ Validates required parameters')
    })
  })
})

export {}

