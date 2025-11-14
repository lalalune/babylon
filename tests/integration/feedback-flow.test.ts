/**
 * Feedback Flow Integration Test
 * 
 * Tests the feedback system including auto-generated and manual feedback
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '@/lib/database-service'
import { generateSnowflakeId } from '@/lib/snowflake'
import {
  CompletionFormat,
  generateGameCompletionFeedback,
  type TradeMetrics,
  type GameMetrics,
} from '@/lib/reputation/reputation-service'

describe('Feedback System', () => {
  let testUserId: string

  beforeAll(async () => {
    testUserId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testUserId,
        privyId: `test-${testUserId}`,
        username: `testuser-${testUserId.slice(-8)}`,
        displayName: 'Test User',
          isTest: true,
        updatedAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    await prisma.feedback.deleteMany({ where: { toUserId: testUserId } })
    await prisma.agentPerformanceMetrics.deleteMany({ where: { userId: testUserId } })
    await prisma.user.delete({ where: { id: testUserId } })
    await prisma.$disconnect()
  })

  test('Generate feedback for profitable trade', async () => {
    const tradeMetrics: TradeMetrics = {
      profitable: true,
      roi: 0.75,
      holdingPeriod: 6,
      timingScore: 0.95,
      riskScore: 0.9,
    }

    const feedback = await CompletionFormat(
      testUserId,
      `test_trade_${Date.now()}`,
      tradeMetrics
    )

    expect(feedback.score).toBeGreaterThan(70)
    expect(feedback.comment).toBeDefined()
  })

  test('Generate feedback for losing trade', async () => {
    const tradeMetrics: TradeMetrics = {
      profitable: false,
      roi: -0.35,
      holdingPeriod: 72,
      timingScore: 0.2,
      riskScore: 0.3,
    }

    const feedback = await CompletionFormat(
      testUserId,
      `test_trade_loss_${Date.now()}`,
      tradeMetrics
    )

    expect(feedback.score).toBeLessThan(50)
  })

  test('Generate game completion feedback', async () => {
    const gameMetrics: GameMetrics = {
      won: true,
      pnl: 600,
      positionsClosed: 6,
      finalBalance: 1600,
      startingBalance: 1000,
      decisionsCorrect: 9,
      decisionsTotal: 10,
      riskManagement: 0.85,
    }

    const feedback = await generateGameCompletionFeedback(
      testUserId,
      `test_game_${Date.now()}`,
      gameMetrics
    )

    expect(feedback.score).toBeGreaterThan(70)
    expect(feedback.category).toBe('game_performance')
  })

  test('Metrics are updated', async () => {
    const metrics = await prisma.agentPerformanceMetrics.findUnique({
      where: { userId: testUserId },
    })

    expect(metrics).toBeDefined()
    expect(metrics?.totalFeedbackCount).toBeGreaterThan(0)
  })
})

