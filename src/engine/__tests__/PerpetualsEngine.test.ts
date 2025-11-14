/**
 * Perpetuals Engine Tests
 * 
 * Verifies:
 * - Position opening with correct liquidation prices
 * - PnL calculations (long/short)
 * - Funding payment calculations
 * - Liquidation detection
 * - Daily snapshot recording
 */

import { describe, test, expect } from 'bun:test';
import { PerpetualsEngine } from '../PerpetualsEngine';
import {
  calculateLiquidationPrice,
  calculateUnrealizedPnL,
  calculateFundingPayment,
  shouldLiquidate,
} from '@/shared/perps-types';
import type { Organization } from '@/shared/types';

describe('PerpetualsEngine', () => {
  test('initializes markets from organizations', () => {
    const engine = new PerpetualsEngine();
    
    const orgs: Organization[] = [
      {
        id: 'test-company',
        name: 'Test Company',
        description: 'Test',
        type: 'company',
        canBeInvolved: true,
        initialPrice: 100.00,
      },
      {
        id: 'test-media',
        name: 'Test Media',
        description: 'Test',
        type: 'media',
        canBeInvolved: true,
      },
    ];

    engine.initializeMarkets(orgs);
    
    const markets = engine.getMarkets();
    expect(markets.length).toBe(1); // Only company, not media
    expect(markets[0]!.name).toBe('Test Company');
  });

  test('opens long position correctly', () => {
    const engine = new PerpetualsEngine();
    
    const orgs: Organization[] = [
      {
        id: 'test-company',
        name: 'Test Company',
        description: 'Test',
        type: 'company',
        canBeInvolved: true,
        initialPrice: 100.00,
      },
    ];

    engine.initializeMarkets(orgs);
    const markets = engine.getMarkets();
    const ticker = markets[0]!.ticker;

    const position = engine.openPosition('user-1', {
      ticker,
      side: 'long',
      size: 1000,
      leverage: 10,
      orderType: 'market',
    });

    expect(position.side).toBe('long');
    expect(position.size).toBe(1000);
    expect(position.leverage).toBe(10);
    expect(position.liquidationPrice).toBeLessThan(position.entryPrice);
  });

  test('calculates liquidation price correctly', () => {
    // Long 10x leverage
    const longLiqPrice = calculateLiquidationPrice(100, 'long', 10);
    expect(longLiqPrice).toBeCloseTo(91, 0); // ~91 (10% drop)

    // Short 10x leverage
    const shortLiqPrice = calculateLiquidationPrice(100, 'short', 10);
    expect(shortLiqPrice).toBeCloseTo(109, 0); // ~109 (10% rise)

    // Long 100x leverage
    const highLevLiqPrice = calculateLiquidationPrice(100, 'long', 100);
    expect(highLevLiqPrice).toBeCloseTo(99.1, 1); // ~99.1 (1% drop)
  });

  test('calculates unrealized PnL correctly', () => {
    // Long position, price up 10%
    const longProfit = calculateUnrealizedPnL(100, 110, 'long', 1000);
    expect(longProfit.pnl).toBeCloseTo(100, 0); // $100 profit
    expect(longProfit.pnlPercent).toBeCloseTo(10, 0); // 10%

    // Short position, price down 5%
    const shortProfit = calculateUnrealizedPnL(100, 95, 'short', 1000);
    expect(shortProfit.pnl).toBeCloseTo(50, 0); // $50 profit
    expect(shortProfit.pnlPercent).toBeCloseTo(5, 0); // 5%

    // Long position, price down 5%
    const longLoss = calculateUnrealizedPnL(100, 95, 'long', 1000);
    expect(longLoss.pnl).toBeCloseTo(-50, 0); // $50 loss
    expect(longLoss.pnlPercent).toBeCloseTo(-5, 0); // -5%
  });

  test('detects liquidations correctly', () => {
    // Long position
    const longLiqPrice = 91;
    expect(shouldLiquidate(90, longLiqPrice, 'long')).toBe(true); // Below liq
    expect(shouldLiquidate(92, longLiqPrice, 'long')).toBe(false); // Above liq

    // Short position
    const shortLiqPrice = 109;
    expect(shouldLiquidate(110, shortLiqPrice, 'short')).toBe(true); // Above liq
    expect(shouldLiquidate(108, shortLiqPrice, 'short')).toBe(false); // Below liq
  });

  test('calculates funding payments correctly', () => {
    // $1,000 position, 1% annual rate, 8 hours
    const payment = calculateFundingPayment(1000, 0.01, 8);
    expect(payment).toBeCloseTo(0.009, 2); // ~$0.009

    // $10,000 position, 5% annual rate, 24 hours (3 periods)
    const largePayment = calculateFundingPayment(10000, 0.05, 24);
    expect(largePayment).toBeCloseTo(1.37, 2); // ~$1.37 (corrected)
  });

  test('records daily snapshots', () => {
    const engine = new PerpetualsEngine();
    
    const orgs: Organization[] = [
      {
        id: 'test-company',
        name: 'Test Company',
        description: 'Test',
        type: 'company',
        canBeInvolved: true,
        initialPrice: 100.00,
      },
    ];

    engine.initializeMarkets(orgs);
    const markets = engine.getMarkets();
    const ticker = markets[0]!.ticker;

    // Record snapshot
    engine.recordDailySnapshot('2025-10-28');

    // Get snapshots
    const snapshots = engine.getDailySnapshots(ticker);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0]!.date).toBe('2025-10-28');
    expect(snapshots[0]!.ticker).toBe(ticker);
  });

  test('updates positions with new prices', () => {
    const engine = new PerpetualsEngine();
    
    const orgs: Organization[] = [
      {
        id: 'test-company',
        name: 'Test Company',
        description: 'Test',
        type: 'company',
        canBeInvolved: true,
        initialPrice: 100.00,
      },
    ];

    engine.initializeMarkets(orgs);
    const markets = engine.getMarkets();
    const ticker = markets[0]!.ticker;

    // Open position
    engine.openPosition('user-1', {
      ticker,
      side: 'long',
      size: 1000,
      leverage: 10,
      orderType: 'market',
    });

    // Price goes up 5%
    const priceMap = new Map([['test-company', 105]]);
    engine.updatePositions(priceMap);

    // Check PnL updated
    const updatedPositions = engine.getUserPositions('user-1');
    expect(updatedPositions[0]!.currentPrice).toBe(105);
    expect(updatedPositions[0]!.unrealizedPnL).toBeGreaterThan(0);
  });

  test('closes positions and calculates realized PnL', () => {
    const engine = new PerpetualsEngine();
    
    const orgs: Organization[] = [
      {
        id: 'test-company',
        name: 'Test Company',
        description: 'Test',
        type: 'company',
        canBeInvolved: true,
        initialPrice: 100.00,
      },
    ];

    engine.initializeMarkets(orgs);
    const markets = engine.getMarkets();
    const ticker = markets[0]!.ticker;

    const position = engine.openPosition('user-1', {
      ticker,
      side: 'long',
      size: 1000,
      leverage: 10,
      orderType: 'market',
    });

    // Price goes up
    const priceMap = new Map([['test-company', 105]]);
    engine.updatePositions(priceMap);

    // Close position
    const { realizedPnL } = engine.closePosition(position.id);
    
    expect(realizedPnL).toBeGreaterThan(0); // Made profit
    expect(engine.getUserPositions('user-1').length).toBe(0); // Position closed
  });
});

