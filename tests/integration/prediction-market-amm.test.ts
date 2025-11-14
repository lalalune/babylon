/**
 * Integration Tests: Prediction Market AMM
 * 
 * Tests the full flow of prediction market trading with database persistence
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { PredictionPricing } from '@/lib/prediction-pricing';
import { generateSnowflakeId } from '@/lib/snowflake';
import { Prisma } from '@prisma/client';

describe('Prediction Market AMM Integration', () => {
  let testMarketId: string;
  let testQuestionId: string;

  beforeAll(async () => {
    // Create test question
    const questionNumber = Math.floor(Math.random() * 1000000);
    testQuestionId = await generateSnowflakeId();
    
    await prisma.question.create({
      data: {
        id: testQuestionId,
        questionNumber,
        text: 'Test AMM Integration: Will this test pass?',
        scenarioId: 1,
        outcome: true,
        rank: 1,
        resolutionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'active',
        updatedAt: new Date(),
      },
    });

    // Create test market
    testMarketId = testQuestionId;
    await prisma.market.create({
      data: {
        id: testMarketId,
        question: 'Test AMM Integration: Will this test pass?',
        liquidity: new Prisma.Decimal(1000),
        yesShares: new Prisma.Decimal(500),
        noShares: new Prisma.Decimal(500),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.market.deleteMany({ where: { id: testMarketId } });
    await prisma.question.deleteMany({ where: { id: testQuestionId } });
  });

  test('reserves update correctly after buy', async () => {
    const before = await prisma.market.findUnique({ where: { id: testMarketId } });
    expect(before).not.toBeNull();

    const yesShares = Number(before!.yesShares);
    const noShares = Number(before!.noShares);

    // Calculate expected new reserves
    const calc = PredictionPricing.calculateBuy(yesShares, noShares, 'yes', 100);

    // Simulate what the API route does
    await prisma.market.update({
      where: { id: testMarketId },
      data: {
        yesShares: new Prisma.Decimal(calc.newYesShares),
        noShares: new Prisma.Decimal(calc.newNoShares),
        liquidity: { increment: new Prisma.Decimal(100) },
      },
    });

    const after = await prisma.market.findUnique({ where: { id: testMarketId } });
    
    // Verify reserves match calculation
    expect(Number(after!.yesShares)).toBeCloseTo(calc.newYesShares, 2);
    expect(Number(after!.noShares)).toBeCloseTo(calc.newNoShares, 2);
    
    // Verify k invariant
    const newK = Number(after!.yesShares) * Number(after!.noShares);
    const oldK = yesShares * noShares;
    expect(Math.abs(newK - oldK) / oldK).toBeLessThan(0.001);
  });

  test('multiple trades compound correctly', async () => {
    const initial = await prisma.market.findUnique({ where: { id: testMarketId } });
    const initialK = Number(initial!.yesShares) * Number(initial!.noShares);

    // Execute 5 small trades
    for (let i = 0; i < 5; i++) {
      const current = await prisma.market.findUnique({ where: { id: testMarketId } });
      const calc = PredictionPricing.calculateBuy(
        Number(current!.yesShares),
        Number(current!.noShares),
        i % 2 === 0 ? 'yes' : 'no',
        20
      );

      await prisma.market.update({
        where: { id: testMarketId },
        data: {
          yesShares: new Prisma.Decimal(calc.newYesShares),
          noShares: new Prisma.Decimal(calc.newNoShares),
        },
      });
    }

    const final = await prisma.market.findUnique({ where: { id: testMarketId } });
    const finalK = Number(final!.yesShares) * Number(final!.noShares);

    // K should be preserved through all trades
    expect(Math.abs(finalK - initialK) / initialK).toBeLessThan(0.01);
  });

  test('selling reduces reserves correctly', async () => {
    const before = await prisma.market.findUnique({ where: { id: testMarketId } });
    
    const calc = PredictionPricing.calculateSell(
      Number(before!.yesShares),
      Number(before!.noShares),
      'yes',
      50
    );

    await prisma.market.update({
      where: { id: testMarketId },
      data: {
        yesShares: new Prisma.Decimal(calc.newYesShares),
        noShares: new Prisma.Decimal(calc.newNoShares),
      },
    });

    const after = await prisma.market.findUnique({ where: { id: testMarketId } });
    
    // YES reserves should increase (shares returned)
    expect(Number(after!.yesShares)).toBeGreaterThan(Number(before!.yesShares));
    // NO reserves should decrease (USD paid out)
    expect(Number(after!.noShares)).toBeLessThan(Number(before!.noShares));
  });
});


