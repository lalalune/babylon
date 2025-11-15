#!/usr/bin/env bun
/**
 * Local Cron Simulator
 * 
 * Simulates Vercel Cron locally by calling the game-tick endpoint every minute.
 * Use this if you don't want to run the full daemon but want content generation.
 * 
 * Usage:
 *   bun run cron:local      (start local cron)
 *   bun run dev             (in another terminal - web app)
 * 
 * Or use dev:full to run both automatically.
 */

import { logger } from '../src/lib/logger';

const CRON_INTERVAL = 60000; // 60 seconds
const API_URL = 'http://localhost:3000/api/cron/game-tick';

let intervalId: NodeJS.Timeout | null = null;
let tickCount = 0;

async function executeTick() {
  tickCount++;
  logger.info(`🎮 Triggering game tick #${tickCount}...`, undefined, 'LocalCron');
  
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET || 'development'}`,
      'Content-Type': 'application/json',
    },
  }).catch((error: Error) => {
    const errorMessage = error.message;
    logger.error(`Tick #${tickCount} error: ${errorMessage}`, { error }, 'LocalCron');
    
    if (errorMessage.includes('ECONNREFUSED')) {
      logger.error('❌ Next.js dev server not running!', undefined, 'LocalCron');
      logger.error('   Start it first: bun run dev', undefined, 'LocalCron');
      process.exit(1);
    }
    throw error;
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error(`Tick #${tickCount} failed (HTTP ${response.status})`, data, 'LocalCron');
    return;
  }

  if (data.skipped) {
    logger.warn(`Tick #${tickCount} skipped: ${data.reason}`, undefined, 'LocalCron');
    return;
  }

  logger.info(`✅ Tick #${tickCount} completed`, {
    duration: data.duration,
    posts: data.result?.postsCreated || 0,
    events: data.result?.eventsCreated || 0,
    markets: data.result?.marketsUpdated || 0,
  }, 'LocalCron');
}

async function waitForServer(maxAttempts = 30, delayMs = 2000): Promise<boolean> {
  logger.info('Waiting for Next.js server to be ready...', undefined, 'LocalCron');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch('http://localhost:3000/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(1000),
      });
      
      if (response.ok) {
        logger.info(`✅ Server ready after ${attempt} attempt(s)`, undefined, 'LocalCron');
        return true;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
      if (attempt < maxAttempts) {
        logger.info(`Attempt ${attempt}/${maxAttempts}: Server not ready, waiting ${delayMs}ms...`, undefined, 'LocalCron');
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  logger.error('❌ Server did not become ready after maximum attempts', undefined, 'LocalCron');
  return false;
}

async function main() {
  logger.info('🔄 LOCAL CRON SIMULATOR', undefined, 'LocalCron');
  logger.info('======================', undefined, 'LocalCron');
  logger.info('Simulating Vercel Cron by calling /api/cron/game-tick every minute', undefined, 'LocalCron');
  logger.info('Press Ctrl+C to stop', undefined, 'LocalCron');
  logger.info('', undefined, 'LocalCron');

  // Wait for server to be ready with health check
  const serverReady = await waitForServer();
  if (!serverReady) {
    logger.error('Cannot start cron simulator - server is not ready', undefined, 'LocalCron');
    process.exit(1);
  }

  // Execute first tick immediately
  await executeTick();

  // Then execute every minute
  intervalId = setInterval(async () => {
    await executeTick();
  }, CRON_INTERVAL);

  // Handle shutdown gracefully
  const cleanup = () => {
    logger.info('Stopping local cron simulator...', undefined, 'LocalCron');
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    logger.info(`Total ticks executed: ${tickCount}`, undefined, 'LocalCron');
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

main();

