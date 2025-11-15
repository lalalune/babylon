/**
 * Vercel Cron Job: World Facts Update
 * 
 * This endpoint is called by Vercel Cron to update world facts:
 * - Fetches RSS feeds
 * - Generates parody headlines
 * - Cleans up old headlines
 * 
 * Configuration in vercel.json:
 * - Runs periodically (e.g., every 6 hours)
 * - Max execution time: 300s
 * 
 * Security: Uses CRON_SECRET for authentication
 */

import type { NextRequest } from 'next/server';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { AuthorizationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { rssFeedService } from '@/lib/services/rss-feed-service';
import { createParodyHeadlineGenerator } from '@/lib/services/parody-headline-generator';

// Vercel function configuration
export const maxDuration = 300; // 5 minutes max

// Verify this is a legitimate cron request
function verifyCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In development, allow without secret for easy testing
  if (process.env.NODE_ENV === 'development') {
    if (!cronSecret) {
      logger.info('Development mode - allowing cron without CRON_SECRET', undefined, 'Cron');
      return true;
    }
    // If secret is set in dev, check it (but also allow 'development' keyword)
    if (authHeader === 'Bearer development' || authHeader === `Bearer ${cronSecret}`) {
      return true;
    }
  }
  
  // If CRON_SECRET is not configured, allow but warn (fail-open for missing config)
  if (!cronSecret) {
    logger.warn(
      '⚠️  CRON_SECRET not configured! Cron endpoint is accessible without authentication. ' +
      'Set CRON_SECRET environment variable in production for security.',
      { 
        environment: process.env.NODE_ENV,
        hasAuthHeader: !!authHeader 
      },
      'Cron'
    );
    return true; // Allow execution but warn
  }
  
  // If CRON_SECRET is set, verify it matches (fail-closed for wrong credentials)
  if (authHeader !== `Bearer ${cronSecret}`) {
    logger.error(
      'CRON authentication failed - invalid secret provided',
      { hasAuthHeader: !!authHeader },
      'Cron'
    );
    return false;
  }
  
  return true;
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Verify this is a legitimate cron request
  if (!verifyCronRequest(request)) {
    logger.warn('Unauthorized cron request attempt', undefined, 'Cron');
    throw new AuthorizationError('Unauthorized cron request', 'cron', 'execute');
  }

  const startTime = Date.now();
  logger.info('🌍 World facts update started', undefined, 'Cron');

  // Step 1: Fetch all RSS feeds
  logger.info('Fetching RSS feeds...', undefined, 'Cron');
  const feedResult = await rssFeedService.fetchAllFeeds();
  logger.info(
    `RSS feeds fetched: ${feedResult.fetched} sources, ${feedResult.stored} new headlines, ${feedResult.errors} errors`,
    feedResult,
    'Cron'
  );

  // Step 2: Transform untransformed headlines into parodies
  logger.info('Generating parody headlines...', undefined, 'Cron');
  const untransformedHeadlines = await rssFeedService.getUntransformedHeadlines(20); // Process 20 at a time
  
  const generator = createParodyHeadlineGenerator();
  const parodies = await generator.processHeadlines(untransformedHeadlines);
  logger.info(
    `Generated ${parodies.length} parody headlines`,
    { count: parodies.length },
    'Cron'
  );

  // Step 3: Clean up old headlines (older than 7 days)
  logger.info('Cleaning up old headlines...', undefined, 'Cron');
  const cleaned = await rssFeedService.cleanupOldHeadlines();
  logger.info(`Cleaned up ${cleaned} old headlines`, { count: cleaned }, 'Cron');

  const duration = Date.now() - startTime;
  logger.info('✅ World facts update completed', {
    duration: `${duration}ms`,
    feedsFetched: feedResult.fetched,
    newHeadlines: feedResult.stored,
    parodiesGenerated: parodies.length,
    headlinesCleaned: cleaned,
  }, 'Cron');

  return successResponse({
    success: true,
    duration,
    stats: {
      feedsFetched: feedResult.fetched,
      newHeadlines: feedResult.stored,
      parodiesGenerated: parodies.length,
      headlinesCleaned: cleaned,
    },
  });
});

// GET endpoint for Vercel Cron (some cron services use GET)
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Allow Vercel Cron requests (identified by user-agent or special headers)
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  const isVercelCron = userAgent.includes('vercel-cron');
  const hasVercelHeader = request.headers.has('x-vercel-id');
  
  // Also allow in development or with admin token for manual testing
  const isDev = process.env.NODE_ENV === 'development';
  const adminToken = request.headers.get('x-admin-token');
  const hasAdminSecret = !!process.env.ADMIN_TOKEN;
  const isAdmin = hasAdminSecret && adminToken === process.env.ADMIN_TOKEN;

  // Allow if it's Vercel Cron, has Vercel headers, dev mode, or admin
  if (!isVercelCron && !hasVercelHeader && !isDev && !isAdmin) {
    logger.warn('Unauthorized GET request to cron endpoint', {
      userAgent,
      hasVercelHeader,
      isDev,
      hasAdminSecret
    }, 'Cron');
    throw new AuthorizationError('Use POST for cron execution. This endpoint is triggered by Vercel Cron', 'cron', 'execute');
  }

  logger.info('GET request forwarded to POST handler', { userAgent, isVercelCron, hasVercelHeader }, 'Cron');
  
  // Forward to POST handler
  return POST(request);
});

