/**
 * Cache Service
 * 
 * Provides intelligent caching layer for frequently accessed data.
 * Uses Redis when available, falls back to in-memory cache.
 * 
 * Features:
 * - Automatic TTL management
 * - Cache invalidation patterns
 * - Compression for large objects
 * - Fallback to database on cache miss
 * - Graceful degradation if Redis unavailable
 */

import { redis, redisClientType } from './redis';
import { logger } from './logger';
import type { Redis as UpstashRedis } from '@upstash/redis';
import type IORedis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Compress large objects
  namespace?: string; // Cache key prefix
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// In-memory fallback cache (for when Redis is unavailable)
const memoryCache = new Map<string, CacheEntry<unknown>>();

// Cache key prefixes for different data types
export const CACHE_KEYS = {
  POST: 'post',
  POSTS_LIST: 'posts:list',
  POSTS_BY_ACTOR: 'posts:actor',
  POSTS_FOLLOWING: 'posts:following',
  USER: 'user',
  USER_BALANCE: 'user:balance',
  ACTOR: 'actor',
  ORGANIZATION: 'org',
  MARKET: 'market',
  MARKETS_LIST: 'markets:list',
  TRENDING_TAGS: 'trending:tags',
  WIDGET: 'widget',
} as const;

// Default TTLs for different data types (in seconds)
export const DEFAULT_TTLS = {
  // Real-time data - very short TTL
  POSTS_LIST: 10, // 10 seconds
  POSTS_FOLLOWING: 15, // 15 seconds
  
  // Semi-real-time data - short TTL
  POST: 30, // 30 seconds
  USER_BALANCE: 30, // 30 seconds
  MARKET: 60, // 1 minute
  MARKETS_LIST: 60, // 1 minute
  
  // Moderate change frequency - medium TTL
  USER: 300, // 5 minutes
  TRENDING_TAGS: 300, // 5 minutes
  WIDGET: 300, // 5 minutes
  
  // Rarely changing data - long TTL
  ACTOR: 3600, // 1 hour
  ORGANIZATION: 3600, // 1 hour
  POSTS_BY_ACTOR: 120, // 2 minutes (actors post regularly)
} as const;

/**
 * Clean expired entries from memory cache
 */
function cleanMemoryCache(): void {
  const now = Date.now();
  const toDelete: string[] = [];

  memoryCache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      toDelete.push(key);
    }
  });

  toDelete.forEach(key => memoryCache.delete(key));
}

// Clean memory cache every minute
setInterval(cleanMemoryCache, 60000);

/**
 * Get value from cache
 */
export async function getCache<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const fullKey = options.namespace ? `${options.namespace}:${key}` : key;

  if (redis && redisClientType) {
    const cached = await redis.get(fullKey);
    
    if (cached) {
      try {
        // Check if cached value is empty or whitespace
        const cachedStr = cached as string;
        if (!cachedStr || cachedStr.trim() === '') {
          logger.warn('Empty cached value in Redis', { key: fullKey }, 'CacheService');
          return null;
        }
        
        logger.debug('Cache hit (Redis)', { key: fullKey }, 'CacheService');
        return JSON.parse(cachedStr) as T;
      } catch (error) {
        logger.error('Failed to parse cached value from Redis', { 
          key: fullKey, 
          error: error instanceof Error ? error.message : 'Unknown error',
          preview: (cached as string).substring(0, 100)
        }, 'CacheService');
        // Return null to trigger a fresh fetch
        return null;
      }
    }
    
    logger.debug('Cache miss (Redis)', { key: fullKey }, 'CacheService');
    return null;
  }

  const entry = memoryCache.get(fullKey);
  
  if (entry) {
    if (entry.expiresAt > Date.now()) {
      logger.debug('Cache hit (Memory)', { key: fullKey }, 'CacheService');
      return entry.value as T;
    }
    memoryCache.delete(fullKey);
    logger.debug('Cache expired (Memory)', { key: fullKey }, 'CacheService');
  }

  logger.debug('Cache miss (Memory)', { key: fullKey }, 'CacheService');
  return null;
}

/**
 * Set value in cache
 */
