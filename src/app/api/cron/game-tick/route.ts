/**
 * Vercel Cron Job: Game Tick
 * 
 * This endpoint is called by Vercel Cron to generate game content.
 * Replaces the continuous daemon with scheduled serverless invocations.
 * 
 * Configuration in vercel.json:
 * - Runs every minute
 * - Generates posts, events, updates markets
 * - Syncs reputation data every 3 hours (checked internally)
 * - Max execution time: 300s
 * 
 * Security: Uses Vercel Cron secret for authentication
 */

import type { NextRequest } from 'next/server'
import { asSystem } from '@/lib/db/context'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { AuthorizationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { executeGameTick } from '@/lib/serverless-game-tick'

// Verify this is a legitimate Vercel Cron request
function verifyVercelCronRequest(request: NextRequest): boolean {
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
  // 1. Verify this is a legitimate cron request
  if (!verifyVercelCronRequest(request)) {
    logger.warn('Unauthorized cron request attempt', undefined, 'Cron');
    throw new AuthorizationError('Unauthorized cron request', 'cron', 'execute');
  }

  const startTime = Date.now();
  logger.info('🎮 Game tick started', undefined, 'Cron');

  // 2. Check if we should skip (maintenance mode, etc.) - system operation
  const gameState = await asSystem(async (db) => {
    return await db.game.findFirst({
      where: { isContinuous: true },
    });
  });

  if (!gameState || !gameState.isRunning) {
    logger.info('Game is paused - skipping tick', undefined, 'Cron');
    return successResponse({
      success: true,
      skipped: true,
      reason: 'Game paused',
    });
  }

  // 3. Execute the tick (generates posts, events, updates markets)
  const result = await executeGameTick();

  const duration = Date.now() - startTime;
  logger.info('✅ Game tick completed', {
    duration: `${duration}ms`,
    posts: result.postsCreated,
    events: result.eventsCreated,
    marketsUpdated: result.marketsUpdated,
  }, 'Cron');

  return successResponse({
    success: true,
    duration,
    result,
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

