/**
 * RSS Feed Service
 * 
 * Fetches and parses RSS feeds from news sources without requiring API keys.
 * Uses standard RSS/Atom feed formats that are publicly available.
 * 
 * @module services/rss-feed-service
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import type { Prisma, RSSHeadline } from '@prisma/client';
import { parseStringPromise } from 'xml2js';

type Xml2JsFeed = {
  rss?: {
    channel?: Array<{
      title?: string[];
      item?: Record<string, unknown>[];
    }>;
  };
  feed?: {
    title?: string[];
    entry?: Record<string, unknown>[];
  };
};

export interface RSSFeedItem {
  title: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
  guid?: string;
}

export interface ParsedFeed {
  title: string;
  items: RSSFeedItem[];
}

/**
 * RSS Feed Service
 * Handles fetching, parsing, and storing RSS feed data
 */
export class RSSFeedService {
  /**
   * Fetch and parse RSS feed from URL with exponential retry
   */
  async fetchFeed(url: string, maxRetries = 3): Promise<ParsedFeed> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Exponential backoff: 1s, 2s, 4s
        if (attempt > 0) {
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          logger.info(
            `Retrying RSS feed fetch (attempt ${attempt + 1}/${maxRetries})`,
            { url, delayMs },
            'RSSFeedService'
          );
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; BabylonBot/1.0)',
          },
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlText = await response.text();
        const parsed = (await parseStringPromise(xmlText)) as Xml2JsFeed;

      // Handle RSS 2.0 format
      if (parsed.rss?.channel?.[0]) {
        const channel = parsed.rss.channel[0];
        return {
          title: channel.title?.[0] || 'Unknown Feed',
          items: (channel.item || []).map((item: Record<string, unknown>) => ({
            title: Array.isArray(item.title) ? item.title[0] : item.title || '',
            link: Array.isArray(item.link) ? item.link[0] : item.link,
            pubDate: Array.isArray(item.pubDate) ? item.pubDate[0] : item.pubDate,
            description: Array.isArray(item.description) ? item.description[0] : item.description,
            content: Array.isArray(item['content:encoded']) 
              ? item['content:encoded'][0] 
              : item['content:encoded'],
            guid: Array.isArray(item.guid) 
              ? (typeof item.guid[0] === 'object' && item.guid[0]?._ ? item.guid[0]._ : item.guid[0])
              : item.guid,
          })),
        };
      }

      // Handle Atom format
      if (parsed.feed?.entry) {
        return {
          title: parsed.feed.title?.[0] || 'Unknown Feed',
          items: (parsed.feed.entry || []).map((entry: Record<string, unknown>) => ({
            title: Array.isArray(entry.title) ? entry.title[0] : entry.title || '',
            link: Array.isArray(entry.link) && entry.link[0]?.$ 
              ? entry.link[0].$.href 
              : undefined,
            pubDate: Array.isArray(entry.published) ? entry.published[0] : entry.published,
            description: Array.isArray(entry.summary) ? entry.summary[0] : entry.summary,
            content: Array.isArray(entry.content) ? entry.content[0] : entry.content,
            guid: Array.isArray(entry.id) ? entry.id[0] : entry.id,
          })),
        };
      }

      throw new Error('Unknown feed format');
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries - 1) {
          // Last attempt failed
          logger.error(
            `Failed to fetch RSS feed after ${maxRetries} attempts`,
            { url, error },
            'RSSFeedService'
          );
          throw lastError;
        }
        
        // Log retry
        logger.warn(
          `RSS feed fetch failed, will retry`,
          { url, attempt: attempt + 1, error: (error as Error).message },
          'RSSFeedService'
        );
      }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError || new Error('Failed to fetch RSS feed');
  }

  /**
   * Fetch all active RSS feeds and store new headlines
   */
  async fetchAllFeeds(): Promise<{ fetched: number; stored: number; errors: number }> {
    const sources = await prisma.rSSFeedSource.findMany({
      where: { isActive: true },
    });

    logger.info(`Fetching ${sources.length} RSS feeds`, undefined, 'RSSFeedService');

    let fetched = 0;
    let stored = 0;
    let errors = 0;

    for (const source of sources) {
      try {
        const feed = await this.fetchFeed(source.feedUrl);
        fetched++;

        // Store new headlines (check by link to avoid duplicates)
        for (const item of feed.items) {
          if (!item.title) continue;

          // Check if we already have this headline
          const existing = item.link
            ? await prisma.rSSHeadline.findFirst({
                where: { link: item.link },
              })
            : null;

          if (existing) continue;

          const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

          await prisma.rSSHeadline.create({
            data: {
              id: await generateSnowflakeId(),
              sourceId: source.id,
              title: item.title,
              link: item.link || null,
              publishedAt,
              summary: item.description || null,
              content: item.content || null,
              rawData: item as unknown as Prisma.InputJsonValue,
              fetchedAt: new Date(),
            },
          });

          stored++;
        }

        // Update last fetched timestamp
        await prisma.rSSFeedSource.update({
          where: { id: source.id },
          data: {
            lastFetched: new Date(),
            fetchErrors: 0,
          },
        });
      } catch (error) {
        errors++;
        logger.error(
          `Failed to fetch RSS feed: ${source.name}`,
          { source: source.name, url: source.feedUrl, error },
          'RSSFeedService'
        );

        // Increment error counter
        await prisma.rSSFeedSource.update({
          where: { id: source.id },
          data: {
            fetchErrors: { increment: 1 },
          },
        });
      }
    }

    logger.info(
      `RSS fetch complete: ${fetched} feeds fetched, ${stored} headlines stored, ${errors} errors`,
      { fetched, stored, errors },
      'RSSFeedService'
    );

    return { fetched, stored, errors };
  }

  /**
   * Get recent headlines that haven't been transformed into parodies yet
   * Only returns headlines from the last 7 days
   */
  async getUntransformedHeadlines(limit = 50): Promise<RSSHeadline[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return prisma.rSSHeadline.findMany({
      where: {
        parodyHeadline: null,
        publishedAt: { gte: sevenDaysAgo },
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: limit,
      include: {
        source: true,
      },
    });
  }

  /**
   * Clean up old headlines (older than 7 days)
   */
  async cleanupOldHeadlines(): Promise<number> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await prisma.rSSHeadline.deleteMany({
      where: {
        publishedAt: { lt: sevenDaysAgo },
      },
    });

    logger.info(
      `Cleaned up ${result.count} old RSS headlines`,
      { count: result.count },
      'RSSFeedService'
    );

    return result.count;
  }
}

// Singleton instance
export const rssFeedService = new RSSFeedService();

