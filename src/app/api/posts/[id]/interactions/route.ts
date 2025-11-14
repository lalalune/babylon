/**
 * API Route: /api/posts/[id]/interactions
 * Methods: GET (get all interaction counts and user's interaction state)
 */

import type { NextRequest } from 'next/server';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { PostIdParamSchema, PostInteractionsQuerySchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { getCacheOrFetch, CACHE_KEYS } from '@/lib/cache-service';

/**
 * GET /api/posts/[id]/interactions
 * Get aggregated interaction data for a post
 * Includes: like count, comment count, share count
 * If authenticated: also returns user's interaction state (isLiked, isShared)
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: postId } = PostIdParamSchema.parse(await context.params);
  
  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    includeComments: searchParams.get('includeComments') || 'true',
    includeReactions: searchParams.get('includeReactions') || 'true',
    includeShares: searchParams.get('includeShares') || 'false',
    limit: searchParams.get('limit')
  };
  PostInteractionsQuerySchema.parse(queryParams);

  // Optional authentication
  const user = await optionalAuth(request);

  // OPTIMIZED: Cache post interactions (called for every post in feed!)
  const cacheKey = user 
    ? `post:${postId}:interactions:user:${user.userId}`
    : `post:${postId}:interactions:public`;
  
  const result = await getCacheOrFetch(
    cacheKey,
    async () => {
      // Get interactions with RLS
      return await asUser(user, async (db) => {
        // Check if post exists - if not, return zero counts
        const post = await db.post.findUnique({
          where: { id: postId },
          select: { id: true, deletedAt: true },
        });

        if (!post || post.deletedAt) {
          return {
            likeCount: 0,
            commentCount: 0,
            shareCount: 0,
            userLike: null,
            userShare: null,
          };
        }

        // Get all interaction counts in parallel
        const [likeCount, commentCount, shareCount, userLike, userShare] =
          await Promise.all([
            // Count likes
            db.reaction.count({
              where: {
                postId,
                type: 'like',
              },
            }),
            // Count comments (including replies)
            db.comment.count({
              where: {
                postId,
              },
            }),
            // Count shares
            db.share.count({
              where: {
                postId,
              },
            }),
            // Check if user liked (if authenticated)
            user
              ? db.reaction.findUnique({
                  where: {
                    postId_userId_type: {
                      postId,
                      userId: user.userId,
                      type: 'like',
                    },
                  },
                })
              : Promise.resolve(null),
            // Check if user shared (if authenticated)
            user
              ? db.share.findUnique({
                  where: {
                    userId_postId: {
                      userId: user.userId,
                      postId,
                    },
                  },
                })
              : Promise.resolve(null),
          ]);

        return { likeCount, commentCount, shareCount, userLike, userShare };
      });
    },
    {
      namespace: CACHE_KEYS.POST,
      ttl: 30, // 30 second cache (frequent but can be slightly stale)
    }
  );

  if (result.likeCount === 0 && result.commentCount === 0 && result.shareCount === 0) {
    // Post hasn't been created yet (no interactions)
    logger.info('Post interactions fetched (not created yet)', { postId }, 'GET /api/posts/[id]/interactions');
    return successResponse({
      postId,
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
      isLiked: false,
      isShared: false,
      fetchedAt: new Date().toISOString(),
    });
  }

  logger.info('Post interactions fetched successfully', { postId, likeCount: result.likeCount, commentCount: result.commentCount, shareCount: result.shareCount }, 'GET /api/posts/[id]/interactions');

  return successResponse({
    postId,
    likeCount: result.likeCount,
    commentCount: result.commentCount,
    shareCount: result.shareCount,
    isLiked: !!result.userLike,
    isShared: !!result.userShare,
    // Include timestamp for cache invalidation
    fetchedAt: new Date().toISOString(),
  });
});
