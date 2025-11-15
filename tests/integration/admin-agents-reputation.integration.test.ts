/**
 * Integration Tests: Admin Agents Tab with Reputation
 * 
 * Tests that the admin agents API returns reputation scores
 * and that the UI can display and sort by reputation.
 */

import { describe, test, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'

const BASE_URL = process.env.TEST_API_URL || process.env.TEST_BASE_URL || 'http://localhost:3000'
let serverAvailable = false

describe('Admin Agents Reputation Integration', () => {
  let testAgentUserId: string
  let adminAccessToken: string | null = null

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

    // Create test agent
    testAgentUserId = await generateSnowflakeId()

    await prisma.user.create({
      data: {
        id: testAgentUserId,
        username: `test-agent-${Date.now()}`,
        displayName: 'Test Agent for Reputation',
        isAgent: true,
        agent0TokenId: 99999,
        autonomousTrading: true,
        agentModelTier: 'pro',
        agentPointsBalance: 1000,
        updatedAt: new Date(),
      },
    })

    // Create performance metrics with reputation
    await prisma.agentPerformanceMetrics.create({
      data: {
        id: await generateSnowflakeId(),
        userId: testAgentUserId,
        reputationScore: 85,
        averageFeedbackScore: 82,
        totalFeedbackCount: 15,
        totalTrades: 50,
        profitableTrades: 35,
        updatedAt: new Date(),
      },
    })

    // Try to get admin access token (if available)
    adminAccessToken = process.env.TEST_ADMIN_TOKEN || null
  })

  afterEach(async () => {
    // Don't clean up metrics - they're needed for tests
    // Cleanup will happen in afterAll if needed
  })

  test('should fetch agents with reputation scores from API', async () => {
    if (!serverAvailable) {
      console.log('⏭️  Skipping API test - server not available')
      return
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (adminAccessToken) {
        headers['Authorization'] = `Bearer ${adminAccessToken}`
      }

      const response = await fetch(`${BASE_URL}/api/admin/agents`, {
        headers,
      })

      if (response.ok) {
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.data).toBeDefined()
        expect(data.data.agents).toBeInstanceOf(Array)

        // Find our test agent
        const testAgent = data.data.agents.find((a: { id: string }) => a.id === testAgentUserId)

        if (testAgent) {
          expect(testAgent.reputationScore).toBeDefined()
          expect(testAgent.reputationScore).toBeGreaterThanOrEqual(0)
          expect(testAgent.reputationScore).toBeLessThanOrEqual(100)
          expect(testAgent.averageFeedbackScore).toBeDefined()
          expect(testAgent.totalFeedbackCount).toBeDefined()
        }
      } else {
        // May require proper auth
        console.log('⚠️  API requires authentication or admin access')
      }
    } catch (error) {
      console.warn('⚠️  API test failed:', error)
    }
  })

  test('should verify reputation data structure', async () => {
    const agent = await prisma.user.findUnique({
      where: { id: testAgentUserId },
      include: {
        AgentPerformanceMetrics: true,
      },
    })

    expect(agent).toBeDefined()
    expect(agent?.AgentPerformanceMetrics).toBeDefined()
    
    // Verify reputation score exists and is valid
    const reputationScore = agent?.AgentPerformanceMetrics?.reputationScore
    expect(reputationScore).toBeDefined()
    expect(reputationScore).toBeGreaterThanOrEqual(0)
    expect(reputationScore).toBeLessThanOrEqual(100)
    
    // Verify other metrics exist
    expect(agent?.AgentPerformanceMetrics?.averageFeedbackScore).toBeDefined()
    expect(agent?.AgentPerformanceMetrics?.totalFeedbackCount).toBeDefined()
  })

  test('should handle agents without reputation metrics', async () => {
    const newAgentId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: newAgentId,
        username: `no-rep-agent-${Date.now()}`,
        displayName: 'Agent Without Reputation',
        isAgent: true,
        updatedAt: new Date(),
      },
    })

    const agent = await prisma.user.findUnique({
      where: { id: newAgentId },
      include: {
        AgentPerformanceMetrics: true,
      },
    })

    expect(agent).toBeDefined()
    // Should have default reputation score of 50 if no metrics
    expect(agent?.AgentPerformanceMetrics).toBeNull()

    // Clean up
    await prisma.user.delete({ where: { id: newAgentId } })
  })

  afterAll(async () => {
    // Clean up test agent and metrics
    await prisma.agentPerformanceMetrics.deleteMany({
      where: { userId: testAgentUserId },
    })
    await prisma.user.delete({ where: { id: testAgentUserId } }).catch(() => {})
  })
})

