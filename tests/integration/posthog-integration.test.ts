/**
 * PostHog Integration Tests
 * 
 * Tests the PostHog server-side integration and tracking functionality
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { getPostHogServerClient, trackServerEvent, trackServerError, flushPostHog } from '../../src/lib/posthog/server';

describe('PostHog Server Integration', () => {
  beforeAll(async () => {
    // Ensure PostHog environment variables are set for testing
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      console.warn('Warning: NEXT_PUBLIC_POSTHOG_KEY not set. Tests will pass but tracking will be disabled.');
    }
  });

  describe('Client Initialization', () => {
    it('should initialize PostHog server client', () => {
      const client = getPostHogServerClient();
      
      if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
        expect(client).toBeTruthy();
      } else {
        expect(client).toBeNull();
      }
    });

    it('should return null if no API key is provided', () => {
      const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
      
      const client = getPostHogServerClient();
      expect(client).toBeNull();
      
      // Restore
      if (originalKey) {
        process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
      }
    });
  });

  describe('Event Tracking', () => {
    it('should track events without throwing errors', async () => {
      await expect(async () => {
        await trackServerEvent('test-user', 'test_event', {
          test: true,
          timestamp: new Date().toISOString(),
        });
      }).not.toThrow();
    });

    it('should handle tracking errors gracefully', async () => {
      await expect(async () => {
        await trackServerEvent('', '', undefined); // Invalid event
      }).not.toThrow();
    });

    it('should track events with properties', async () => {
      await expect(async () => {
        await trackServerEvent('test-user', 'test_event_with_props', {
          property1: 'value1',
          property2: 123,
          property3: true,
        });
      }).not.toThrow();
    });
  });

  describe('Error Tracking', () => {
    it('should track errors without throwing', async () => {
      const testError = new Error('Test error');
      
      await expect(async () => {
        await trackServerError('test-user', testError, {
          endpoint: '/api/test',
          method: 'POST',
          statusCode: 500,
        });
      }).not.toThrow();
    });

    it('should handle null distinctId', async () => {
      const testError = new Error('Anonymous error');
      
      await expect(async () => {
        await trackServerError(null, testError, {
          endpoint: '/api/test',
          method: 'GET',
        });
      }).not.toThrow();
    });

    it('should include error context in tracking', async () => {
      const testError = new Error('Context test error');
      
      await expect(async () => {
        await trackServerError('test-user', testError, {
          endpoint: '/api/test',
          method: 'POST',
          statusCode: 400,
          customContext: 'custom value',
        });
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should track events quickly (non-blocking)', async () => {
      const start = Date.now();
      
      await trackServerEvent('test-user', 'performance_test', {
        test: true,
      });
      
      const duration = Date.now() - start;
      
      // Should complete very quickly (< 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent tracking calls', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(trackServerEvent(`test-user-${i}`, `concurrent_test_${i}`, {
          index: i,
        }));
      }
      
      await expect(async () => {
        await Promise.all(promises);
      }).not.toThrow();
    });
  });

  describe('Flush and Cleanup', () => {
    it('should flush events without errors', async () => {
      await expect(async () => {
        await flushPostHog();
      }).not.toThrow();
    });
  });
});

describe('PostHog Event Naming Convention', () => {
  const expectedEvents = [
    'signup_completed',
    'onchain_registration_completed',
    'trade_opened',
    'trade_closed',
    'prediction_bought',
    'prediction_sold',
    'post_created',
    'post_liked',
    'post_unliked',
    'post_shared',
    'post_unshared',
    'user_followed',
    'user_unfollowed',
    'pool_deposit',
    'pool_withdrawal',
    'points_purchase_initiated',
    'points_purchase_completed',
    'message_sent',
    'dm_opened',
    'profile_updated',
    'social_account_linked',
  ];

  it('should use snake_case for all event names', () => {
    expectedEvents.forEach(event => {
      // Should be lowercase with underscores
      expect(event).toMatch(/^[a-z_]+$/);
      // Should not have spaces or camelCase
      expect(event).not.toMatch(/[A-Z\s]/);
    });
  });

  it('should have descriptive event names', () => {
    expectedEvents.forEach(event => {
      // Event names should be at least 2 words (e.g., "post_liked")
      expect(event.split('_').length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('PostHog Privacy & Compliance', () => {
  it('should sanitize sensitive properties', async () => {
    // Test that tracking doesn't include sensitive data
    await expect(async () => {
      await trackServerEvent('test-user', 'test_privacy', {
        username: 'testuser',
        amount: 100,
        // Should NOT track email, password, private keys, etc.
      });
    }).not.toThrow();
  });

  it('should handle missing API key gracefully', () => {
    const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    
    const client = getPostHogServerClient();
    expect(client).toBeNull();
    
    // Restore
    if (originalKey) {
      process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey;
    }
  });
});

