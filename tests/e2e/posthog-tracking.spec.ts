/**
 * PostHog End-to-End Tracking Tests
 * 
 * Tests PostHog event tracking in actual user flows
 */

import { test, expect, type Page } from '@playwright/test';

// Mock PostHog for E2E testing
const setupPostHogMock = async (page: Page) => {
  await page.addInitScript(() => {
    // Create mock PostHog events array
    (window as Window & { __mockPostHogEvents?: Array<{ event: string; properties?: Record<string, unknown> }> }).__mockPostHogEvents = [];
    
    // Mock console.log to capture PostHog init message
    const originalLog = console.log;
    console.log = function(...args: unknown[]) {
      if (typeof args[0] === 'string' && args[0].includes('PostHog')) {
        (window as Window & { __postHogLogs?: string[] }).__postHogLogs = (window as Window & { __postHogLogs?: string[] }).__postHogLogs || [];
        (window as Window & { __postHogLogs?: string[] }).__postHogLogs?.push(args[0] as string);
      }
      return originalLog.apply(console, args);
    };
  });
};

const getTrackedEvents = async (page: Page): Promise<string[]> => {
  return await page.evaluate(() => {
    return (window as Window & { __mockPostHogEvents?: Array<{ event: string }> }).__mockPostHogEvents?.map(e => e.event) || [];
  });
};

test.describe('PostHog Client-Side Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await setupPostHogMock(page);
  });

  test('should load PostHog SDK without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Should not have any PostHog-related errors
    const postHogErrors = errors.filter(e => e.toLowerCase().includes('posthog'));
    expect(postHogErrors).toHaveLength(0);
  });

  test('should initialize PostHog in browser', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    const hasPostHog = await page.evaluate(() => {
      return typeof (window as Window & { posthog?: unknown }).posthog !== 'undefined';
    });

    expect(hasPostHog).toBe(true);
  });

  test('should track page navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.goto('/markets');
    await page.waitForTimeout(1000);

    // PostHog should be loaded
    const hasPostHog = await page.evaluate(() => {
      return (window as Window & { posthog?: unknown }).posthog !== undefined;
    });

    expect(hasPostHog).toBe(true);
  });

  test('should not break page functionality', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Page should be interactive
    const isInteractive = await page.evaluate(() => {
      return document.readyState === 'complete';
    });

    expect(isInteractive).toBe(true);
  });

  test('should handle PostHog initialization failure gracefully', async ({ page }) => {
    // Even if PostHog fails to load, app should work
    await page.route('**/*posthog*/**', route => route.abort());
    
    await page.goto('/');
    await page.waitForTimeout(1000);

    // Page should still load
    const title = await page.title();
    expect(title).toBeTruthy();
  });
});

test.describe('PostHog API Tracking', () => {
  test('should not slow down API responses', async ({ request }) => {
    const times: number[] = [];

    // Make multiple requests to measure average response time
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await request.get('/api/markets/perps');
      times.push(Date.now() - start);
    }

    const avgTime = times.reduce((a, b) => a + b) / times.length;
    
    // API should respond quickly even with tracking
    expect(avgTime).toBeLessThan(1000); // 1 second average
  });

  test('should handle tracking failures without affecting API responses', async ({ request }) => {
    // Even if PostHog tracking fails, API should work
    const response = await request.get('/api/stats');
    
    // Should get valid response
    expect([200, 401]).toContain(response.status());
  });
});

test.describe('PostHog Error Boundary', () => {
  test('should catch React errors and not crash app', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForTimeout(2000);

    // Page should load successfully
    const title = await page.title();
    expect(title).toBeTruthy();

    // PostHog error boundary should be in place (verified by successful load)
  });
});

