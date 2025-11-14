/**
 * API Route: /api/comments/[id]/like
 * Methods: POST (like), DELETE (unlike)
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/database-service';
import { ensureUserForAuth } from '@/lib/users/ensure-user';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { IdParamSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { notifyReactionOnComment } from '@/lib/services/notification-service';
import { generateSnowflakeId } from '@/lib/snowflake';
import { checkRateLimitAndDuplicates, RATE_LIMIT_CONFIGS } from '@/lib/rate-limiting';
/**
 * POST /api/comments/[id]/like
 * Like a comment
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: commentId } = IdParamSchema.parse(await context.params);

  // Apply rate limiting (no duplicate detection needed - DB prevents duplicate likes)
  const rateLimitError = checkRateLimitAndDuplicates(
    user.userId,
    null,
    RATE_LIMIT_CONFIGS.LIKE_COMMENT
  );
  if (rateLimitError) {
    return rateLimitError;
  }

  // Ensure user exists in database (upsert pattern)
    const displayName = user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
      : 'Anonymous';

    const { user: dbUser } = await ensureUserForAuth(user, { displayName });
    const canonicalUserId = dbUser.id;

  // Check if comment exists
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new NotFoundError('Comment', commentId);
  }

  // Check if already liked
  const existingReaction = await prisma.reaction.findUnique({
    where: {
      commentId_userId_type: {
        commentId,
        userId: canonicalUserId,
        type: 'like',
      },
    },
  });

  if (existingReaction) {
    throw new BusinessLogicError('Comment already liked', 'ALREADY_LIKED');
  }

  // Create like reaction
  const reaction = await prisma.reaction.create({
    data: {
      id: await generateSnowflakeId(),
      commentId,
      userId: canonicalUserId,
      type: 'like',
    },
  });

  // Create notification for comment author (if not self-like)
  if (comment.authorId && comment.authorId !== canonicalUserId) {
    await notifyReactionOnComment(
      comment.authorId,
      canonicalUserId,
      commentId,
      comment.postId,
      'like'
    );
  }

  // Get updated like count
  const likeCount = await prisma.reaction.count({
    where: {
      commentId,
      type: 'like',
    },
  });

  logger.info('Comment liked successfully', { commentId, userId: canonicalUserId, likeCount }, 'POST /api/comments/[id]/like');

  return successResponse(
    {
      id: reaction.id,
      commentId,
      likeCount,
      isLiked: true,
      createdAt: reaction.createdAt,
    },
    201
  );
});

/**
 * DELETE /api/comments/[id]/like
 * Unlike a comment
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: commentId } = IdParamSchema.parse(await context.params);

  // Ensure user exists in database (upsert pattern)
  const displayName = user.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : 'Anonymous';

  const { user: dbUser } = await ensureUserForAuth(user, { displayName });
  const canonicalUserId = dbUser.id;

  // Find existing like
  const reaction = await prisma.reaction.findUnique({
    where: {
      commentId_userId_type: {
        commentId,
        userId: canonicalUserId,
        type: 'like',
      },
    },
  });

  if (!reaction) {
    throw new NotFoundError('Like', `${commentId}-${canonicalUserId}`);
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
      commentId,
      type: 'like',
    },
  });

  logger.info('Comment unliked successfully', { commentId, userId: canonicalUserId, likeCount }, 'DELETE /api/comments/[id]/like');

  return successResponse({
    commentId,
    likeCount,
    isLiked: false,
    message: 'Comment unliked successfully',
  });
});
