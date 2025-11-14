/**
 * World Facts Cron Job
 * 
 * @route POST /api/cron/world-facts
 * @access Cron (requires CRON_SECRET)
 * 
 * @description
 * Scheduled cron job that runs daily to:
 * 1. Fetch latest RSS feed headlines from news sources
 * 2. Transform them into parody headlines with character replacements
 * 3. Clean up old headlines
 * 
 * Runs once per day (24 hours) to keep world context fresh with
 * latest news transformed into satirical game universe versions.
 */

import type { NextRequest } from 'next/server';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { AuthorizationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { rssFeedService } from '@/lib/services/rss-feed-service';
import { createParodyHeadlineGenerator } from '@/lib/services/parody-headline-generator';

// Vercel function configuration
export const maxDuration = 300; // 5 minutes max

/**
 * Verify this is a legitimate Vercel Cron request
 */
function verifyVercelCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return false;
  }

  // Check for cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // In development, allow localhost
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  return false;
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Verify this is a legitimate cron request
  if (!verifyVercelCronRequest(request)) {
    logger.warn('Unauthorized cron request attempt', undefined, 'WorldFactsCron');
    throw new AuthorizationError('Unauthorized cron request', 'cron', 'execute');
  }

  const startTime = Date.now();
  logger.info('🌍 World facts update started', undefined, 'WorldFactsCron');

  // Step 1: Fetch all RSS feeds
  logger.info('Fetching RSS feeds...', undefined, 'WorldFactsCron');
  const feedResult = await rssFeedService.fetchAllFeeds();
  logger.info(
    `RSS feeds fetched: ${feedResult.fetched} sources, ${feedResult.stored} new headlines, ${feedResult.errors} errors`,
    feedResult,
    'WorldFactsCron'
  );

  // Step 2: Transform untransformed headlines into parodies
  logger.info('Generating parody headlines...', undefined, 'WorldFactsCron');
  const untransformedHeadlines = await rssFeedService.getUntransformedHeadlines(20); // Process 20 at a time
  
  const generator = createParodyHeadlineGenerator();
  const parodies = await generator.processHeadlines(untransformedHeadlines);
  logger.info(
    `Generated ${parodies.length} parody headlines`,
    { count: parodies.length },
    'WorldFactsCron'
  );

  // Step 3: Clean up old headlines (older than 7 days)
  logger.info('Cleaning up old headlines...', undefined, 'WorldFactsCron');
  const cleaned = await rssFeedService.cleanupOldHeadlines();
  logger.info(`Cleaned up ${cleaned} old headlines`, { count: cleaned }, 'WorldFactsCron');

  const duration = Date.now() - startTime;
  logger.info('✅ World facts update completed', {
    duration: `${duration}ms`,
    feedsFetched: feedResult.fetched,
    newHeadlines: feedResult.stored,
    parodiesGenerated: parodies.length,
    headlinesCleaned: cleaned,
  }, 'WorldFactsCron');

  return successResponse({
    success: true,
    duration,
    result: {
      rssFeeds: {
        fetched: feedResult.fetched,
        stored: feedResult.stored,
        errors: feedResult.errors,
      },
      parodyHeadlines: {
        generated: parodies.length,
      },
      cleanup: {
        deleted: cleaned,
      },
    },
  });
});

// GET endpoint for manual triggering
export const GET = withErrorHandling(async (request: NextRequest) => {
  return POST(request);
});

