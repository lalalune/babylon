/**
 * API Route: /api/posts/[id]/like
 * Methods: POST (like), DELETE (unlike)
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/database-service';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { PostIdParamSchema } from '@/lib/validation/schemas';
import { notifyReactionOnPost } from '@/lib/services/notification-service';
import { logger } from '@/lib/logger';
import { parsePostId } from '@/lib/post-id-parser';
import { ensureUserForAuth } from '@/lib/users/ensure-user';
import { trackServerEvent } from '@/lib/posthog/server';

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

    const displayName = user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
      : 'Anonymous';

    const { user: dbUser } = await ensureUserForAuth(user, { displayName });
    const canonicalUserId = dbUser.id;

    // Check if post exists first
    let post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true },
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

    // Get updated like count
    const likeCount = await prisma.reaction.count({
      where: {
        postId,
        type: 'like',
      },
    });

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
