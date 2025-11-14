/**
 * Trade Cache Invalidation Utilities
 * 
 * Provides functions to invalidate Redis cache when trades are created
 * to ensure fresh data is fetched on next request.
 */

import { invalidateCache } from '@/lib/cache-service';
import { redis, redisClientType } from '@/lib/redis';
import { logger } from '@/lib/logger';

/**
 * Invalidate all trades cache for a specific prediction market
 */
export async function invalidatePredictionTradesCache(marketId: string): Promise<void> {
  try {
    // If Redis is available, delete all cache entries for this market
    // We use pattern matching to delete all limit/offset combinations
    if (redis && redisClientType) {
      const pattern = `market-trades:prediction-trades:${marketId}:*`;
      
      if (redisClientType === 'upstash') {
        // Upstash Redis doesn't support SCAN, so we track specific keys
        // For now, invalidate common pagination combinations
        const limits = [10, 20, 50, 100];
        const offsets = [0, 10, 20, 50, 100];
        
        for (const limit of limits) {
          for (const offset of offsets) {
            const key = `prediction-trades:${marketId}:${limit}:${offset}`;
            await invalidateCache(key, { namespace: 'market-trades' });
          }
        }
    } else {
      // Standard Redis - use SCAN to find and delete all matching keys
      const { default: _IORedis } = await import('ioredis');
      const client = redis as InstanceType<typeof _IORedis>;
        
        const stream = client.scanStream({
          match: `market-trades:${pattern}`,
          count: 100,
        });

        stream.on('data', (keys: string[]) => {
          if (keys.length) {
            const pipeline = client.pipeline();
            keys.forEach((key) => pipeline.del(key));
            pipeline.exec();
          }
        });

        await new Promise((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
        });
      }
    } else {
      // If no Redis, cache is in-memory and will expire naturally
      logger.debug('No Redis available, cache will expire naturally', { marketId }, 'TradeCache');
    }

    logger.info(`Invalidated prediction trades cache for market ${marketId}`, undefined, 'TradeCache');
  } catch (error) {
    logger.error(`Failed to invalidate prediction trades cache`, error, 'TradeCache');
  }
}

/**
 * Invalidate all trades cache for a specific perpetual market
 */
export async function invalidatePerpTradesCache(ticker: string): Promise<void> {
  try {
    // If Redis is available, delete all cache entries for this ticker
    if (redis && redisClientType) {
      const pattern = `market-trades:perp-trades:${ticker}:*`;
      
      if (redisClientType === 'upstash') {
        // Upstash Redis doesn't support SCAN, so invalidate common pagination combinations
        const limits = [10, 20, 50, 100];
        const offsets = [0, 10, 20, 50, 100];
        
        for (const limit of limits) {
          for (const offset of offsets) {
            const key = `perp-trades:${ticker}:${limit}:${offset}`;
            await invalidateCache(key, { namespace: 'market-trades' });
          }
        }
    } else {
      // Standard Redis - use SCAN to find and delete all matching keys
      const { default: _IORedis } = await import('ioredis');
      const client = redis as InstanceType<typeof _IORedis>;
        
        const stream = client.scanStream({
          match: `market-trades:${pattern}`,
          count: 100,
        });

        stream.on('data', (keys: string[]) => {
          if (keys.length) {
            const pipeline = client.pipeline();
            keys.forEach((key) => pipeline.del(key));
            pipeline.exec();
          }
        });

        await new Promise((resolve, reject) => {
          stream.on('end', resolve);
          stream.on('error', reject);
        });
      }
    } else {
      logger.debug('No Redis available, cache will expire naturally', { ticker }, 'TradeCache');
    }

    logger.info(`Invalidated perp trades cache for ticker ${ticker}`, undefined, 'TradeCache');
  } catch (error) {
    logger.error(`Failed to invalidate perp trades cache`, error, 'TradeCache');
  }
}

/**
 * Invalidate trades cache after a prediction market trade
 * Call this after creating a position or balance transaction for a prediction market
 */
export async function invalidateAfterPredictionTrade(marketId: string): Promise<void> {
  await invalidatePredictionTradesCache(marketId);
}

/**
 * Invalidate trades cache after a perpetual futures trade
 * Call this after opening/closing a perp position or creating related balance transaction
 */
export async function invalidateAfterPerpTrade(ticker: string): Promise<void> {
  await invalidatePerpTradesCache(ticker);
}

