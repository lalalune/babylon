/**
 * RSS Feed Service Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { rssFeedService } from '@/lib/services/rss-feed-service';
import { generateSnowflakeId } from '@/lib/snowflake';

describe('RSSFeedService', () => {
  const testFeedId = 'test-feed-' + Date.now();

  beforeEach(async () => {
    // Create test feed source
    await prisma.rSSFeedSource.create({
      data: {
        id: testFeedId,
        name: 'Test Feed',
        feedUrl: 'https://example.com/test-feed.xml',
        category: 'test',
        isActive: false, // Inactive to prevent actual fetching
      },
    });
  });

  afterEach(async () => {
    // Cleanup test data
    await prisma.rSSHeadline.deleteMany({
      where: {
        sourceId: testFeedId,
      },
    });

    await prisma.rSSFeedSource.deleteMany({
      where: {
        id: testFeedId,
      },
    });
  });

  test('should get untransformed headlines', async () => {
    // Create test headline
    const headlineId = await generateSnowflakeId();
    await prisma.rSSHeadline.create({
      data: {
        id: headlineId,
        sourceId: testFeedId,
        title: 'Test Headline',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      },
    });

    const headlines = await rssFeedService.getUntransformedHeadlines(10);

    expect(headlines).toBeDefined();
    expect(Array.isArray(headlines)).toBe(true);
    expect(headlines.some(h => h.id === headlineId)).toBe(true);
  });

  test('should cleanup old headlines', async () => {
    // Create old headline (8 days ago)
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 8);

    const oldHeadlineId = await generateSnowflakeId();
    await prisma.rSSHeadline.create({
      data: {
        id: oldHeadlineId,
        sourceId: testFeedId,
        title: 'Old Headline',
        publishedAt: oldDate,
        fetchedAt: oldDate,
      },
    });

    // Create recent headline
    const recentHeadlineId = await generateSnowflakeId();
    await prisma.rSSHeadline.create({
      data: {
        id: recentHeadlineId,
        sourceId: testFeedId,
        title: 'Recent Headline',
        publishedAt: new Date(),
        fetchedAt: new Date(),
      },
    });

    const deletedCount = await rssFeedService.cleanupOldHeadlines();

    expect(deletedCount).toBeGreaterThanOrEqual(1);

    // Verify old headline is deleted
    const oldHeadline = await prisma.rSSHeadline.findUnique({
      where: { id: oldHeadlineId },
    });
    expect(oldHeadline).toBeNull();

    // Verify recent headline still exists
    const recentHeadline = await prisma.rSSHeadline.findUnique({
      where: { id: recentHeadlineId },
    });
    expect(recentHeadline).not.toBeNull();
  });

  test('should parse RSS 2.0 format', async () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Test Item 1</title>
      <link>https://example.com/item1</link>
      <pubDate>Wed, 13 Nov 2024 12:00:00 GMT</pubDate>
      <description>Test description</description>
    </item>
    <item>
      <title>Test Item 2</title>
      <link>https://example.com/item2</link>
    </item>
  </channel>
</rss>`;

    // Mock fetch for this test
    const originalFetch = global.fetch;
    global.fetch = Object.assign(
      async () => ({
        ok: true,
        text: async () => rssXml,
      }) as Response,
      { preconnect: originalFetch.preconnect }
    );

    try {
      const feed = await rssFeedService.fetchFeed('https://example.com/test.xml');

      expect(feed).toBeDefined();
      expect(feed.title).toBe('Test Feed');
      expect(feed.items).toHaveLength(2);
      expect(feed.items[0]?.title).toBe('Test Item 1');
      expect(feed.items[0]?.link).toBe('https://example.com/item1');
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('should handle fetch errors gracefully', async () => {
    // Mock fetch to fail
    const originalFetch = global.fetch;
    global.fetch = Object.assign(
      async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }) as Response,
      { preconnect: originalFetch.preconnect }
    );

    try {
      await expect(
        rssFeedService.fetchFeed('https://example.com/nonexistent.xml')
      ).rejects.toThrow();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

