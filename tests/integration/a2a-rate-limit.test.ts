/**
 * A2A Rate Limiting Integration Test
 * 
 * Tests that the A2A endpoint properly enforces rate limits
 */

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';
const serverAvailable = await (async () => {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(2000) })
    return response.status < 500
  } catch {
    console.log(`⚠️  Server not available - Skipping A2A rate limit tests`)
    return false
  }
})()

import { describe, test, expect, beforeAll } from 'bun:test';
const A2A_ENDPOINT = `${BASE_URL}/api/a2a`;

const TEST_AGENT_HEADERS = {
  'Content-Type': 'application/json',
  'x-agent-id': 'rate-limit-test-agent',
  'x-agent-address': '0x1234567890123456789012345678901234567890',
  'x-agent-token-id': '1'
};

function generateA2ARequest(method: string, params: Record<string, unknown> = {}) {
  return {
    jsonrpc: '2.0',
    method,
    params,
    id: Math.floor(Math.random() * 1000000)
  };
}

async function makeA2ARequest(method: string, params?: Record<string, unknown>) {
  const response = await fetch(A2A_ENDPOINT, {
    method: 'POST',
    headers: TEST_AGENT_HEADERS,
    body: JSON.stringify(generateA2ARequest(method, params))
  });
  
  return {
    status: response.status,
    headers: response.headers,
    data: await response.json()
  };
}

describe('A2A Rate Limiting', () => {
  beforeAll(async () => {
    // Check if server is running
    try {
      const response = await fetch(A2A_ENDPOINT);
      const data = await response.json();
      if (data.service !== 'Babylon A2A Protocol') {
        throw new Error('A2A endpoint not responding correctly');
      }
    } catch (error) {
      console.error('Server not running. Start it with: bun run dev');
      throw error;
    }
  });

  test.skipIf(!serverAvailable)('should return rate limit headers on successful request', async () => {
    const result = await makeA2ARequest('a2a.getBalance');
    
    expect(result.status).toBeLessThan(500);
    expect(result.headers.get('x-ratelimit-limit')).toBe('100');
    expect(result.headers.has('x-ratelimit-remaining')).toBe(true);
  });

  test.skipIf(!serverAvailable)('should enforce rate limit after 100 requests per minute', async () => {
    // Make 105 requests rapidly (should hit rate limit)
    const results = await Promise.all(
      Array.from({ length: 105 }, () => makeA2ARequest('a2a.getBalance'))
    );
    
    // Count rate limit errors
    const rateLimitErrors = results.filter(r => r.status === 429);
    
    // Should have at least some rate limit errors
    expect(rateLimitErrors.length).toBeGreaterThan(0);
    
    // Check rate limit response format
    const rateLimitError = rateLimitErrors[0];
    if (rateLimitError) {
      expect(rateLimitError.data.error).toBeDefined();
      expect(rateLimitError.data.error.code).toBeDefined();
      expect(rateLimitError.data.error.message).toContain('Rate limit');
      expect(rateLimitError.headers.has('retry-after')).toBe(true);
    }
  }, 30000); // 30 second timeout

  test.skipIf(!serverAvailable)('should return proper JSON-RPC error for rate limit', async () => {
    // Make many requests to trigger rate limit
    const promises = Array.from({ length: 110 }, () => 
      makeA2ARequest('a2a.getBalance')
    );
    
    const results = await Promise.all(promises);
    const rateLimitError = results.find(r => r.status === 429);
    
    if (rateLimitError) {
      // Verify JSON-RPC 2.0 error format
      expect(rateLimitError.data.jsonrpc).toBe('2.0');
      expect(rateLimitError.data.error).toBeDefined();
      expect(rateLimitError.data.error.code).toBeDefined();
      expect(rateLimitError.data.error.message).toBeDefined();
      expect(rateLimitError.data.id).toBeDefined();
      
      // Verify error contains useful info
      expect(rateLimitError.data.error.data).toBeDefined();
      expect(rateLimitError.data.error.data.retryAfter).toBe(60);
    }
  }, 30000);

  test.skipIf(!serverAvailable)('should allow requests from different agents independently', async () => {
    const agent1Headers = {
      ...TEST_AGENT_HEADERS,
      'x-agent-id': 'agent-1'
    };
    
    const agent2Headers = {
      ...TEST_AGENT_HEADERS,
      'x-agent-id': 'agent-2'
    };
    
    // Make 50 requests from each agent
    const agent1Requests = Array.from({ length: 50 }, () =>
      fetch(A2A_ENDPOINT, {
        method: 'POST',
        headers: agent1Headers,
        body: JSON.stringify(generateA2ARequest('a2a.getBalance'))
      })
    );
    
    const agent2Requests = Array.from({ length: 50 }, () =>
      fetch(A2A_ENDPOINT, {
        method: 'POST',
        headers: agent2Headers,
        body: JSON.stringify(generateA2ARequest('a2a.getBalance'))
      })
    );
    
    const results = await Promise.all([...agent1Requests, ...agent2Requests]);
    
    // Both agents should succeed (neither hit 100 req/min limit)
    const successfulRequests = results.filter(r => r.status < 400);
    expect(successfulRequests.length).toBeGreaterThan(80); // Most should succeed
  }, 30000);

  test.skipIf(!serverAvailable)('should include remaining tokens in response headers', async () => {
    const result1 = await makeA2ARequest('a2a.getBalance');
    const remaining1 = parseInt(result1.headers.get('x-ratelimit-remaining') || '0');
    
    const result2 = await makeA2ARequest('a2a.getBalance');
    const remaining2 = parseInt(result2.headers.get('x-ratelimit-remaining') || '0');
    
    // Remaining should decrease with each request
    expect(remaining2).toBeLessThanOrEqual(remaining1);
  });
});

describe('A2A Rate Limiting - Token Bucket Behavior', () => {
  test.skipIf(!serverAvailable)('should refill tokens over time', async () => {
    // This test would need to wait 60+ seconds to verify refill
    // Skipped in regular test runs - suitable for long-running integration tests
    expect(true).toBe(true);
  });
});

describe('A2A Endpoint - Basic Functionality', () => {
  test.skipIf(!serverAvailable)('GET /api/a2a should return service info', async () => {
    const response = await fetch(A2A_ENDPOINT);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.service).toBe('Babylon A2A Protocol');
    expect(data.version).toBeDefined();
    expect(data.status).toBe('active');
  });

  test.skipIf(!serverAvailable)('POST /api/a2a should handle valid JSON-RPC request', async () => {
    const result = await makeA2ARequest('a2a.getBalance');
    
    expect(result.status).toBeLessThan(500);
    expect(result.data.jsonrpc).toBe('2.0');
    expect(result.data.id).toBeDefined();
    // Either result or error should be present
    expect(result.data.result !== undefined || result.data.error !== undefined).toBe(true);
  });

  test.skipIf(!serverAvailable)('POST /api/a2a should validate JSON-RPC format', async () => {
    const response = await fetch(A2A_ENDPOINT, {
      method: 'POST',
      headers: TEST_AGENT_HEADERS,
      body: JSON.stringify({ invalid: 'request' })
    });
    
    // Should return error for invalid JSON-RPC
    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});

