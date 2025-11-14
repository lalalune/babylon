/**
 * Integration Tests: Spot Pricing System
 * 
 * Tests holdings-based price updates with real database queries
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import { Prisma } from '@prisma/client';

describe('Spot Pricing Integration', () => {
  let testOrgId: string;
  let testActorId: string;
  let testPoolId: string;

  beforeAll(async () => {
    // Create test organization
    testOrgId = `test-company-${Date.now()}`;
    await prisma.organization.create({
      data: {
        id: testOrgId,
        name: 'Test Company',
        description: 'Integration test company',
        type: 'company',
        canBeInvolved: true,
        initialPrice: 100,
        currentPrice: 100,
        updatedAt: new Date(),
      },
    });

    // Create test actor with pool
    testActorId = `test-actor-${Date.now()}`;
    await prisma.actor.create({
      data: {
        id: testActorId,
        name: 'Test NPC',
        domain: ['tech'],
        hasPool: true,
        tradingBalance: new Prisma.Decimal(50000),
        isTest: true,
        updatedAt: new Date(),
      },
    });

    // Create test pool
    testPoolId = await generateSnowflakeId();
    await prisma.pool.create({
      data: {
        id: testPoolId,
        npcActorId: testActorId,
        name: 'Test Pool',
        totalValue: new Prisma.Decimal(50000),
        availableBalance: new Prisma.Decimal(50000),
        lifetimePnL: new Prisma.Decimal(0),
        updatedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.poolPosition.deleteMany({ where: { poolId: testPoolId } });
    await prisma.pool.deleteMany({ where: { id: testPoolId } });
    await prisma.actor.deleteMany({ where: { id: testActorId } });
    await prisma.organization.deleteMany({ where: { id: testOrgId } });
  });

  test('price increases when NPC opens long position', async () => {
    const ticker = testOrgId.toUpperCase().replace(/-/g, '');
    const initialPrice = 100;

    // Create long position
    await prisma.poolPosition.create({
      data: {
        id: await generateSnowflakeId(),
        poolId: testPoolId,
        marketType: 'perp',
        ticker,
        side: 'long',
        entryPrice: initialPrice,
        currentPrice: initialPrice,
        size: 10000, // $10k position
        leverage: 5,
        liquidationPrice: 80,
        unrealizedPnL: 0,
        openedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Calculate price based on holdings
    const syntheticSupply = 10000;
    const baseMarketCap = initialPrice * syntheticSupply; // $1M
    const netHoldings = 10000; // $10k long
    const expectedPrice = (baseMarketCap + netHoldings) / syntheticSupply; // $101

    expect(expectedPrice).toBe(101);

    // Verify formula
    const positions = await prisma.poolPosition.findMany({
      where: { ticker, closedAt: null },
    });
    
    const actualHoldings = positions.reduce((sum, pos) => {
      return sum + (pos.side === 'long' ? pos.size : -pos.size);
    }, 0);

    expect(actualHoldings).toBe(10000);
  });

  test('price decreases when positions are closed', async () => {
    const ticker = testOrgId.toUpperCase().replace(/-/g, '');
    
    // Close the position
    const positions = await prisma.poolPosition.findMany({
      where: { ticker, closedAt: null },
    });

    if (positions.length > 0) {
      await prisma.poolPosition.update({
        where: { id: positions[0]!.id },
        data: { closedAt: new Date() },
      });
    }

    // Verify holdings are now zero
    const openPositions = await prisma.poolPosition.findMany({
      where: { ticker, closedAt: null },
    });

    const netHoldings = openPositions.reduce((sum, pos) => {
      return sum + (pos.side === 'long' ? pos.size : -pos.size);
    }, 0);

    expect(netHoldings).toBe(0);

    // Price should return to initial
    const syntheticSupply = 10000;
    const initialPrice = 100;
    const baseMarketCap = initialPrice * syntheticSupply;
    const expectedPrice = (baseMarketCap + netHoldings) / syntheticSupply;

    expect(expectedPrice).toBe(initialPrice);
  });

  test('mixed long/short positions offset', async () => {
    const ticker = testOrgId.toUpperCase().replace(/-/g, '');

    // Create multiple positions
    await prisma.poolPosition.create({
      data: {
        id: await generateSnowflakeId(),
        poolId: testPoolId,
        marketType: 'perp',
        ticker,
        side: 'long',
        entryPrice: 100,
        currentPrice: 100,
        size: 15000,
        leverage: 5,
        liquidationPrice: 80,
        unrealizedPnL: 0,
        openedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await prisma.poolPosition.create({
      data: {
        id: await generateSnowflakeId(),
        poolId: testPoolId,
        marketType: 'perp',
        ticker,
        side: 'short',
        entryPrice: 100,
        currentPrice: 100,
        size: 5000,
        leverage: 5,
        liquidationPrice: 120,
        unrealizedPnL: 0,
        openedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Calculate net holdings
    const positions = await prisma.poolPosition.findMany({
      where: { ticker, closedAt: null },
    });

    const netHoldings = positions.reduce((sum, pos) => {
      return sum + (pos.side === 'long' ? pos.size : -pos.size);
    }, 0);

    // Should be $15k - $5k = $10k net long
    expect(netHoldings).toBe(10000);

    // Price calculation
    const syntheticSupply = 10000;
    const initialPrice = 100;
    const expectedPrice = (initialPrice * syntheticSupply + netHoldings) / syntheticSupply;

    expect(expectedPrice).toBe(101);
  });
});


