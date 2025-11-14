/**
 * Cached Database Service
 * 
 * Wraps database-service with intelligent caching layer.
 * Provides cached versions of frequently accessed queries.
 * 
 * Usage:
 *   import { cachedDb } from '@/lib/cached-database-service'
 *   const posts = await cachedDb.getRecentPosts(100)
 */

import { db } from './database-service';
import {
  getCacheOrFetch,
  invalidateCache,
  invalidateCachePattern,
  CACHE_KEYS,
  DEFAULT_TTLS,
} from './cache-service';
import { logger } from './logger';
import type { Post } from '@prisma/client';

/**
 * Cached wrapper for database service
 */
class CachedDatabaseService {
  /**
   * Get recent posts with caching
   */
  async getRecentPosts(limit = 100, offset = 0): Promise<Post[]> {
    const cacheKey = `${limit}:${offset}`;
    
    return getCacheOrFetch(
      cacheKey,
      () => db.getRecentPosts(limit, offset),
      {
        namespace: CACHE_KEYS.POSTS_LIST,
        ttl: DEFAULT_TTLS.POSTS_LIST,
      }
    );
  }

  /**
   * Get posts by actor with caching
   */
  async getPostsByActor(authorId: string, limit = 100): Promise<Post[]> {
    const cacheKey = `${authorId}:${limit}`;
    
    return getCacheOrFetch(
      cacheKey,
      () => db.getPostsByActor(authorId, limit),
      {
        namespace: CACHE_KEYS.POSTS_BY_ACTOR,
        ttl: DEFAULT_TTLS.POSTS_BY_ACTOR,
      }
    );
  }

