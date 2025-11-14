/**
 * Tag Storage Service
 *
 * Handles storage and retrieval of tags in the database
 */
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

import type { GeneratedTag } from './tag-generation-service';

/**
 * Store tags for a post
 * - Creates tags if they don't exist
 * - Links tags to post via PostTag join table
 */
export async function storeTagsForPost(
  postId: string,
  tags: GeneratedTag[]
): Promise<void> {
  if (tags.length === 0) {
    return;
  }

  const tagNames = tags.map((t) => t.name);
  const existingTags = await prisma.tag.findMany({
    where: { name: { in: tagNames } },
  });

  const existingTagMap = new Map(existingTags.map((t) => [t.name, t]));

  const tagsToCreate = tags.filter((t) => !existingTagMap.has(t.name));

  if (tagsToCreate.length > 0) {
    // Try to create all tags at once with skipDuplicates to handle race conditions
    // This is much more efficient than parallel upserts and avoids constraint violations
    try {
      await prisma.tag.createMany({
        data: tagsToCreate.map((tag) => ({
          name: tag.name,
          displayName: tag.displayName,
          category: tag.category || null,
        })),
        skipDuplicates: true, // Ignore duplicates without error
      });
    } catch (error) {
      // Log error but continue - we'll fetch all tags next
      logger.debug(
        'Tag createMany had partial failure (expected with concurrent creates)',
        { error },
        'TagStorageService'
      );
    }

    // Now fetch all tags that should exist (either just created or already existed)
    const createdTags = await prisma.tag.findMany({
      where: {
        name: {
          in: tagsToCreate.map((t) => t.name),
        },
      },
    });

    createdTags.forEach((t) => existingTagMap.set(t.name, t));
    logger.debug(
      'Created/fetched new tags',
      { count: createdTags.length },
      'TagStorageService'
    );
  }

  const postTagData = tags.map((tag) => {
    const dbTag = existingTagMap.get(tag.name)!;
    return {
      postId,
      tagId: dbTag.id,
    };
  });

  await prisma.postTag.createMany({
    data: postTagData,
    skipDuplicates: true,
  });

  logger.debug(
    'Stored tags for post',
    {
      postId,
      tagCount: tags.length,
    },
    'TagStorageService'
  );
}

/**
 * Get tags for a post
 */
