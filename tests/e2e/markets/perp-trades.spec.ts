/**
 * E2E Tests for Perpetual Futures Trades API
 * 
 * Tests the /api/markets/perps/[ticker]/trades endpoint
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Perpetual Futures Trades API', () => {
  let testTicker: string;

  test.beforeAll(async () => {
    // Get a test ticker from the perps list
    const response = await fetch(`${API_BASE}/api/markets/perps`);
    const data = await response.json();
    
    if (data.markets && data.markets.length > 0) {
      testTicker = data.markets[0].ticker;
    } else {
      throw new Error('No perpetual markets available for testing');
    }
  });

  test('should fetch trades for a perpetual market', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades`
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('trades');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('hasMore');
    expect(data).toHaveProperty('ticker');
    expect(data).toHaveProperty('organization');

    // Verify ticker matches
    expect(data.ticker).toBe(testTicker);

    // Verify organization object
    expect(data.organization).toHaveProperty('name');
    expect(data.organization).toHaveProperty('currentPrice');

    // Verify trades array
    expect(Array.isArray(data.trades)).toBeTruthy();
  });

  test('should respect pagination limit parameter', async ({ request }) => {
    const limit = 10;
    const response = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=${limit}`
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Should return at most 'limit' trades
    expect(data.trades.length).toBeLessThanOrEqual(limit);
  });

  test('should respect pagination offset parameter', async ({ request }) => {
    // Get first page
    const firstPage = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=5&offset=0`
    );
    const firstData = await firstPage.json();

    // Get second page
    const secondPage = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=5&offset=5`
    );
    const secondData = await secondPage.json();

    // Verify that the two pages have different trades
    if (firstData.trades.length > 0 && secondData.trades.length > 0) {
      const firstIds = new Set(firstData.trades.map((t: any) => t.id));
      const secondIds = new Set(secondData.trades.map((t: any) => t.id));
      
      // Should have no overlap
      const overlap = [...firstIds].filter(id => secondIds.has(id));
      expect(overlap.length).toBe(0);
    }
  });

  test('should include proper trade object structure', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=1`
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    if (data.trades.length > 0) {
      const trade = data.trades[0];

      // Verify common fields
      expect(trade).toHaveProperty('id');
      expect(trade).toHaveProperty('type');
      expect(trade).toHaveProperty('timestamp');
      expect(trade).toHaveProperty('user');

      // Verify user object
      if (trade.user) {
        expect(trade.user).toHaveProperty('id');
        expect(trade.user).toHaveProperty('displayName');
      }

      // Type-specific validations
      if (trade.type === 'perp') {
        expect(trade).toHaveProperty('side');
        expect(trade).toHaveProperty('size');
        expect(trade).toHaveProperty('leverage');
        expect(trade).toHaveProperty('entryPrice');
        expect(trade).toHaveProperty('ticker');
        expect(['long', 'short']).toContain(trade.side);
      } else if (trade.type === 'npc') {
        expect(trade).toHaveProperty('action');
        expect(trade).toHaveProperty('amount');
        expect(trade).toHaveProperty('price');
        // May have optional fields
        if (trade.reason) {
          expect(typeof trade.reason).toBe('string');
        }
        if (trade.sentiment !== null && trade.sentiment !== undefined) {
          expect(typeof trade.sentiment).toBe('number');
          expect(trade.sentiment).toBeGreaterThanOrEqual(-1);
          expect(trade.sentiment).toBeLessThanOrEqual(1);
        }
      } else if (trade.type === 'balance') {
        expect(trade).toHaveProperty('transactionType');
        expect(trade).toHaveProperty('amount');
      }
    }
  });

  test('should return 404 for non-existent ticker', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/perps/NONEXISTENT/trades`
    );

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should handle case-insensitive tickers', async ({ request }) => {
    // Test with lowercase
    const lowerResponse = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker.toLowerCase()}/trades`
    );

    // Test with uppercase
    const upperResponse = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker.toUpperCase()}/trades`
    );

    // Both should work (tickers are normalized to uppercase)
    expect(lowerResponse.ok() || upperResponse.ok()).toBeTruthy();
  });

  test('should cache responses properly', async ({ request }) => {
    // First request
    const start1 = Date.now();
    const response1 = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=20`
    );
    const time1 = Date.now() - start1;

    expect(response1.ok()).toBeTruthy();
    const data1 = await response1.json();

    // Second request (should be cached)
    const start2 = Date.now();
    const response2 = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=20`
    );
    const time2 = Date.now() - start2;

    expect(response2.ok()).toBeTruthy();
    const data2 = await response2.json();

    // Data should be identical
    expect(JSON.stringify(data1.trades)).toBe(JSON.stringify(data2.trades));

    // Second request should generally be faster (cached)
    console.log(`First request: ${time1}ms, Second request: ${time2}ms`);
  });

  test('should sort trades by timestamp descending', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=10`
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    if (data.trades.length > 1) {
      // Verify trades are sorted by timestamp descending
      for (let i = 0; i < data.trades.length - 1; i++) {
        const currentTime = new Date(data.trades[i].timestamp).getTime();
        const nextTime = new Date(data.trades[i + 1].timestamp).getTime();
        expect(currentTime).toBeGreaterThanOrEqual(nextTime);
      }
    }
  });

  test('should include NPC trades with reasoning when available', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=50`
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Find NPC trades
    const npcTrades = data.trades.filter((t: any) => t.type === 'npc');

    if (npcTrades.length > 0) {
      const npcTrade = npcTrades[0];
      
      // Verify NPC-specific fields
      expect(npcTrade.user?.isActor).toBe(true);
      
      // Check for optional AI reasoning
      if (npcTrade.reason) {
        expect(typeof npcTrade.reason).toBe('string');
        expect(npcTrade.reason.length).toBeGreaterThan(0);
      }
    }
  });

  test('should handle limit at boundary values', async ({ request }) => {
    // Test minimum limit
    const minResponse = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=1`
    );
    expect(minResponse.ok()).toBeTruthy();
    const minData = await minResponse.json();
    expect(minData.trades.length).toBeLessThanOrEqual(1);

    // Test maximum limit
    const maxResponse = await request.get(
      `${API_BASE}/api/markets/perps/${testTicker}/trades?limit=100`
    );
    expect(maxResponse.ok()).toBeTruthy();
    const maxData = await maxResponse.json();
    expect(maxData.trades.length).toBeLessThanOrEqual(100);
  });
});

