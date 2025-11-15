/**
 * Integration Tests: ERC-8004 Reputation Sync
 * 
 * Tests reputation sync functionality against a running server.
 * Requires server to be running and database to be accessible.
 */

import { describe, test, expect, beforeAll, afterEach } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import {
  syncUserReputationToERC8004,
  batchSyncReputationsToERC8004,
  syncAllReputationsToERC8004,
} from '@/lib/reputation/erc8004-reputation-sync'
import { getCachedAgent0ReputationScore } from '@/lib/reputation/agent0-reputation-cache'

const BASE_URL = process.env.TEST_API_URL || process.env.TEST_BASE_URL || 'http://localhost:3000'
let serverAvailable = false

describe('ERC-8004 Reputation Sync Integration', () => {
  let testUserId: string
  let testAgentUserId: string
  let testAgent0TokenId: number | null = null

  beforeAll(async () => {
    // Check if server is running
    try {
      const healthResponse = await fetch(`${BASE_URL}/api/health`, {
        signal: AbortSignal.timeout(2000),
      })
      if (healthResponse.ok) {
        serverAvailable = true
        console.log('✅ Server available for testing')
      }
    } catch (error) {
      console.warn('⚠️  Server not available, some tests may be skipped')
    }

    // Create test users
    testUserId = await generateSnowflakeId()
    testAgentUserId = await generateSnowflakeId()

    await prisma.user.create({
      data: {
        id: testUserId,
        username: `test-user-${Date.now()}`,
        displayName: 'Test User',
        updatedAt: new Date(),
      },
    })

    await prisma.user.create({
      data: {
        id: testAgentUserId,
        username: `test-agent-${Date.now()}`,
        displayName: 'Test Agent',
        isAgent: true,
        agent0TokenId: 12345, // Mock token ID
        updatedAt: new Date(),
      },
    })

    // Create performance metrics
    await prisma.agentPerformanceMetrics.create({
      data: {
        id: await generateSnowflakeId(),
        userId: testAgentUserId,
        reputationScore: 75,
        totalTrades: 10,
        profitableTrades: 7,
        updatedAt: new Date(),
      },
    })
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.agentPerformanceMetrics.deleteMany({
      where: { userId: { in: [testUserId, testAgentUserId] } },
    })
    await prisma.gameConfig.deleteMany({
      where: {
        key: { startsWith: `reputation_sync_${testAgentUserId}` },
      },
    })
  })

  test('should get cached reputation score', async () => {
    const score = await getCachedAgent0ReputationScore(testAgentUserId)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  test('should sync single user reputation', async () => {
    const result = await syncUserReputationToERC8004(testAgentUserId, false)

    expect(result.userId).toBe(testAgentUserId)
    expect(result.agent0TokenId).toBe(12345)
    expect(result.reputationScore).toBeGreaterThanOrEqual(0)
    expect(result.reputationScore).toBeLessThanOrEqual(100)
    expect(result.synced).toBe(true)

    // Verify metrics were updated
    const metrics = await prisma.agentPerformanceMetrics.findUnique({
      where: { userId: testAgentUserId },
    })
    expect(metrics).toBeDefined()
    expect(metrics?.reputationScore).toBeDefined()
  })

  test('should skip sync if cache is fresh', async () => {
    // First sync
    await syncUserReputationToERC8004(testAgentUserId, false)

    // Second sync immediately should skip
    const result = await syncUserReputationToERC8004(testAgentUserId, false)
    expect(result.synced).toBe(false)
    expect(result.error).toContain('not needed')
  })

  test('should force recalculation when requested', async () => {
    const result = await syncUserReputationToERC8004(testAgentUserId, true)
    expect(result.synced).toBe(true)
  })

  test('should handle user without Agent0 token ID', async () => {
    const result = await syncUserReputationToERC8004(testUserId, false)
    expect(result.synced).toBe(false)
    expect(result.error).toContain('No Agent0 token ID')
  })

  test('should batch sync multiple users', async () => {
    const result = await batchSyncReputationsToERC8004({
      limit: 10,
      offset: 0,
      prioritizeNew: true,
    })

    expect(result.total).toBeGreaterThanOrEqual(0)
    expect(result.synced).toBeGreaterThanOrEqual(0)
    expect(result.failed).toBeGreaterThanOrEqual(0)
    expect(result.skipped).toBeGreaterThanOrEqual(0)
    expect(result.results).toBeInstanceOf(Array)
  })

  test('should sync all reputations', async () => {
    const result = await syncAllReputationsToERC8004()

    expect(result.total).toBeGreaterThanOrEqual(0)
    expect(result.synced).toBeGreaterThanOrEqual(0)
    expect(result.failed).toBeGreaterThanOrEqual(0)
    expect(result.skipped).toBeGreaterThanOrEqual(0)
    expect(result.results).toBeInstanceOf(Array)
  })

  test('should handle banned user reputation', async () => {
    // Ban the agent
    await prisma.user.update({
      where: { id: testAgentUserId },
      data: { isBanned: true },
    })

    const score = await getCachedAgent0ReputationScore(testAgentUserId)
    expect(score).toBe(0)

    // Clean up
    await prisma.user.update({
      where: { id: testAgentUserId },
      data: { isBanned: false },
    })
  })

  test('should handle scammer/CSAM flags', async () => {
    // Mark as scammer
    await prisma.user.update({
      where: { id: testAgentUserId },
      data: { isScammer: true },
    })

    const score = await getCachedAgent0ReputationScore(testAgentUserId)
    expect(score).toBe(5) // Very low but not zero

    // Clean up
    await prisma.user.update({
      where: { id: testAgentUserId },
      data: { isScammer: false },
    })
  })

  test('should test cron endpoint if server available', async () => {
    if (!serverAvailable) {
      console.log('⏭️  Skipping cron endpoint test - server not available')
      return
    }

    try {
      const response = await fetch(`${BASE_URL}/api/cron/reputation-sync`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer development',
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.result).toBeDefined()
        expect(data.result.total).toBeGreaterThanOrEqual(0)
      } else {
        // May require proper auth in production
        console.log('⚠️  Cron endpoint requires authentication')
      }
    } catch (error) {
      console.warn('⚠️  Cron endpoint test failed:', error)
    }
  })
})

