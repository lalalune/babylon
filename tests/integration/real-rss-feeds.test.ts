/**
 * Real RSS Feed Integration Tests
 * Tests actual RSS feeds from real sources to ensure parsing works
 */

import { describe, test, expect } from 'bun:test';
import { rssFeedService } from '@/lib/services/rss-feed-service';

describe('Real RSS Feed Integration', () => {
  test('should successfully fetch and parse New York Times Technology RSS', async () => {
    const feed = await rssFeedService.fetchFeed(
      'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml'
    );

    expect(feed).toBeDefined();
    expect(feed.title).toBeDefined();
    expect(feed.items).toBeDefined();
    expect(Array.isArray(feed.items)).toBe(true);
    expect(feed.items.length).toBeGreaterThan(0);

    // Verify first item has required fields
    const firstItem = feed.items[0];
    expect(firstItem?.title).toBeDefined();
    expect(typeof firstItem?.title).toBe('string');
    expect(firstItem?.title.length).toBeGreaterThan(0);
  }, { timeout: 30000 }); // 30 second timeout for network request

  test('should successfully fetch and parse TechCrunch RSS', async () => {
    const feed = await rssFeedService.fetchFeed('https://techcrunch.com/feed/');

    expect(feed).toBeDefined();
    expect(feed.items).toBeDefined();
    expect(feed.items.length).toBeGreaterThan(0);

    const firstItem = feed.items[0];
    expect(firstItem?.title).toBeDefined();
    expect(firstItem?.link).toBeDefined();
  }, { timeout: 30000 });

  test('should successfully fetch and parse The Verge RSS', async () => {
    const feed = await rssFeedService.fetchFeed('https://www.theverge.com/rss/index.xml');

    expect(feed).toBeDefined();
    expect(feed.items.length).toBeGreaterThan(0);

    const firstItem = feed.items[0];
    expect(firstItem?.title).toBeDefined();
  }, { timeout: 30000 });

  test('should successfully fetch and parse CoinDesk RSS', async () => {
    const feed = await rssFeedService.fetchFeed(
      'https://www.coindesk.com/arc/outboundfeeds/rss/'
    );

    expect(feed).toBeDefined();
    expect(feed.items.length).toBeGreaterThan(0);

    const firstItem = feed.items[0];
    expect(firstItem?.title).toBeDefined();
  }, { timeout: 30000 });

  test('should handle different RSS formats without errors', async () => {
    // Test multiple feeds in parallel to verify they all work
    const feedUrls = [
      'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
      'https://techcrunch.com/feed/',
      'https://www.theverge.com/rss/index.xml',
    ];

    const results = await Promise.allSettled(
      feedUrls.map(url => rssFeedService.fetchFeed(url))
    );

    // At least 2 of 3 should succeed (accounts for occasional network issues)
    const successful = results.filter(r => r.status === 'fulfilled');
    expect(successful.length).toBeGreaterThanOrEqual(2);

    // Verify successful feeds have valid data
    successful.forEach(result => {
      if (result.status === 'fulfilled') {
        expect(result.value.items.length).toBeGreaterThan(0);
      }
    });
  }, { timeout: 60000 });
});

