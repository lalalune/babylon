/**
 * API Route: /api/posts/[id]/like
 * Methods: POST (like), DELETE (unlike)
 */

import { authenticate } from '@/lib/api/auth-middleware';
import { prisma } from '@/lib/database-service';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { parsePostId } from '@/lib/post-id-parser';
import { trackServerEvent } from '@/lib/posthog/server';
import { notifyReactionOnPost } from '@/lib/services/notification-service';
import { NPCInteractionTracker } from '@/lib/services/npc-interaction-tracker';
import { generateSnowflakeId } from '@/lib/snowflake';
import { ensureUserForAuth } from '@/lib/users/ensure-user';
import { PostIdParamSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';
import { invalidateCache, CACHE_KEYS } from '@/lib/cache-service';
import { checkRateLimitAndDuplicates, RATE_LIMIT_CONFIGS } from '@/lib/rate-limiting';

/**
 * POST /api/posts/[id]/like
 * Like a post
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: postId } = PostIdParamSchema.parse(await context.params);

  // Apply rate limiting (no duplicate detection needed - DB prevents duplicate likes)
  const rateLimitError = checkRateLimitAndDuplicates(
    user.userId,
    null,
    RATE_LIMIT_CONFIGS.LIKE_POST
  );
  if (rateLimitError) {
    return rateLimitError;
  }

    const displayName = user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
      : 'Anonymous';

    const { user: dbUser } = await ensureUserForAuth(user, { displayName });
    const canonicalUserId = dbUser.id;

    // Check if post exists first
    let post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      const parseResult = parsePostId(postId);
      const { gameId, authorId, timestamp } = parseResult.metadata;

      post = await prisma.post.create({
        data: {
          id: postId,
          content: '[Game-generated post]',
          authorId,
          gameId,
          timestamp,
        },
      });
    }

    // Check if post is deleted - allow likes to be removed but not added
    if (post.deletedAt) {
      // Allow unlike but not like
      const existingReaction = await prisma.reaction.findUnique({
        where: {
          postId_userId_type: {
            postId,
            userId: canonicalUserId,
            type: 'like',
          },
        },
      });
      
      if (!existingReaction) {
        // Trying to add a new like to deleted post - reject
        throw new BusinessLogicError('Cannot like deleted post', 'POST_DELETED');
      }
      // If reaction exists, allow the unlike action to proceed
    }

    // Check if already liked
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        postId_userId_type: {
          postId,
          userId: canonicalUserId,
          type: 'like',
        },
      },
    });

    if (existingReaction) {
      throw new BusinessLogicError('Post already liked', 'ALREADY_LIKED');
    }

    // Create like reaction
    await prisma.reaction.create({
      data: {
        id: await generateSnowflakeId(),
        postId,
        userId: canonicalUserId,
        type: 'like',
      },
    });

    // Create notification for post author (if not self-like)
    if (post.authorId && post.authorId !== canonicalUserId && post.authorId !== 'unknown') {
      await notifyReactionOnPost(
        post.authorId,
        canonicalUserId,
        postId,
        'like'
      );
    }

    // Track interaction with NPC (if post author is NPC)
    await NPCInteractionTracker.trackLike(canonicalUserId, postId).catch((error) => {
      logger.warn('Failed to track NPC interaction', { error });
    });

    // Get updated like count
    const likeCount = await prisma.reaction.count({
      where: {
        postId,
        type: 'like',
      },
    });

  // Invalidate interaction cache for this post
  await invalidateCache(`post:${postId}:interactions:*`, { namespace: CACHE_KEYS.POST });

  logger.info('Post liked successfully', { postId, userId: canonicalUserId, likeCount }, 'POST /api/posts/[id]/like');

  // Track post liked event
  trackServerEvent(canonicalUserId, 'post_liked', {
    postId,
    authorId: post.authorId,
    likeCount,
  }).catch((error) => {
    logger.warn('Failed to track post_liked event', { error });
  });

  return successResponse({
    data: {
      likeCount,
      isLiked: true,
    },
  });
});

/**
 * DELETE /api/posts/[id]/like
 * Unlike a post
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: postId } = await context.params;

  // Validate post ID
  if (!postId) {
    throw new BusinessLogicError('Post ID is required', 'POST_ID_REQUIRED');
  }

    // Ensure user exists in database (upsert pattern)
  const displayName = user.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : 'Anonymous';

  const { user: dbUser } = await ensureUserForAuth(user, { displayName });
  const canonicalUserId = dbUser.id;

    // Find existing like
    const reaction = await prisma.reaction.findUnique({
      where: {
        postId_userId_type: {
          postId,
          userId: canonicalUserId,
          type: 'like',
        },
      },
    });

    if (!reaction) {
      throw new NotFoundError('Like', `${postId}-${canonicalUserId}`);
    }

    // Delete like
    await prisma.reaction.delete({
      where: {
        id: reaction.id,
      },
    });

    // Get updated like count
    const likeCount = await prisma.reaction.count({
      where: {
        postId,
        type: 'like',
      },
    });

  // Invalidate interaction cache for this post
  await invalidateCache(`post:${postId}:interactions:*`, { namespace: CACHE_KEYS.POST });

  logger.info('Post unliked successfully', { postId, userId: canonicalUserId, likeCount }, 'DELETE /api/posts/[id]/like');

  // Track post unliked event
  trackServerEvent(canonicalUserId, 'post_unliked', {
    postId,
    likeCount,
  }).catch((error) => {
    logger.warn('Failed to track post_unliked event', { error });
  });

  return successResponse({
    data: {
      likeCount,
      isLiked: false,
    },
  });
});
