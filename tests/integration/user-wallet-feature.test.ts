/**
 * User Wallet Feature Integration Test
 * Tests the new wallet display and A2A integration for user profiles
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const serverAvailable = await (async () => {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) })
    return response.status < 500
  } catch {
    console.log(`⚠️  Server not available - Skipping tests`)
    return false
  }
})()
import { A2AClient } from '@/lib/a2a/client'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'

describe('User Wallet Feature', () => {
  let testUserId: string
  let a2aClient: A2AClient | null = null

  beforeAll(async () => {
    // Create a test user with balance and positions
    testUserId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testUserId,
        privyId: `test_user_wallet_${Date.now()}`,
        username: `test_wallet_${Date.now()}`,
        displayName: 'Test Wallet User',
        walletAddress: '0x' + '0'.repeat(40),
        virtualBalance: 10000,
        totalDeposited: 15000,
        totalWithdrawn: 5000,
        lifetimePnL: 2500,
        reputationPoints: 500,
        isAgent: false,
          isTest: true,
        updatedAt: new Date()
      },
    })

    // Create some test positions
    const testMarket = await prisma.market.create({
      data: {
        id: await generateSnowflakeId(),
        question: 'Will this test pass?',
        description: 'Testing wallet feature',
        endDate: new Date(Date.now() + 86400000),
        resolved: false,
        yesShares: 1000,
        noShares: 1000,
        liquidity: 2000,
        updatedAt: new Date()
      },
    })

    await prisma.position.create({
      data: {
        id: await generateSnowflakeId(),
        userId: testUserId,
        marketId: testMarket.id,
        side: true, // true = YES, false = NO
        shares: 100,
        avgPrice: 0.5,
        updatedAt: new Date()
      },
    })
  })

  afterAll(async () => {
    await prisma.position.deleteMany({ where: { userId: testUserId } })
    await prisma.perpPosition.deleteMany({ where: { userId: testUserId } })
    await prisma.market.deleteMany({ where: { question: 'Will this test pass?' } })
    await prisma.user.delete({ where: { id: testUserId } })
    
    if (a2aClient) {
      await (a2aClient as any).disconnect()
    }
  })

  test.skipIf(!serverAvailable)('should fetch user balance via API', async () => {
    
    const response = await fetch(`http://localhost:3000/api/users/${testUserId}/balance`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    
    expect(data.balance).toBeDefined()
    expect(parseFloat(data.balance)).toBe(10000)
    expect(parseFloat(data.lifetimePnL)).toBe(2500)
    expect(parseFloat(data.totalDeposited)).toBe(15000)
  })

  test.skipIf(!serverAvailable)('should fetch user positions via API', async () => {
    
    const response = await fetch(`http://localhost:3000/api/markets/positions/${testUserId}?status=open`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    expect(response.ok).toBe(true)
    const data = await response.json()
    
    expect(data.predictions).toBeDefined()
    expect(data.predictions.positions).toBeDefined()
    expect(Array.isArray(data.predictions.positions)).toBe(true)
  })

  test.skipIf(!serverAvailable)('A2A client should have sendRequest method', () => {
    // HttpA2AClient uses sendRequest, not individual methods
    expect(typeof A2AClient.prototype.sendRequest).toBe('function')
    console.log('✅ A2A client has sendRequest method')
  })

  test.skipIf(!serverAvailable)('should initialize A2A client for HTTP transport', () => {
    // This test verifies the A2A HTTP client can be created
    const mockConfig = {
      endpoint: 'http://localhost:3000/api/a2a',
      agentId: 'test-agent-123'
    }

    const client = new A2AClient(mockConfig)
    
    expect(client.sendRequest).toBeDefined()
    expect(typeof client.sendRequest).toBe('function')
    
    console.log('✅ A2A HTTP client can be initialized')
  })
})

describe('Trading Profile UI Component', () => {
  test.skipIf(!serverAvailable)('TradingProfile component should be importable', async () => {
    const { TradingProfile } = await import('@/components/profile/TradingProfile')
    expect(TradingProfile).toBeDefined()
    expect(typeof TradingProfile).toBe('function')
  })
})

describe('Agent Providers', () => {
  test.skipIf(!serverAvailable)('userWalletProvider should be exported', async () => {
    const providers = await import('@/lib/agents/plugins/babylon/providers')
    expect(providers).toHaveProperty('userWalletProvider')
    expect(providers.userWalletProvider).toBeDefined()
    expect(providers.userWalletProvider.name).toBe('BABYLON_USER_WALLET')
  })

  test.skipIf(!serverAvailable)('babylonPlugin should include userWalletProvider', async () => {
    const { babylonPlugin } = await import('@/lib/agents/plugins/babylon')
    expect(babylonPlugin.providers).toBeDefined()
    const providerNames = babylonPlugin.providers?.map((p: any) => p.name) || []
    expect(providerNames).toContain('BABYLON_USER_WALLET')
  })
})