export async function setCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const fullKey = options.namespace ? `${options.namespace}:${key}` : key;
  const ttl = options.ttl || 300;

  const serialized = JSON.stringify(value);

  if (redis && redisClientType) {
    if (redisClientType === 'upstash') {
      await (redis as UpstashRedis).set(fullKey, serialized, { ex: ttl });
    } else {
      await (redis as IORedis).set(fullKey, serialized, 'EX', ttl);
    }
    logger.debug('Cache set (Redis)', { key: fullKey, ttl }, 'CacheService');
    return;
  }

  const expiresAt = Date.now() + (ttl * 1000);
  memoryCache.set(fullKey, { value, expiresAt });
  logger.debug('Cache set (Memory)', { key: fullKey, ttl }, 'CacheService');
}

/**
 * Invalidate cache entry
 */
export async function invalidateCache(
  key: string,
  options: CacheOptions = {}
): Promise<void> {
  const fullKey = options.namespace ? `${options.namespace}:${key}` : key;

  if (redis && redisClientType) {
    await redis.del(fullKey);
    logger.debug('Cache invalidated (Redis)', { key: fullKey }, 'CacheService');
  }

  memoryCache.delete(fullKey);
  logger.debug('Cache invalidated (Memory)', { key: fullKey }, 'CacheService');
}

/**
 * Invalidate cache entries matching a pattern
 */
export async function invalidateCachePattern(
  pattern: string,
  options: CacheOptions = {}
): Promise<void> {
  const fullPattern = options.namespace ? `${options.namespace}:${pattern}` : pattern;

  // Invalidate in Redis
  if (redis && redisClientType === 'upstash') {
    // Upstash Redis doesn't support SCAN, so we'll need to track keys manually
    // For now, log a warning
    logger.warn(
      'Pattern invalidation not fully supported with Upstash Redis',
      { pattern: fullPattern },
      'CacheService'
    );
  } else if (redis && redisClientType === 'standard') {
    // For standard Redis, use SCAN to find matching keys
    const ioRedis = redis as { scanStream: (opts: { match: string }) => NodeJS.ReadableStream; del: (...keys: string[]) => Promise<unknown> };
    const stream = ioRedis.scanStream({ match: fullPattern });
    const keys: string[] = [];

    stream.on('data', (resultKeys: string[]) => {
      keys.push(...resultKeys);
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    if (keys.length > 0) {
      await ioRedis.del(...keys);
      logger.info(
        'Cache pattern invalidated (Redis)',
        { pattern: fullPattern, count: keys.length },
        'CacheService'
      );
    }
  }

  // Invalidate in memory cache
  const memoryKeys = Array.from(memoryCache.keys()).filter(key =>
    key.includes(pattern)
  );
  memoryKeys.forEach(key => memoryCache.delete(key));
  
  if (memoryKeys.length > 0) {
    logger.debug(
      'Cache pattern invalidated (Memory)',
      { pattern: fullPattern, count: memoryKeys.length },
      'CacheService'
    );
  }
}

/**
 * Get or set pattern - fetch from cache or execute function and cache result
 */
export async function getCacheOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache
  const cached = await getCache<T>(key, options);
  
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch from source
  logger.debug('Fetching data for cache', { key }, 'CacheService');
  const data = await fetchFn();

  // Cache the result
  await setCache(key, data, options);

  return data;
}

/**
 * Warm up cache with data
 */
export async function warmCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  await setCache(key, value, options);
}

/**
 * Get cache statistics (memory cache only)
 */
export function getCacheStats() {
  const now = Date.now();
  let activeEntries = 0;
  let expiredEntries = 0;

  memoryCache.forEach((entry) => {
    if (entry.expiresAt > now) {
      activeEntries++;
    } else {
      expiredEntries++;
    }
  });

  return {
    totalEntries: memoryCache.size,
    activeEntries,
    expiredEntries,
    redisAvailable: !!redis,
    redisType: redisClientType,
  };
}

/**
 * Clear all cache (use with caution!)
 */
export async function clearAllCache(): Promise<void> {
  logger.warn('Clearing all cache', undefined, 'CacheService');

  // Clear memory cache
  memoryCache.clear();

  // Clear Redis cache (if available and safe to do)
  if (redis && redisClientType === 'standard') {
    // Only clear our namespaced keys, not the entire Redis instance
    logger.warn(
      'Redis cache clear requested but not implemented for safety',
      undefined,
      'CacheService'
    );
  }
}

