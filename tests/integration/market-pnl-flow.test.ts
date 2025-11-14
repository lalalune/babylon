/**
 * Market P&L Flow Integration Test
 * 
 * Tests complete buy/sell cycle to verify P&L and earned points:
 * 1. Create test user with balance
 * 2. Buy prediction market shares
 * 3. Sell shares at profit/loss
 * 4. Verify P&L recorded
 * 5. Verify earned points awarded
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { prisma } from '@/lib/database-service'
import { generateSnowflakeId } from '@/lib/snowflake'
import { WalletService } from '@/lib/services/wallet-service'
import { EarnedPointsService } from '@/lib/services/earned-points-service'
import { Prisma } from '@prisma/client'

describe('Market P&L Flow', () => {
  let testUserId: string

  beforeAll(async () => {
    testUserId = await generateSnowflakeId()
    await prisma.user.create({
      data: {
        id: testUserId,
        privyId: `test-${testUserId}`,
        username: `test-${testUserId.slice(-8)}`,
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
    await prisma.balanceTransaction.deleteMany({ where: { userId: testUserId } })
    await prisma.pointsTransaction.deleteMany({ where: { userId: testUserId } })
    await prisma.user.delete({ where: { id: testUserId } })
    await prisma.$disconnect()
  })

  test('Buy shares - no P&L impact', async () => {
    await WalletService.debit(
      testUserId,
      50,
      'pred_buy',
      'Bought 100 YES shares - Test Market',
      'test-market-1'
    )
    
    const balance = await WalletService.getBalance(testUserId)
    expect(Number(balance.balance)).toBe(9950)
    expect(Number(balance.lifetimePnL)).toBe(0)
  })

  test('Sell shares at profit - P&L recorded', async () => {
    await WalletService.credit(
      testUserId,
      75,
      'pred_sell',
      'Sold 100 YES shares - Test Market',
      'test-market-1'
    )
    
    const profitPnL = 75 - 50
    await WalletService.recordPnL(testUserId, profitPnL, 'prediction_sell', 'test-market-1')
    
    const balance = await WalletService.getBalance(testUserId)
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    
    expect(Number(balance.balance)).toBe(10025)
    expect(Number(balance.lifetimePnL)).toBe(25)
    
    const expectedPoints = EarnedPointsService.pnlToPoints(25)
    expect(user?.earnedPoints).toBe(expectedPoints)
  })

  test('Loss trade - negative P&L handled', async () => {
    await WalletService.debit(testUserId, 120, 'pred_buy', 'Bought 200 NO shares', 'test-market-2')
    await WalletService.credit(testUserId, 80, 'pred_sell', 'Sold 200 NO shares', 'test-market-2')
    
    const lossPnL = 80 - 120
    await WalletService.recordPnL(testUserId, lossPnL, 'prediction_sell', 'test-market-2')
    
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    const netPnL = 25 + lossPnL
    
    expect(Number(user?.lifetimePnL)).toBe(netPnL)
    expect(user?.earnedPoints).toBe(EarnedPointsService.pnlToPoints(netPnL))
  })

  test('Perp P&L - also tracked', async () => {
    await WalletService.recordPnL(testUserId, 50, 'perp_close', 'test-perp-1')
    
    const user = await prisma.user.findUnique({ where: { id: testUserId } })
    const expectedPnL = -15 + 50
    
    expect(Number(user?.lifetimePnL)).toBe(expectedPnL)
    expect(user?.earnedPoints).toBe(EarnedPointsService.pnlToPoints(expectedPnL))
  })

  test('Points transaction log created', async () => {
    const txs = await prisma.pointsTransaction.findMany({
      where: { userId: testUserId, reason: 'trading_pnl' },
      orderBy: { createdAt: 'asc' },
    })
    
    expect(txs.length).toBeGreaterThan(0)
    
    for (const tx of txs) {
      const meta = tx.metadata ? JSON.parse(tx.metadata as string) : {}
      expect(meta).toHaveProperty('pnl')
      expect(meta).toHaveProperty('tradeType')
    }
  })
})

