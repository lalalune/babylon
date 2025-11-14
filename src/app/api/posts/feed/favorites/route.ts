/**
 * API Route: /api/posts/feed/favorites
 * Methods: GET (get posts from favorited profiles)
 */

import type { NextRequest } from 'next/server';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { PostFeedQuerySchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';

/**
 * GET /api/posts/feed/favorites
 * Get posts from profiles the user has favorited
 * Query params:
 * - limit: number of posts to return (default 20, max 100)
 * - offset: pagination offset (default 0)
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Optional authentication - returns null if not authenticated
  const user = await optionalAuth(request);

  // If not authenticated, return empty array
  if (!user) {
    logger.info('Unauthenticated request for favorites feed', {}, 'GET /api/posts/feed/favorites');
    return successResponse({
      posts: [],
      total: 0,
      hasMore: false,
    });
  }

  // Parse and validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    limit: searchParams.get('limit'),
    page: searchParams.get('page')
  };
  const validatedQuery = PostFeedQuerySchema.partial().parse(queryParams);
  const limit = Math.min(validatedQuery.limit || 20, 100);
  const offset = validatedQuery.page ? (validatedQuery.page - 1) * limit : 0;

  // Get favorites feed with RLS
  const result = await asUser(user, async (db) => {
    // Get favorited profile IDs
    const favorites = await db.favorite.findMany({
      where: {
        userId: user.userId,
      },
      select: {
        targetUserId: true,
      },
    });

    const favoritedUserIds = favorites.map((f) => f.targetUserId);

    // If no favorites, return empty array
    if (favoritedUserIds.length === 0) {
      return { posts: [], totalCount: 0, hasMore: false };
    }

    // Get posts from favorited profiles
    const posts = await db.post.findMany({
      where: {
        authorId: {
          in: favoritedUserIds,
        },
        deletedAt: null, // Filter out deleted posts
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit + 1, // Take one extra to check if there are more
    });

    // Check if there are more posts
    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

    // Get total count
    const totalCount = await db.post.count({
      where: {
        authorId: {
          in: favoritedUserIds,
        },
      },
    });

    // Get interaction counts and user states - OPTIMIZED: Batch queries instead of N+1
    const postIds = postsToReturn.map(p => p.id);
    
    // Execute all queries in parallel (5 queries total instead of 5N)
    const [allReactions, allComments, allShares, userReactions, userShares] =
      await Promise.all([
        db.reaction.groupBy({
          by: ['postId'],
          where: { postId: { in: postIds }, type: 'like' },
          _count: { postId: true },
        }),
        db.comment.groupBy({
          by: ['postId'],
          where: { postId: { in: postIds } },
          _count: { postId: true },
        }),
        db.share.groupBy({
          by: ['postId'],
          where: { postId: { in: postIds } },
          _count: { postId: true },
        }),
        db.reaction.findMany({
          where: {
            postId: { in: postIds },
            userId: user.userId,
            type: 'like',
          },
          select: { postId: true },
        }),
        db.share.findMany({
          where: {
            postId: { in: postIds },
            userId: user.userId,
          },
          select: { postId: true },
        }),
      ]);

    // Create lookup maps for O(1) access
    const reactionMap = new Map(allReactions.map(r => [r.postId, r._count.postId]));
    const commentMap = new Map(allComments.map(c => [c.postId, c._count.postId]));
    const shareMap = new Map(allShares.map(s => [s.postId, s._count.postId]));
    const userReactionSet = new Set(userReactions.map(r => r.postId));
    const userShareSet = new Set(userShares.map(s => s.postId));

    // Transform posts synchronously using lookup maps
    const transformedPosts = postsToReturn.map((post) => ({
      id: post.id,
      content: post.content,
      createdAt: post.createdAt,
      timestamp: post.timestamp,
      authorId: post.authorId,
      gameId: post.gameId,
      dayNumber: post.dayNumber,
      interactions: {
        likeCount: reactionMap.get(post.id) ?? 0,
        commentCount: commentMap.get(post.id) ?? 0,
        shareCount: shareMap.get(post.id) ?? 0,
        isLiked: userReactionSet.has(post.id),
        isShared: userShareSet.has(post.id),
      },
    }));

    return { posts: transformedPosts, totalCount, hasMore };
  });

  logger.info('Favorites feed fetched successfully', { userId: user.userId, count: result.posts.length, total: result.totalCount }, 'GET /api/posts/feed/favorites');

  return successResponse({
    posts: result.posts,
    total: result.totalCount,
    hasMore: result.hasMore,
    limit,
    offset,
  });
});
