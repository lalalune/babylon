/**
 * E2E Tests for Trading Fee System
 * 
 * Tests verify:
 * 1. Fees are correctly calculated and charged on all trade types
 * 2. Fees are tracked globally and per-user
 * 3. Referral fees are distributed correctly
 * 4. Admin panel displays accurate fee statistics
 */

import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';

test.describe('Trading Fee System E2E', () => {
  let testUserId: string;
  let testReferrerId: string;
  let testMarketId: string;

  test.beforeEach(async () => {
    // Create test users
    testReferrerId = await generateSnowflakeId();
    testUserId = await generateSnowflakeId();

    await prisma.user.create({
      data: {
        id: testReferrerId,
        username: `referrer-${Date.now()}`,
        displayName: 'Test Referrer',
        virtualBalance: 1000,
        totalDeposited: 1000,
        referralCode: `REF-${Date.now()}`,
          isTest: true,
        updatedAt: new Date(),
      },
    });

    await prisma.user.create({
      data: {
        id: testUserId,
        username: `trader-${Date.now()}`,
        displayName: 'Test Trader',
        virtualBalance: 10000,
        totalDeposited: 10000,
        referredBy: testReferrerId, // Has a referrer
          isTest: true,
        updatedAt: new Date(),
      },
    });

    // Create test prediction market
    testMarketId = await generateSnowflakeId();
    await prisma.market.create({
      data: {
        id: testMarketId,
        question: 'Test Market for Fees?',
        description: 'Testing fee system',
        yesShares: 500,
        noShares: 500,
        liquidity: 1000,
        resolved: false,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        updatedAt: new Date(),
      },
    });
  });

  test.afterEach(async () => {
    // Cleanup
    await prisma.position.deleteMany({ where: { userId: testUserId } });
    await prisma.balanceTransaction.deleteMany({ where: { userId: testUserId } });
    await prisma.balanceTransaction.deleteMany({ where: { userId: testReferrerId } });
    await prisma.tradingFee.deleteMany({ where: { userId: testUserId } });
    await prisma.tradingFee.deleteMany({ where: { referrerId: testReferrerId } });
    await prisma.market.deleteMany({ where: { id: testMarketId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
    await prisma.user.deleteMany({ where: { id: testReferrerId } });
  });

  test('should charge 0.1% fee on prediction market buy', async () => {
    const tradeAmount = 100;
    const expectedFee = tradeAmount * 0.001; // 0.1% = $0.10

    // Get initial balances
    const initialTrader = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { virtualBalance: true, totalFeesPaid: true },
    });

    const initialReferrer = await prisma.user.findUnique({
      where: { id: testReferrerId },
      select: { virtualBalance: true, totalFeesEarned: true },
    });

    // Execute trade via database (simulating API call)
    const { FeeService } = await import('@/lib/services/fee-service');
    const { PredictionPricing } = await import('@/lib/prediction-pricing');

    const calculation = PredictionPricing.calculateBuyWithFees(
      500, // yesShares
      500, // noShares
      'yes',
      tradeAmount
    );

    // Deduct from balance
    await prisma.user.update({
      where: { id: testUserId },
      data: {
        virtualBalance: { decrement: tradeAmount },
      },
    });

    // Update market
    await prisma.market.update({
      where: { id: testMarketId },
      data: {
        yesShares: calculation.newYesShares,
        noShares: calculation.newNoShares,
        liquidity: { increment: calculation.netAmount },
      },
    });

    // Create position
    const position = await prisma.position.create({
      data: {
        id: await generateSnowflakeId(),
        userId: testUserId,
        marketId: testMarketId,
        side: true, // YES
        shares: calculation.sharesBought,
        avgPrice: calculation.avgPrice,
        updatedAt: new Date(),
      },
    });

    // Process fee
    const feeResult = await FeeService.processTradingFee(
      testUserId,
      'pred_buy',
      tradeAmount,
      position.id,
      testMarketId
    );

    // Verify fee was charged correctly
    expect(feeResult.feeCharged).toBeCloseTo(expectedFee, 2);
    expect(feeResult.platformReceived).toBeCloseTo(expectedFee / 2, 2);
    expect(feeResult.referrerPaid).toBeCloseTo(expectedFee / 2, 2);
    expect(feeResult.referrerId).toBe(testReferrerId);

    // Verify trader's totalFeesPaid increased
    const updatedTrader = await prisma.user.findUnique({
      where: { id: testUserId },
      select: { totalFeesPaid: true },
    });
    const feesPaidIncrease = Number(updatedTrader!.totalFeesPaid) - Number(initialTrader!.totalFeesPaid);
    expect(feesPaidIncrease).toBeCloseTo(expectedFee, 2);

    // Verify referrer's balance and totalFeesEarned increased
    const updatedReferrer = await prisma.user.findUnique({
      where: { id: testReferrerId },
      select: { virtualBalance: true, totalFeesEarned: true },
    });
    
    const referrerBalanceIncrease = Number(updatedReferrer!.virtualBalance) - Number(initialReferrer!.virtualBalance);
    const feesEarnedIncrease = Number(updatedReferrer!.totalFeesEarned) - Number(initialReferrer!.totalFeesEarned);
    
    expect(referrerBalanceIncrease).toBeCloseTo(expectedFee / 2, 2);
    expect(feesEarnedIncrease).toBeCloseTo(expectedFee / 2, 2);

    // Verify trading fee record was created
    const feeRecord = await prisma.tradingFee.findFirst({
      where: {
        userId: testUserId,
        tradeType: 'pred_buy',
        marketId: testMarketId,
      },
    });

    expect(feeRecord).toBeDefined();
    expect(Number(feeRecord!.feeAmount)).toBeCloseTo(expectedFee, 2);
    expect(Number(feeRecord!.platformFee)).toBeCloseTo(expectedFee / 2, 2);
    expect(Number(feeRecord!.referrerFee)).toBeCloseTo(expectedFee / 2, 2);
    expect(feeRecord!.referrerId).toBe(testReferrerId);

    // Verify balance transaction for referrer
    const referrerTransaction = await prisma.balanceTransaction.findFirst({
      where: {
        userId: testReferrerId,
        type: 'referral_fee_earned',
        relatedId: testUserId,
      },
    });

    expect(referrerTransaction).toBeDefined();
    expect(Number(referrerTransaction!.amount)).toBeCloseTo(expectedFee / 2, 2);
  });

  test('should handle user with no referrer (100% to platform)', async () => {
    // Create user without referrer
    const noReferrerUserId = await generateSnowflakeId();
    await prisma.user.create({
      data: {
        id: noReferrerUserId,
        username: `noreferrer-${Date.now()}`,
        displayName: 'No Referrer User',
        virtualBalance: 10000,
        totalDeposited: 10000,
        referredBy: null, // No referrer
          isTest: true,
        updatedAt: new Date(),
      },
    });

    const tradeAmount = 100;
    const expectedFee = tradeAmount * 0.001; // $0.10

    const { FeeService } = await import('@/lib/services/fee-service');

    const feeResult = await FeeService.processTradingFee(
      noReferrerUserId,
      'pred_buy',
      tradeAmount
    );

    // Verify platform gets 100% when no referrer
    expect(feeResult.feeCharged).toBeCloseTo(expectedFee, 2);
    expect(feeResult.platformReceived).toBeCloseTo(expectedFee, 2); // Full amount
    expect(feeResult.referrerPaid).toBe(0);
    expect(feeResult.referrerId).toBeNull();

    // Verify trading fee record
    const feeRecord = await prisma.tradingFee.findFirst({
      where: {
        userId: noReferrerUserId,
        tradeType: 'pred_buy',
      },
    });

    expect(feeRecord).toBeDefined();
    expect(Number(feeRecord!.feeAmount)).toBeCloseTo(expectedFee, 2);
    expect(Number(feeRecord!.platformFee)).toBeCloseTo(expectedFee / 2, 2);
    expect(Number(feeRecord!.referrerFee)).toBe(0);
    expect(feeRecord!.referrerId).toBeNull();

    // Cleanup
    await prisma.tradingFee.deleteMany({ where: { userId: noReferrerUserId } });
    await prisma.user.deleteMany({ where: { id: noReferrerUserId } });
  });

  test('should skip fees below minimum ($0.01)', async () => {
    const tinyTradeAmount = 5; // 0.1% of $5 = $0.005 (below $0.01 minimum)

    const { FeeService } = await import('@/lib/services/fee-service');

    const feeResult = await FeeService.processTradingFee(
      testUserId,
      'pred_buy',
      tinyTradeAmount
    );

    // Fee should be skipped
    expect(feeResult.feeCharged).toBe(0);
    expect(feeResult.platformReceived).toBe(0);
    expect(feeResult.referrerPaid).toBe(0);

    // No trading fee record should be created
    const feeRecord = await prisma.tradingFee.findFirst({
      where: {
        userId: testUserId,
        tradeType: 'pred_buy',
        createdAt: { gte: new Date(Date.now() - 1000) }, // Last second
      },
    });

    expect(feeRecord).toBeNull();
  });

  test('should aggregate fees correctly in platform stats', async () => {
    const { FeeService } = await import('@/lib/services/fee-service');

    // Create multiple trades with fees
    await FeeService.processTradingFee(testUserId, 'pred_buy', 100);
    await FeeService.processTradingFee(testUserId, 'pred_sell', 200);
    await FeeService.processTradingFee(testUserId, 'perp_open', 1000);

    const expectedTotalFees = (100 + 200 + 1000) * 0.001; // $1.30
    const expectedPlatformFees = expectedTotalFees / 2; // $0.65
    const expectedReferrerFees = expectedTotalFees / 2; // $0.65

    // Get platform stats
    const stats = await FeeService.getPlatformFeeStats();

    expect(stats.totalFeesCollected).toBeGreaterThanOrEqual(expectedTotalFees - 0.01);
    expect(stats.totalPlatformFees).toBeGreaterThanOrEqual(expectedPlatformFees - 0.01);
    expect(stats.totalReferrerFees).toBeGreaterThanOrEqual(expectedReferrerFees - 0.01);
    expect(stats.totalTrades).toBeGreaterThanOrEqual(3);
  });

  test('should track referral earnings correctly', async () => {
    const { FeeService } = await import('@/lib/services/fee-service');

    // Multiple trades by referred user
    await FeeService.processTradingFee(testUserId, 'pred_buy', 100);
    await FeeService.processTradingFee(testUserId, 'pred_sell', 100);
    await FeeService.processTradingFee(testUserId, 'perp_open', 200);

    const expectedTotalFees = (100 + 100 + 200) * 0.001; // $0.40
    const expectedReferrerEarnings = expectedTotalFees / 2; // $0.20

    // Get referrer's earnings
    const earnings = await FeeService.getReferralEarnings(testReferrerId, { limit: 10 });

    expect(earnings.totalEarned).toBeGreaterThanOrEqual(expectedReferrerEarnings - 0.01);
    expect(earnings.totalReferrals).toBeGreaterThanOrEqual(1);
    expect(earnings.topReferrals.length).toBeGreaterThanOrEqual(1);
    
    const topReferral = earnings.topReferrals[0];
    expect(topReferral?.userId).toBe(testUserId);
    expect(topReferral?.totalFees).toBeGreaterThanOrEqual(expectedReferrerEarnings - 0.01);
    expect(topReferral?.tradeCount).toBeGreaterThanOrEqual(3);
  });
});

