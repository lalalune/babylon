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

    // Get interaction counts and user states for each post
    const transformedPosts = await Promise.all(
      postsToReturn.map(async (post) => {
        const [likeCount, commentCount, shareCount, userLike, userShare] =
          await Promise.all([
            db.reaction.count({
              where: { postId: post.id, type: 'like' },
            }),
            db.comment.count({
              where: { postId: post.id },
            }),
            db.share.count({
              where: { postId: post.id },
            }),
            db.reaction.findUnique({
              where: {
                postId_userId_type: {
                  postId: post.id,
                  userId: user.userId,
                  type: 'like',
                },
              },
            }),
            db.share.findUnique({
              where: {
                userId_postId: {
                  userId: user.userId,
                  postId: post.id,
                },
              },
            }),
          ]);

        return {
          id: post.id,
          content: post.content,
          createdAt: post.createdAt,
          timestamp: post.timestamp,
          authorId: post.authorId,
          gameId: post.gameId,
          dayNumber: post.dayNumber,
          interactions: {
            likeCount,
            commentCount,
            shareCount,
            isLiked: !!userLike,
            isShared: !!userShare,
          },
        };
      })
    );

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
