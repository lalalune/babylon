/**
 * Redis Client - Unified interface for both local and production Redis
 * 
 * Local Development:
 * - Uses standard Redis protocol via ioredis
 * - Connects to local Docker Redis (REDIS_URL=redis://localhost:6379)
 * 
 * Vercel Production:
 * - Uses Upstash REST API via @upstash/redis
 * - Connects to Upstash Redis (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * 
 * Falls back gracefully if Redis is not configured.
 */

import { Redis as UpstashRedis } from '@upstash/redis'
import IORedis from 'ioredis'
import { logger } from './logger'

// Redis client types
type RedisClient = UpstashRedis | IORedis | null

// Check if Upstash Redis is configured (Vercel production)
const hasUpstashConfig = () => {
  return !!((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN))
}

// Check if standard Redis URL is configured (local development)
const hasStandardRedisUrl = () => {
  return !!process.env.REDIS_URL
}

// Create Redis client based on available configuration
let redisClient: RedisClient = null
let redisType: 'upstash' | 'standard' | null = null
let isClosing = false
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build'

// Skip Redis initialization during build time to avoid connection issues
if (isBuildTime) {
  logger.info('Build time detected - skipping Redis initialization', undefined, 'Redis')
} else if (hasUpstashConfig()) {
  redisClient = new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
  })
  redisType = 'upstash'
  logger.info('Redis client initialized (Upstash REST API)', undefined, 'Redis')
} else if (hasStandardRedisUrl()) {
  redisClient = new IORedis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        return null
      }
      return Math.min(times * 100, 2000)
    },
    lazyConnect: true,
  })
  redisType = 'standard'
  
  void redisClient.connect().then(() => {
    logger.info('Redis client initialized (Standard Redis Protocol)', undefined, 'Redis')
  })
} else {
  logger.info('Redis not configured - SSE will use local-only broadcasting', undefined, 'Redis')
  logger.info('For local dev: Set REDIS_URL=redis://localhost:6379', undefined, 'Redis')
  logger.info('For production: Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN', undefined, 'Redis')
}

export const redis = redisClient
export const redisClientType = redisType

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redis !== null
}

/**
 * Safely publish to Redis (no-op if not available)
 * Works with both Upstash and standard Redis
 */
export async function safePublish(channel: string, message: string): Promise<boolean> {
  if (!redis) return false

  if (redisType === 'upstash') {
    await (redis as UpstashRedis).rpush(channel, message)
    await (redis as UpstashRedis).expire(channel, 60)
  } else if (redisType === 'standard') {
    await (redis as IORedis).rpush(channel, message)
    await (redis as IORedis).expire(channel, 60)
  }
  return true
}

/**
 * Safely poll Redis for messages (returns empty array if not available)
 * Works with both Upstash and standard Redis
 */
export async function safePoll(channel: string, count: number = 10): Promise<string[]> {
  if (!redis) return []

  let messages: string[] | string | null = null

  if (redisType === 'upstash') {
    const result = await (redis as UpstashRedis).lpop(channel, count)
    messages = result as string[] | string | null
  } else if (redisType === 'standard') {
    const items: string[] = []
    for (let i = 0; i < count; i++) {
      const item = await (redis as IORedis).lpop(channel)
      if (!item) break
      items.push(item)
    }
    messages = items.length > 0 ? items : null
  }

  if (!messages) return []

  if (Array.isArray(messages)) {
    return messages.filter((m): m is string => typeof m === 'string')
  }
  return typeof messages === 'string' ? [messages] : []
}

/**
 * Cleanup Redis connection on shutdown
 */
export async function closeRedis(): Promise<void> {
  if (isClosing) return
  isClosing = true

  if (redis && redisType === 'standard') {
    const ioRedisClient = redis as IORedis
    if (ioRedisClient.status === 'ready' || ioRedisClient.status === 'connect') {
      await ioRedisClient.quit()
      logger.info('Redis connection closed', undefined, 'Redis')
    }
  }
}

// Cleanup on process exit (only if not build time)
if (typeof process !== 'undefined' && !isBuildTime) {
  process.on('SIGINT', () => {
    void closeRedis()
  })
  process.on('SIGTERM', () => {
    void closeRedis()
  })
}