export async function getTagsForPost(postId: string) {
  return await prisma.postTag.findMany({
    where: { postId },
    include: {
      tag: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

/**
 * Get posts by tag name
 */
export async function getPostsByTag(
  tagName: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
) {
  const { limit = 20, offset = 0 } = options;

  // Find tag by normalized name
  const tag = await prisma.tag.findUnique({
    where: { name: tagName.toLowerCase() },
  });

  if (!tag) {
    return {
      tag: null,
      posts: [],
      total: 0,
    };
  }

  // Get posts with this tag
  const [postTags, total] = await Promise.all([
    prisma.postTag.findMany({
      where: { tagId: tag.id },
      include: {
        post: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
    }),
    prisma.postTag.count({
      where: { tagId: tag.id },
    }),
  ]);

  return {
    tag,
    posts: postTags.map((pt) => pt.post),
    total,
  };
}

/**
 * Get tag statistics (for trending calculation)
 */
export async function getTagStatistics(
  windowStart: Date,
  windowEnd: Date
): Promise<
  Array<{
    tagId: string;
    tagName: string;
    tagDisplayName: string;
    tagCategory: string | null;
    postCount: number;
    recentPostCount: number; // Last 24 hours
    oldestPostDate: Date;
    newestPostDate: Date;
  }>
> {
  // Calculate 24 hours ago from window end
  const last24Hours = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

  // Get all post tags within the window with their tag info
  // Using Prisma queries instead of raw SQL for Prisma Accelerate compatibility
  const postTags = await prisma.postTag.findMany({
    where: {
      createdAt: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
    include: {
      tag: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // Aggregate manually (Prisma Accelerate doesn't support complex raw SQL)
  const tagStats = new Map<string, {
    tag: { id: string; name: string; displayName: string; category: string | null };
    postCount: number;
    recentPostCount: number;
    oldestPostDate: Date;
    newestPostDate: Date;
  }>();

  postTags.forEach((pt) => {
    const existing = tagStats.get(pt.tagId);
    const isRecent = pt.createdAt >= last24Hours;

    if (existing) {
      existing.postCount++;
      if (isRecent) existing.recentPostCount++;
      if (pt.createdAt < existing.oldestPostDate) existing.oldestPostDate = pt.createdAt;
      if (pt.createdAt > existing.newestPostDate) existing.newestPostDate = pt.createdAt;
    } else {
      tagStats.set(pt.tagId, {
        tag: pt.tag,
        postCount: 1,
        recentPostCount: isRecent ? 1 : 0,
        oldestPostDate: pt.createdAt,
        newestPostDate: pt.createdAt,
      });
    }
  });

  // Filter tags with at least 3 posts and convert to result format
  return Array.from(tagStats.values())
    .filter((stats) => stats.postCount >= 3)
    .map((stats) => ({
      tagId: stats.tag.id,
      tagName: stats.tag.name,
      tagDisplayName: stats.tag.displayName,
      tagCategory: stats.tag.category,
      postCount: stats.postCount,
      recentPostCount: stats.recentPostCount,
      oldestPostDate: stats.oldestPostDate,
      newestPostDate: stats.newestPostDate,
    }))
    .sort((a, b) => b.postCount - a.postCount);
}

/**
 * Store trending tags calculation results
 */
export async function storeTrendingTags(
  tags: Array<{
    tagId: string;
    score: number;
    postCount: number;
    rank: number;
    relatedContext?: string;
  }>,
  windowStart: Date,
  windowEnd: Date
): Promise<void> {
  // Store all trending tags in a transaction
  await prisma.$transaction(async (tx) => {
    await Promise.all(
      tags.map((tag) =>
        tx.trendingTag.create({
          data: {
            tagId: tag.tagId,
            score: tag.score,
            postCount: tag.postCount,
            rank: tag.rank,
            windowStart,
            windowEnd,
            relatedContext: tag.relatedContext || null,
          },
        })
      )
    );
  });

  logger.info(
    'Stored trending tags',
    {
      count: tags.length,
      windowStart,
      windowEnd,
    },
    'TagStorageService'
  );
}

/**
 * Get current trending tags (most recent calculation)
 */
export async function getCurrentTrendingTags(limit = 10) {
  // Get the most recent calculation timestamp
  const latestCalculation = await prisma.trendingTag.findFirst({
    orderBy: { calculatedAt: 'desc' },
    select: { calculatedAt: true },
  });

  if (!latestCalculation) {
    return [];
  }

  // Get all trending tags from the latest calculation
  // Use >= comparison to handle potential timestamp precision issues
  const cutoffTime = new Date(latestCalculation.calculatedAt.getTime() - 1000); // 1 second buffer

  return await prisma.trendingTag.findMany({
    where: {
      calculatedAt: {
        gte: cutoffTime,
      },
    },
    include: {
      tag: true,
    },
    orderBy: {
      rank: 'asc',
    },
    take: limit,
  });
}

/**
 * Get related/co-occurring tags for a given tag
 * (for "Trending with X" context)
 */
export async function getRelatedTags(
  tagId: string,
  limit = 3
): Promise<string[]> {
  // Find posts with this tag
  const postsWithTag = await prisma.postTag.findMany({
    where: { tagId },
    select: { postId: true },
    take: 100, // Sample recent posts
    orderBy: { createdAt: 'desc' },
  });

  const postIds = postsWithTag.map((pt) => pt.postId);

  if (postIds.length === 0) {
    return [];
  }

  // Find other tags that appear in the same posts
  // Using simpler query approach
  const coOccurringTags = await prisma.postTag.groupBy({
    by: ['tagId'],
    where: {
      postId: {
        in: postIds,
      },
      tagId: {
        not: tagId,
      },
    },
    _count: {
      tagId: true,
    },
    orderBy: {
      _count: {
        tagId: 'desc',
      },
    },
    take: limit,
  });

  // Get tag display names
  const tagIds = coOccurringTags.map((t) => t.tagId);
  const tags = await prisma.tag.findMany({
    where: {
      id: {
        in: tagIds,
      },
    },
    select: {
      id: true,
      displayName: true,
    },
  });

  // Map back to preserve order
  const tagMap = new Map(tags.map((t) => [t.id, t.displayName]));
  return tagIds
    .map((id) => tagMap.get(id))
    .filter((name): name is string => name !== undefined);
}
