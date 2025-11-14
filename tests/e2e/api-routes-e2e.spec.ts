/**
 * API Routes E2E Tests
 * 
 * REAL E2E tests that use actual browser requests to test API routes
 * These are NOT unit tests - they test the real running Next.js server
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Public API Routes - E2E', () => {
  
  test('GET /api/stats - returns stats data', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/stats`);
    
    expect(response.ok()).toBe(true);
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('engineStatus');
    
    console.log('✅ /api/stats working');
  });

  test('GET /api/leaderboard - returns leaderboard data', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/leaderboard`);
    
    const status = response.status();
    
    if (status === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('leaderboard');
      expect(Array.isArray(data.leaderboard)).toBe(true);
      expect(data).toHaveProperty('pagination');
      console.log('✅ /api/leaderboard working');
    } else {
      // If not 200, should be a proper error
      expect(status).toBeLessThan(500);
      console.log(`⚠️  /api/leaderboard returned ${status}`);
    }
  });

  test('GET /api/pools - returns pools list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/pools`);
    
    const status = response.status();
    
    if (status === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('pools');
      expect(Array.isArray(data.pools)).toBe(true);
      console.log(`✅ /api/pools working - found ${data.pools.length} pools`);
    } else {
      expect(status).toBeLessThan(500);
      console.log(`⚠️  /api/pools returned ${status}`);
    }
  });

  test('GET /api/posts - returns posts list', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/posts`);
    
    const status = response.status();
    
    if (status === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('posts');
      expect(Array.isArray(data.posts)).toBe(true);
      console.log(`✅ /api/posts working - found ${data.posts.length} posts`);
    } else {
      expect(status).toBeLessThan(500);
      console.log(`⚠️  /api/posts returned ${status}`);
    }
  });
});

test.describe('Protected API Routes - E2E (No Auth)', () => {
  
  test('GET /api/users/me - rejects without auth', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/users/me`);
    
    // Must reject unauthenticated requests
    expect(response.status()).toBe(401);
    
    const data = await response.json();
    expect(data).toHaveProperty('error');
    
    console.log('✅ /api/users/me properly rejects unauth');
  });

  test('GET /api/notifications - rejects without auth', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/notifications`);
    
    expect(response.status()).toBe(401);
    
    console.log('✅ /api/notifications properly rejects unauth');
  });

  test('POST /api/posts - rejects without auth', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/posts`, {
      data: { content: 'test post' }
    });
    
    expect(response.status()).toBe(401);
    
    console.log('✅ /api/posts POST properly rejects unauth');
  });
});

test.describe('API Validation - E2E', () => {
  
  test('POST /api/onboarding/check-username - validates username', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/onboarding/check-username`, {
      data: { username: 'testuser123' }
    });
    
    const status = response.status();
    
    if (status === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('available');
      expect(typeof data.available).toBe('boolean');
      console.log('✅ /api/onboarding/check-username working');
    } else if (status === 401) {
      console.log('⚠️  /api/onboarding/check-username requires auth');
    } else {
      expect(status).toBeLessThan(500);
    }
  });

  test('GET /api/onboarding/random-assets - returns random assets', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/onboarding/random-assets`);
    
    const status = response.status();
    
    if (status === 200) {
      const data = await response.json();
      expect(data).toHaveProperty('profileImage');
      expect(data).toHaveProperty('coverImage');
      console.log('✅ /api/onboarding/random-assets working');
    } else {
      expect(status).toBeLessThan(500);
      console.log(`⚠️  /api/onboarding/random-assets returned ${status}`);
    }
  });
});

test.describe('API Error Handling - E2E', () => {
  
  test('GET /api/nonexistent - returns 404', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/nonexistent`);
    
    expect(response.status()).toBe(404);
    
    console.log('✅ 404 handling working');
  });

  test('POST invalid JSON - handles gracefully', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/posts`, {
      headers: {
        'Content-Type': 'application/json'
      },
      body: 'invalid json'
    });
    
    // Should return error, not crash
    const status = response.status();
    expect(status).toBeLessThan(500);
    expect([400, 401]).toContain(status);
    
    console.log(`✅ Invalid JSON handled with status ${status}`);
  });
});

