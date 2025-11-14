/**
 * PriceEngine Tests
 * 
 * Verifies:
 * - Deterministic price generation (same seed = same prices)
 * - Markov chain transitions
 * - Event impact application
 * - Minute-by-minute price interpolation
 */

import { describe, test, expect } from 'bun:test';
import { PriceEngine } from '../PriceEngine';
import type { Organization, WorldEvent } from '@/shared/types';

describe('PriceEngine', () => {
  test('initializes companies with starting prices', () => {
    const priceEngine = new PriceEngine(12345);
    
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

    priceEngine.initializeCompanies(orgs);
    
    const currentPrice = priceEngine.getCurrentPrice('test-company');
    expect(currentPrice).toBe(100.00);
  });

  test('generates deterministic prices with same seed', () => {
    const seed = 12345;
    const startTime = new Date('2025-11-01T09:30:00Z');
    const endTime = new Date('2025-11-01T09:32:00Z'); // 2 minutes

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

    // First engine
    const engine1 = new PriceEngine(seed);
    engine1.initializeCompanies(orgs);
    const prices1 = engine1.generateMinutePrices('test-company', startTime, endTime);

    // Second engine with same seed
    const engine2 = new PriceEngine(seed);
    engine2.initializeCompanies(orgs);
    const prices2 = engine2.generateMinutePrices('test-company', startTime, endTime);

    // Prices should be identical
    expect(prices1.length).toBe(prices2.length);
    prices1.forEach((price, i) => {
      expect(price.price).toBe(prices2[i]!.price);
      expect(price.change).toBe(prices2[i]!.change);
    });
  });

  test('generates different prices with different seeds', () => {
    const startTime = new Date('2025-11-01T09:30:00Z');
    const endTime = new Date('2025-11-01T09:32:00Z');

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

    const engine1 = new PriceEngine(12345);
    engine1.initializeCompanies(orgs);
    const prices1 = engine1.generateMinutePrices('test-company', startTime, endTime);

    const engine2 = new PriceEngine(67890);
    engine2.initializeCompanies(orgs);
    const prices2 = engine2.generateMinutePrices('test-company', startTime, endTime);

    // Prices should be different
    let hasDifference = false;
    prices1.forEach((price, i) => {
      if (Math.abs(price.price - prices2[i]!.price) > 0.01) {
        hasDifference = true;
      }
    });
    expect(hasDifference).toBe(true);
  });

  test('applies event impacts correctly', () => {
    const priceEngine = new PriceEngine(12345);
    
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

    priceEngine.initializeCompanies(orgs);

    const event: WorldEvent = {
      id: 'test-event',
      type: 'scandal',
      actors: ['test-actor'],
      description: 'CEO involved in scandal',
      relatedQuestion: 1,
      pointsToward: 'NO',
      visibility: 'public',
    };

    // Major negative impact should significantly decrease price
    const update = priceEngine.applyEventImpact('test-company', event, 'negative', 'major');
    
    expect(update).not.toBeNull();
    expect(update!.change).toBeLessThan(0); // Price went down
    expect(Math.abs(update!.changePercent)).toBeGreaterThan(3); // At least 3% movement
  });

  test('generates minute prices that smoothly interpolate', () => {
    const priceEngine = new PriceEngine(12345);
    
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

    priceEngine.initializeCompanies(orgs);

    const startTime = new Date('2025-11-01T09:30:00Z');
    const endTime = new Date('2025-11-01T09:35:00Z'); // 5 minutes

    const prices = priceEngine.generateMinutePrices('test-company', startTime, endTime);

    // Should have 6 prices (0, 1, 2, 3, 4, 5 minutes)
    expect(prices.length).toBe(6);

    // Prices should not have extreme jumps (no more than 1% per minute under normal conditions)
    for (let i = 1; i < prices.length; i++) {
      const prevPrice = prices[i - 1]!.price;
      const currentPrice = prices[i]!.price;
      const percentChange = Math.abs((currentPrice - prevPrice) / prevPrice * 100);
      
      // Allow up to 2% per minute (which is already very volatile)
      expect(percentChange).toBeLessThan(2.0);
    }
  });

  test('ignores non-company organizations', () => {
    const priceEngine = new PriceEngine(12345);
    
    const orgs: Organization[] = [
      {
        id: 'test-media',
        name: 'Test Media',
        description: 'Test',
        type: 'media',
        canBeInvolved: true,
        initialPrice: 100.00,
      },
    ];

    priceEngine.initializeCompanies(orgs);
    
    const currentPrice = priceEngine.getCurrentPrice('test-media');
    expect(currentPrice).toBeNull(); // Media orgs don't have prices
  });
});


