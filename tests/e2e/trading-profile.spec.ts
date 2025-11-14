// @ts-nocheck - Test file

/**
 * Trading Profile E2E Tests
 * Tests the full trading dashboard on user profiles
 */

import { test, expect } from '@playwright/test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'

let testUserId: string
let testMarketId: string

test.describe('Trading Profile Dashboard', () => {
  test.beforeAll(async () => {
    // Create test user with balance and positions
    const testUser = await prisma.user.create({
      data: {
        id: await generateSnowflakeId(),
          isTest: true,
        updatedAt: new Date(),
        privyId: `test_trading_profile_${Date.now()}`,
        username: `trader_${Date.now()}`,
        displayName: 'Test Trader',
        walletAddress: '0x' + Math.random().toString(16).slice(2).padEnd(40, '0'),
        virtualBalance: 15000,
        lifetimePnL: 2500,
        reputationPoints: 750,
        isAgent: false,
      },
    })
    testUserId = testUser.id

    // Create test market
    const market = await prisma.market.create({
      data: {
        id: await generateSnowflakeId(),
        updatedAt: new Date(),
        question: 'Will this E2E test pass?',
        description: 'Testing trading profile',
        endDate: new Date(Date.now() + 86400000),
        resolved: false,
        yesShares: 1500,
        noShares: 500,
        liquidity: 2000,
      },
    })
    testMarketId = market.id

    // Create prediction position
    await prisma.position.create({
      data: {
        id: await generateSnowflakeId(),
        updatedAt: new Date(),
        userId: testUserId,
        marketId: market.id,
        side: true, // YES
        shares: 150,
        avgPrice: 0.60,
      },
    })
  })

  test.afterAll(async () => {
    // Cleanup
    if (testUserId) {
      await prisma.position.deleteMany({ where: { userId: testUserId } })
      await prisma.perpPosition.deleteMany({ where: { userId: testUserId } })
      await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
    }
    if (testMarketId) {
      await prisma.market.delete({ where: { id: testMarketId } }).catch(() => {})
    }
    await prisma.$disconnect()
  })

  test('should fetch user balance via API', async () => {
    const response = await fetch(`http://localhost:3000/api/users/${testUserId}/balance`)
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.balance).toBeDefined()
    expect(parseFloat(data.balance)).toBeGreaterThan(0)
  })

  test('should fetch user positions via API', async () => {
    const response = await fetch(`http://localhost:3000/api/markets/positions/${testUserId}?status=open`)
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.predictions).toBeDefined()
    expect(data.predictions.positions).toBeInstanceOf(Array)
  })

  test('should fetch user profile via API', async () => {
    const response = await fetch(`http://localhost:3000/api/users/${testUserId}/profile`)
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.user).toBeDefined()
    expect(data.user.id).toBe(testUserId)
    expect(data.user.virtualBalance).toBeDefined()
  })

  test('should fetch leaderboard via API with correct pageSize', async () => {
    const response = await fetch(`http://localhost:3000/api/leaderboard?page=1&pageSize=100`)
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.leaderboard).toBeInstanceOf(Array)
    expect(data.pagination).toBeDefined()
  })

  test('should reject invalid leaderboard pageSize', async () => {
    const response = await fetch(`http://localhost:3000/api/leaderboard?page=1&pageSize=1000`)
    expect(response.status).toBe(400)
    
    const data = await response.json()
    expect(data.error).toBeDefined()
    expect(data.error.message).toContain('Validation failed')
  })
})

test.describe('Trading Profile Calculations', () => {
  test('should calculate prediction position P&L correctly', async () => {
    const response = await fetch(`http://localhost:3000/api/markets/positions/${testUserId}?status=open`)
    expect(response.status).toBe(200)
    
    const data = await response.json()
    const predictionPositions = data.predictions?.positions || []
    
    if (predictionPositions.length > 0) {
      const position = predictionPositions[0]
      expect(position.unrealizedPnL).toBeDefined()
      expect(typeof position.unrealizedPnL).toBe('number')
      expect(Number.isFinite(position.unrealizedPnL)).toBe(true)
    }
  })

  test('should have correct position response structure', async () => {
    const response = await fetch(`http://localhost:3000/api/markets/positions/${testUserId}?status=open`)
    const data = await response.json()
    
    // Validate structure
    expect(data).toHaveProperty('perpetuals')
    expect(data).toHaveProperty('predictions')
    expect(data.perpetuals).toHaveProperty('positions')
    expect(data.perpetuals).toHaveProperty('stats')
    expect(data.predictions).toHaveProperty('positions')
    expect(data.predictions).toHaveProperty('stats')
    
    // Validate types
    expect(Array.isArray(data.perpetuals.positions)).toBe(true)
    expect(Array.isArray(data.predictions.positions)).toBe(true)
  })
})

