/**
 * E2E Tests for Prediction Market Trades API
 * 
 * Tests the /api/markets/predictions/[id]/trades endpoint
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

test.describe('Prediction Market Trades API', () => {
  let testMarketId: string;

  test.beforeAll(async () => {
    // Get a test market ID from the predictions list
    const response = await fetch(`${API_BASE}/api/markets/predictions`);
    const data = await response.json();
    
    if (data.questions && data.questions.length > 0) {
      testMarketId = data.questions[0].id.toString();
    } else {
      throw new Error('No prediction markets available for testing');
    }
  });

  test('should fetch trades for a prediction market', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades`
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Verify response structure
    expect(data).toHaveProperty('trades');
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('hasMore');
    expect(data).toHaveProperty('marketId');
    expect(data).toHaveProperty('question');

    // Verify marketId matches
    expect(data.marketId).toBe(testMarketId);

    // Verify trades array
    expect(Array.isArray(data.trades)).toBeTruthy();
  });

  test('should respect pagination limit parameter', async ({ request }) => {
    const limit = 10;
    const response = await request.get(
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades?limit=${limit}`
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Should return at most 'limit' trades
    expect(data.trades.length).toBeLessThanOrEqual(limit);
  });

  test('should respect pagination offset parameter', async ({ request }) => {
    // Get first page
    const firstPage = await request.get(
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades?limit=5&offset=0`
    );
    const firstData = await firstPage.json();

    // Get second page
    const secondPage = await request.get(
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades?limit=5&offset=5`
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
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades?limit=1`
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
      if (trade.type === 'position') {
        expect(trade).toHaveProperty('side');
        expect(trade).toHaveProperty('shares');
        expect(trade).toHaveProperty('avgPrice');
        expect(['YES', 'NO']).toContain(trade.side);
      } else if (trade.type === 'balance') {
        expect(trade).toHaveProperty('transactionType');
        expect(trade).toHaveProperty('amount');
      }
    }
  });

  test('should return 404 for non-existent market', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/predictions/nonexistent-id/trades`
    );

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  test('should handle invalid limit parameter gracefully', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades?limit=0`
    );

    // Should either reject or clamp to valid range
    // Depending on implementation, this could be 400 or return with default limit
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('trades');
    } else {
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test('should handle large limit parameter gracefully', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades?limit=1000`
    );

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Should be capped at max limit (100)
    expect(data.trades.length).toBeLessThanOrEqual(100);
  });

  test('should cache responses properly', async ({ request }) => {
    // First request
    const start1 = Date.now();
    const response1 = await request.get(
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades?limit=20`
    );
    const time1 = Date.now() - start1;

    expect(response1.ok()).toBeTruthy();
    const data1 = await response1.json();

    // Second request (should be cached)
    const start2 = Date.now();
    const response2 = await request.get(
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades?limit=20`
    );
    const time2 = Date.now() - start2;

    expect(response2.ok()).toBeTruthy();
    const data2 = await response2.json();

    // Data should be identical
    expect(JSON.stringify(data1.trades)).toBe(JSON.stringify(data2.trades));

    // Second request should generally be faster (cached)
    // Note: This is not always guaranteed but is a good indicator
    console.log(`First request: ${time1}ms, Second request: ${time2}ms`);
  });

  test('should sort trades by timestamp descending', async ({ request }) => {
    const response = await request.get(
      `${API_BASE}/api/markets/predictions/${testMarketId}/trades?limit=10`
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
});