  /**
   * Get posts for following feed with caching
   */
  async getPostsForFollowing(
    userId: string,
    followedIds: string[],
    limit = 100,
    offset = 0
  ): Promise<Post[]> {
    // Cache key based on user and pagination
    const cacheKey = `${userId}:${limit}:${offset}`;
    
    return getCacheOrFetch(
      cacheKey,
      async () => {
        // Query posts from database
        const posts = await db.prisma.post.findMany({
          where: {
            authorId: { in: followedIds },
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: limit,
          skip: offset,
        });
        
        return posts;
      },
      {
        namespace: CACHE_KEYS.POSTS_FOLLOWING,
        ttl: DEFAULT_TTLS.POSTS_FOLLOWING,
      }
    );
  }

  /**
   * Get user by ID with caching
   */
  async getUserById(userId: string) {
    const cacheKey = userId;
    
    return getCacheOrFetch(
      cacheKey,
      () => db.prisma.user.findUnique({
        where: { id: userId },
      }),
      {
        namespace: CACHE_KEYS.USER,
        ttl: DEFAULT_TTLS.USER,
      }
    );
  }

  /**
   * Get multiple users with caching
   */
  async getUsersByIds(userIds: string[]) {
    // For bulk operations, we still cache individual users
    const users = await Promise.all(
      userIds.map(id => this.getUserById(id))
    );
    
    return users.filter(u => u !== null);
  }

  /**
   * Get user balance with caching
   */
  async getUserBalance(userId: string) {
    const cacheKey = userId;
    
    return getCacheOrFetch(
      cacheKey,
      () => db.prisma.user.findUnique({
        where: { id: userId },
        select: {
          virtualBalance: true,
          totalDeposited: true,
          totalWithdrawn: true,
          lifetimePnL: true,
        },
      }),
      {
        namespace: CACHE_KEYS.USER_BALANCE,
        ttl: DEFAULT_TTLS.USER_BALANCE,
      }
    );
  }

  /**
   * Get actor by ID with caching
   */
  async getActorById(actorId: string) {
    const cacheKey = actorId;
    
    return getCacheOrFetch(
      cacheKey,
      () => db.prisma.actor.findUnique({
        where: { id: actorId },
      }),
      {
        namespace: CACHE_KEYS.ACTOR,
        ttl: DEFAULT_TTLS.ACTOR,
      }
    );
  }

  /**
   * Get multiple actors with caching
   */
  async getActorsByIds(actorIds: string[]) {
    const actors = await Promise.all(
      actorIds.map(id => this.getActorById(id))
    );
    
    return actors.filter(a => a !== null);
  }

  /**
   * Get organization by ID with caching
   */
  async getOrganizationById(orgId: string) {
    const cacheKey = orgId;
    
    return getCacheOrFetch(
      cacheKey,
      () => db.prisma.organization.findUnique({
        where: { id: orgId },
      }),
      {
        namespace: CACHE_KEYS.ORGANIZATION,
        ttl: DEFAULT_TTLS.ORGANIZATION,
      }
    );
  }

  /**
   * Get active markets with caching
   */
  async getActiveMarkets() {
    const cacheKey = 'active';
    
    return getCacheOrFetch(
      cacheKey,
      () => db.prisma.market.findMany({
        where: { resolved: false },
        orderBy: { createdAt: 'desc' },
      }),
      {
        namespace: CACHE_KEYS.MARKETS_LIST,
        ttl: DEFAULT_TTLS.MARKETS_LIST,
      }
    );
  }

  /**
   * Get active pools with caching
   */
  async getActivePools() {
    const cacheKey = 'active';
    
    return getCacheOrFetch(
      cacheKey,
      () => db.prisma.pool.findMany({
        where: { isActive: true },
        include: {
          npcActor: {
            select: {
              id: true,
              name: true,
              description: true,
              tier: true,
              personality: true,
            },
          },
          deposits: {
            where: {
              withdrawnAt: null,
            },
            select: {
              amount: true,
              currentValue: true,
            },
          },
          positions: {
            where: {
              closedAt: null,
            },
            select: {
              marketType: true,
              ticker: true,
              marketId: true,
              side: true,
              size: true,
              unrealizedPnL: true,
            },
          },
          _count: {
            select: {
              deposits: {
                where: {
                  withdrawnAt: null,
                },
              },
              trades: true,
            },
          },
        },
        orderBy: { totalValue: 'desc' },
      }),
      {
        namespace: CACHE_KEYS.POOLS_LIST,
        ttl: DEFAULT_TTLS.POOLS_LIST,
      }
    );
  }

  /**
   * Get trending tags with caching
   */
  async getTrendingTags(limit = 10) {
    const cacheKey = `${limit}`;
    
    return getCacheOrFetch(
      cacheKey,
      () => db.prisma.trendingTag.findMany({
        take: limit,
        orderBy: { rank: 'asc' },
        include: {
          tag: true,
        },
      }),
      {
        namespace: CACHE_KEYS.TRENDING_TAGS,
        ttl: DEFAULT_TTLS.TRENDING_TAGS,
      }
    );
  }

  /**
   * Invalidate cache for posts
   */
  async invalidatePostsCache() {
    logger.info('Invalidating posts cache', undefined, 'CachedDatabaseService');
    await Promise.all([
      invalidateCachePattern('*', { namespace: CACHE_KEYS.POSTS_LIST }),
      invalidateCachePattern('*', { namespace: CACHE_KEYS.POSTS_FOLLOWING }),
    ]);
  }

  /**
   * Invalidate cache for specific actor's posts
   */
  async invalidateActorPostsCache(actorId: string) {
    logger.info('Invalidating actor posts cache', { actorId }, 'CachedDatabaseService');
    await invalidateCachePattern(`${actorId}:*`, { namespace: CACHE_KEYS.POSTS_BY_ACTOR });
  }

  /**
   * Invalidate cache for user
   */
  async invalidateUserCache(userId: string) {
    logger.info('Invalidating user cache', { userId }, 'CachedDatabaseService');
    await Promise.all([
      invalidateCache(userId, { namespace: CACHE_KEYS.USER }),
      invalidateCache(userId, { namespace: CACHE_KEYS.USER_BALANCE }),
      invalidateCachePattern(`${userId}:*`, { namespace: CACHE_KEYS.POSTS_FOLLOWING }),
    ]);
  }

  /**
   * Invalidate cache for markets
   */
  async invalidateMarketsCache() {
    logger.info('Invalidating markets cache', undefined, 'CachedDatabaseService');
    await invalidateCachePattern('*', { namespace: CACHE_KEYS.MARKETS_LIST });
  }

  /**
   * Invalidate cache for pools
   */
  async invalidatePoolsCache() {
    logger.info('Invalidating pools cache', undefined, 'CachedDatabaseService');
    await invalidateCachePattern('*', { namespace: CACHE_KEYS.POOLS_LIST });
  }

  /**
   * Invalidate all caches (use sparingly!)
   */
  async invalidateAllCaches() {
    logger.warn('Invalidating all caches', undefined, 'CachedDatabaseService');
    await Promise.all([
      this.invalidatePostsCache(),
      this.invalidateMarketsCache(),
      this.invalidatePoolsCache(),
    ]);
  }
}

export const cachedDb = new CachedDatabaseService();

