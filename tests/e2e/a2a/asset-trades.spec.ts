/**
 * E2E Tests for A2A Asset Trades Protocol Methods
 * 
 * Tests the a2a.getPredictionTrades, a2a.getPerpTrades, and a2a.getAssetTrades methods
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const A2A_ENDPOINT = `${API_BASE}/api/a2a`;

// Mock agent credentials for testing
const TEST_AGENT_ID = 'test-agent-123';
const TEST_AGENT_ADDRESS = '0xTestAgentAddress';
const TEST_AGENT_TOKEN_ID = '1';

test.describe('A2A Asset Trades Protocol', () => {
  let testMarketId: string;
  let testTicker: string;

  test.beforeAll(async () => {
    // Get test market ID
    const predictionsRes = await fetch(`${API_BASE}/api/markets/predictions`);
    const predictionsData = await predictionsRes.json();
    if (predictionsData.questions && predictionsData.questions.length > 0) {
      testMarketId = predictionsData.questions[0].id.toString();
    }

    // Get test ticker
    const perpsRes = await fetch(`${API_BASE}/api/markets/perps`);
    const perpsData = await perpsRes.json();
    if (perpsData.markets && perpsData.markets.length > 0) {
      testTicker = perpsData.markets[0].ticker;
    }
  });

  test('should fetch prediction trades via A2A protocol', async ({ request }) => {
    const response = await request.post(A2A_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': TEST_AGENT_ID,
        'x-agent-address': TEST_AGENT_ADDRESS,
        'x-agent-token-id': TEST_AGENT_TOKEN_ID,
      },
      data: {
        jsonrpc: '2.0',
        method: 'a2a.getPredictionTrades',
        params: {
          marketId: testMarketId,
          limit: 20,
        },
        id: 1,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Verify JSON-RPC 2.0 response
    expect(data.jsonrpc).toBe('2.0');
    expect(data.id).toBe(1);
    expect(data).toHaveProperty('result');

    // Verify result structure
    const result = data.result;
    expect(result).toHaveProperty('trades');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('hasMore');
    expect(result).toHaveProperty('marketId');
    expect(result.marketId).toBe(testMarketId);

    // Verify trades array
    expect(Array.isArray(result.trades)).toBeTruthy();
  });

  test('should fetch perp trades via A2A protocol', async ({ request }) => {
    const response = await request.post(A2A_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': TEST_AGENT_ID,
        'x-agent-address': TEST_AGENT_ADDRESS,
        'x-agent-token-id': TEST_AGENT_TOKEN_ID,
      },
      data: {
        jsonrpc: '2.0',
        method: 'a2a.getPerpTrades',
        params: {
          ticker: testTicker,
          limit: 20,
        },
        id: 2,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Verify JSON-RPC 2.0 response
    expect(data.jsonrpc).toBe('2.0');
    expect(data.id).toBe(2);
    expect(data).toHaveProperty('result');

    // Verify result structure
    const result = data.result;
    expect(result).toHaveProperty('trades');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('hasMore');
    expect(result).toHaveProperty('ticker');
    expect(result.ticker).toBe(testTicker);

    // Verify trades array
    expect(Array.isArray(result.trades)).toBeTruthy();
  });

  test('should fetch asset trades with automatic type detection', async ({ request }) => {
    // Test with prediction market ID (longer ID)
    const predictionResponse = await request.post(A2A_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': TEST_AGENT_ID,
        'x-agent-address': TEST_AGENT_ADDRESS,
        'x-agent-token-id': TEST_AGENT_TOKEN_ID,
      },
      data: {
        jsonrpc: '2.0',
        method: 'a2a.getAssetTrades',
        params: {
          assetId: testMarketId,
          limit: 10,
        },
        id: 3,
      },
    });

    expect(predictionResponse.ok()).toBeTruthy();
    const predData = await predictionResponse.json();
    expect(predData.result).toHaveProperty('marketType');
    expect(predData.result.marketType).toBe('prediction');

    // Test with perp ticker (shorter ID)
    const perpResponse = await request.post(A2A_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': TEST_AGENT_ID,
        'x-agent-address': TEST_AGENT_ADDRESS,
        'x-agent-token-id': TEST_AGENT_TOKEN_ID,
      },
      data: {
        jsonrpc: '2.0',
        method: 'a2a.getAssetTrades',
        params: {
          assetId: testTicker,
          limit: 10,
        },
        id: 4,
      },
    });

    expect(perpResponse.ok()).toBeTruthy();
    const perpData = await perpResponse.json();
    expect(perpData.result).toHaveProperty('marketType');
    expect(perpData.result.marketType).toBe('perp');
  });

  test('should respect pagination parameters', async ({ request }) => {
    const response = await request.post(A2A_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': TEST_AGENT_ID,
        'x-agent-address': TEST_AGENT_ADDRESS,
        'x-agent-token-id': TEST_AGENT_TOKEN_ID,
      },
      data: {
        jsonrpc: '2.0',
        method: 'a2a.getPredictionTrades',
        params: {
          marketId: testMarketId,
          limit: 5,
          offset: 0,
        },
        id: 5,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Should respect limit
    expect(data.result.trades.length).toBeLessThanOrEqual(5);
  });

  test('should return error for missing parameters', async ({ request }) => {
    const response = await request.post(A2A_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': TEST_AGENT_ID,
        'x-agent-address': TEST_AGENT_ADDRESS,
        'x-agent-token-id': TEST_AGENT_TOKEN_ID,
      },
      data: {
        jsonrpc: '2.0',
        method: 'a2a.getPredictionTrades',
        params: {
          // Missing marketId
          limit: 20,
        },
        id: 6,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Should have error
    expect(data).toHaveProperty('error');
    expect(data.error.code).toBe(-32602); // Invalid params error code
  });

  test('should return error for non-existent market', async ({ request }) => {
    const response = await request.post(A2A_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': TEST_AGENT_ID,
        'x-agent-address': TEST_AGENT_ADDRESS,
        'x-agent-token-id': TEST_AGENT_TOKEN_ID,
      },
      data: {
        jsonrpc: '2.0',
        method: 'a2a.getPredictionTrades',
        params: {
          marketId: 'nonexistent-market-id',
          limit: 20,
        },
        id: 7,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Should have error (internal error since the REST API returned 404)
    expect(data).toHaveProperty('error');
  });

  test('should handle rate limiting', async ({ request }) => {
    // Make many rapid requests to trigger rate limiting
    const requests = [];
    for (let i = 0; i < 150; i++) { // Exceeds 100 per minute limit
      requests.push(
        request.post(A2A_ENDPOINT, {
          headers: {
            'Content-Type': 'application/json',
            'x-agent-id': TEST_AGENT_ID,
            'x-agent-address': TEST_AGENT_ADDRESS,
            'x-agent-token-id': TEST_AGENT_TOKEN_ID,
          },
          data: {
            jsonrpc: '2.0',
            method: 'a2a.getPredictionTrades',
            params: {
              marketId: testMarketId,
              limit: 10,
            },
            id: i,
          },
        })
      );
    }

    const responses = await Promise.all(requests);

    // At least one should be rate limited (429)
    const rateLimited = responses.some(r => r.status() === 429);
    expect(rateLimited).toBeTruthy();

    // Check rate limit response format
    const rateLimitedResponse = responses.find(r => r.status() === 429);
    if (rateLimitedResponse) {
      const data = await rateLimitedResponse.json();
      expect(data).toHaveProperty('error');
      expect(data.error.code).toBe(-32099); // Rate limit exceeded code
    }
  });

  test('should allow agent to query trades without authentication errors', async ({ request }) => {
    // Verify that authenticated agents can successfully query trades
    const response = await request.post(A2A_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': TEST_AGENT_ID,
        'x-agent-address': TEST_AGENT_ADDRESS,
        'x-agent-token-id': TEST_AGENT_TOKEN_ID,
      },
      data: {
        jsonrpc: '2.0',
        method: 'a2a.getPerpTrades',
        params: {
          ticker: testTicker,
          limit: 10,
        },
        id: 8,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Should NOT have authentication error
    expect(data).toHaveProperty('result');
    expect(data).not.toHaveProperty('error');
  });

  test('should support explicit marketType in getAssetTrades', async ({ request }) => {
    const response = await request.post(A2A_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': TEST_AGENT_ID,
        'x-agent-address': TEST_AGENT_ADDRESS,
        'x-agent-token-id': TEST_AGENT_TOKEN_ID,
      },
      data: {
        jsonrpc: '2.0',
        method: 'a2a.getAssetTrades',
        params: {
          assetId: testMarketId,
          marketType: 'prediction', // Explicitly set
          limit: 10,
        },
        id: 9,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.result).toHaveProperty('marketType');
    expect(data.result.marketType).toBe('prediction');
    expect(data.result).toHaveProperty('marketId');
  });
});

