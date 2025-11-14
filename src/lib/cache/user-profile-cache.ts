/**
 * User Profile Caching
 * 
 * Implements aggressive caching for user profiles to reduce database load
 * during high concurrent user scenarios.
 */

import { getCache, setCache, invalidateCache, CACHE_KEYS, DEFAULT_TTLS } from '../cache-service';
import { prisma } from '../prisma';
import { logger } from '../logger';

interface CachedUserProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  walletAddress: string | null;
  reputationPoints: number;
  virtualBalance: string;
  lifetimePnL: string;
  createdAt: string;
  isActor: boolean;
  // Stats
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
}

/**
 * Get user profile with caching
 */
export async function getCachedUserProfile(userId: string): Promise<CachedUserProfile | null> {
  const cacheKey = `${CACHE_KEYS.USER}:${userId}`;

  // Try cache first
  const cached = await getCache<CachedUserProfile>(cacheKey);
  if (cached) {
    logger.debug('User profile cache hit', { userId }, 'UserProfileCache');
    return cached;
  }

  // Cache miss - fetch from database
  logger.debug('User profile cache miss', { userId }, 'UserProfileCache');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      coverImageUrl: true,
      walletAddress: true,
      reputationPoints: true,
      virtualBalance: true,
      lifetimePnL: true,
      createdAt: true,
      isActor: true,
      _count: {
        select: {
          Follow_Follow_followerIdToUser: true,
          Follow_Follow_followingIdToUser: true,
          Comment: true,
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Get post count separately (more efficient)
  const postsCount = await prisma.post.count({
    where: {
      authorId: userId,
      deletedAt: null,
    },
  });

  const profile: CachedUserProfile = {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    profileImageUrl: user.profileImageUrl,
    coverImageUrl: user.coverImageUrl,
    walletAddress: user.walletAddress,
    reputationPoints: user.reputationPoints,
    virtualBalance: user.virtualBalance.toString(),
    lifetimePnL: user.lifetimePnL.toString(),
    createdAt: user.createdAt.toISOString(),
    isActor: user.isActor,
    followersCount: user._count.Follow_Follow_followingIdToUser,
    followingCount: user._count.Follow_Follow_followerIdToUser,
    postsCount,
  };

  // Cache for 5 minutes
  await setCache(cacheKey, profile, {
    ttl: DEFAULT_TTLS.USER,
    namespace: CACHE_KEYS.USER,
  });

  return profile;
}

/**
 * Get multiple user profiles with caching
 */
export async function getCachedUserProfiles(userIds: string[]): Promise<Map<string, CachedUserProfile>> {
  const profiles = new Map<string, CachedUserProfile>();
  const uncachedIds: string[] = [];

  // Try to get from cache first
  await Promise.all(
    userIds.map(async (userId) => {
      const cached = await getCache<CachedUserProfile>(`${CACHE_KEYS.USER}:${userId}`);
      if (cached) {
        profiles.set(userId, cached);
      } else {
        uncachedIds.push(userId);
      }
    })
  );

  // Fetch uncached profiles from database
  if (uncachedIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: uncachedIds } },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        coverImageUrl: true,
        walletAddress: true,
        reputationPoints: true,
        virtualBalance: true,
        lifetimePnL: true,
        createdAt: true,
        isActor: true,
        _count: {
          select: {
            Follow_Follow_followerIdToUser: true,
            Follow_Follow_followingIdToUser: true,
            Comment: true,
          },
        },
      },
    });

    // Get post counts in batch
    const postCounts = await Promise.all(
      users.map(user =>
        prisma.post.count({
          where: { authorId: user.id, deletedAt: null },
        })
      )
    );

    // Cache and add to results
    await Promise.all(
      users.map(async (user, idx) => {
        const profile: CachedUserProfile = {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          bio: user.bio,
          profileImageUrl: user.profileImageUrl,
          coverImageUrl: user.coverImageUrl,
          walletAddress: user.walletAddress,
          reputationPoints: user.reputationPoints,
          virtualBalance: user.virtualBalance.toString(),
          lifetimePnL: user.lifetimePnL.toString(),
          createdAt: user.createdAt.toISOString(),
          isActor: user.isActor,
          followersCount: user._count.Follow_Follow_followingIdToUser,
          followingCount: user._count.Follow_Follow_followerIdToUser,
          postsCount: postCounts[idx],
        };

        profiles.set(user.id, profile);

        // Cache for future requests
        await setCache(`${CACHE_KEYS.USER}:${user.id}`, profile, {
          ttl: DEFAULT_TTLS.USER,
          namespace: CACHE_KEYS.USER,
        });
      })
    );
  }

  logger.info('User profiles fetched', {
    requested: userIds.length,
    cached: userIds.length - uncachedIds.length,
    fetched: uncachedIds.length,
  }, 'UserProfileCache');

  return profiles;
}

/**
 * Invalidate user profile cache
 */
export async function invalidateUserProfile(userId: string): Promise<void> {
  const cacheKey = `${CACHE_KEYS.USER}:${userId}`;
  await invalidateCache(cacheKey, { namespace: CACHE_KEYS.USER });
  logger.debug('User profile cache invalidated', { userId }, 'UserProfileCache');
}

/**
 * Warm user profile cache for frequently accessed users
 */
export async function warmUserProfileCache(userIds: string[]): Promise<void> {
  logger.info('Warming user profile cache', { count: userIds.length }, 'UserProfileCache');
  await getCachedUserProfiles(userIds);
}

