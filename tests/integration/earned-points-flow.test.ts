/**
 * Earned Points Flow Integration Test
 * 
 * Tests the complete earned points system including:
 * - P&L tracking
 * - Points calculation
 * - Leaderboard integration
 * - Negative points cap
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '@/lib/database-service'
import { generateSnowflakeId } from '@/lib/snowflake'
import { WalletService } from '@/lib/services/wallet-service'
import { EarnedPointsService } from '@/lib/services/earned-points-service'
import { PointsService } from '@/lib/services/points-service'
import { Prisma } from '@prisma/client'

describe('Earned Points Flow', () => {
  let testUserId: string
  let referredUserId: string

  beforeAll(async () => {
    testUserId = await generateSnowflakeId()
    referredUserId = await generateSnowflakeId()

    await prisma.user.create({
      data: {
        id: testUserId,
        privyId: `test-${testUserId}`,
        username: `testuser-${testUserId.slice(-8)}`,
        displayName: 'Test Trader',
        email: `test-${testUserId}@example.com`,
        virtualBalance: new Prisma.Decimal(10000),
        lifetimePnL: new Prisma.Decimal(0),
        earnedPoints: 0,
        invitePoints: 0,
        bonusPoints: 0,
        reputationPoints: 100,
          isTest: true,
        updatedAt: new Date(),
      },
    })
  })

  afterAll(async () => {
    await prisma.pointsTransaction.deleteMany({ where: { userId: testUserId } })
    await prisma.pointsTransaction.deleteMany({ where: { userId: referredUserId } })
    await prisma.user.deleteMany({ where: { id: { in: [testUserId, referredUserId] } } })
    await prisma.$disconnect()
  })

  test('Profit trade awards earned points', async () => {
    await WalletService.recordPnL(testUserId, 100, 'prediction_sell', 'test-market-1')
    
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    const expectedPoints = EarnedPointsService.pnlToPoints(100)
    
    expect(user?.earnedPoints).toBe(expectedPoints)
    expect(Number(user?.lifetimePnL)).toBe(100)
  })

  test('Loss reduces earned points', async () => {
    await WalletService.recordPnL(testUserId, -50, 'perp_close', 'test-perp-1')
    
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    const expectedPoints = EarnedPointsService.pnlToPoints(50)
    
    expect(user?.earnedPoints).toBe(expectedPoints)
    expect(Number(user?.lifetimePnL)).toBe(50)
  })

  test('Large profit calculated correctly', async () => {
    await WalletService.recordPnL(testUserId, 500, 'perp_close', 'test-perp-2')
    
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    const expectedPoints = EarnedPointsService.pnlToPoints(550)
    
    expect(user?.earnedPoints).toBe(expectedPoints)
  })

  test('Referral points awarded', async () => {
    await prisma.user.create({
      data: {
        id: referredUserId,
        privyId: `test-referred-${referredUserId}`,
        username: `referred-${referredUserId.slice(-8)}`,
        email: `referred-${referredUserId}@example.com`,
        referredBy: testUserId,
        virtualBalance: new Prisma.Decimal(10000),
          isTest: true,
        updatedAt: new Date(),
      },
    })
    
    await PointsService.awardPoints(testUserId, 250, 'referral_signup', {
      referredUserId,
    })
    
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    expect(user?.invitePoints).toBe(250)
  })

  test('Bonus points awarded', async () => {
    await PointsService.awardPoints(testUserId, 1000, 'profile_completion', {})
    
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    expect(user?.bonusPoints).toBe(1000)
  })

  test('Total reputation calculated correctly', async () => {
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    const expectedTotal = 100 + user!.earnedPoints + user!.invitePoints + user!.bonusPoints
    
    expect(user?.reputationPoints).toBe(expectedTotal)
  })

  test('Leaderboard API works and returns data', async () => {
    const allLeaderboard = await PointsService.getLeaderboard(1, 100, 0, 'all')
    const earnedLeaderboard = await PointsService.getLeaderboard(1, 100, 0, 'earned')
    const referralLeaderboard = await PointsService.getLeaderboard(1, 100, 0, 'referral')
    
    // Verify leaderboards can be fetched
    expect(allLeaderboard.users).toBeDefined()
    expect(earnedLeaderboard.users).toBeDefined()
    expect(referralLeaderboard.users).toBeDefined()
    
    // Verify structure
    expect(Array.isArray(allLeaderboard.users)).toBe(true)
    expect(Array.isArray(earnedLeaderboard.users)).toBe(true)
    expect(Array.isArray(referralLeaderboard.users)).toBe(true)
    
    console.log(`   ✅ Leaderboards: All(${allLeaderboard.users.length}), Earned(${earnedLeaderboard.users.length}), Referral(${referralLeaderboard.users.length})`)
  })

  test('Negative points capped at -100', async () => {
    await WalletService.recordPnL(testUserId, -2000, 'perp_close', 'test-perp-3')
    
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    const expectedCapped = EarnedPointsService.pnlToPoints(Number(user?.lifetimePnL))
    
    expect(expectedCapped).toBe(-100)
    expect(user?.earnedPoints).toBe(-100)
  })
})

