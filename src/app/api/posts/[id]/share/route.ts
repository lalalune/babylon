/**
 * API Route: /api/posts/[id]/share
 * Methods: POST (share/repost), DELETE (unshare)
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/database-service';
import { authenticate } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { PostIdParamSchema, SharePostSchema } from '@/lib/validation/schemas';
import { notifyShare } from '@/lib/services/notification-service';
import { logger } from '@/lib/logger';
import { parsePostId } from '@/lib/post-id-parser';
import { ensureUserForAuth, getCanonicalUserId } from '@/lib/users/ensure-user';
import { generateSnowflakeId } from '@/lib/snowflake';
import { trackServerEvent } from '@/lib/posthog/server';

/**
 * POST /api/posts/[id]/share
 * Share/repost a post to user's feed
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: postId } = PostIdParamSchema.parse(await context.params);
  
  // Parse and validate request body (optional comment)
  const body = await request.json().catch(() => ({}));
  if (Object.keys(body).length > 0) {
    SharePostSchema.parse(body);
  }

  const fallbackDisplayName = user.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : 'Anonymous';

  await ensureUserForAuth(user, { displayName: fallbackDisplayName });
  const canonicalUserId = getCanonicalUserId(user);

    // Check if post exists first
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    // If post doesn't exist, try to auto-create it based on format
    if (!post) {
      // Parse post ID to extract metadata
      const parseResult = parsePostId(postId);

      // Require valid format for shares (unlike likes, which can use defaults)
      if (!parseResult.success) {
        throw new BusinessLogicError('Invalid post ID format', 'INVALID_POST_ID_FORMAT');
      }

      const { gameId, authorId, timestamp } = parseResult.metadata;

      // Ensure post exists (upsert pattern)
      await prisma.post.upsert({
        where: { id: postId },
        update: {},  // Don't update if exists
        create: {
          id: postId,
          content: '[Game-generated post]',  // Placeholder content
          authorId,
          gameId,
          timestamp,
        },
      });
    }

    // Check if already shared
    const existingShare = await prisma.share.findUnique({
      where: {
        userId_postId: {
        userId: canonicalUserId,
          postId,
        },
      },
    });

    if (existingShare) {
      throw new BusinessLogicError('Post already shared', 'ALREADY_SHARED');
    }

    // Create share record
    await prisma.share.create({
      data: {
        userId: canonicalUserId,
        postId,
      },
    });

    // Create a repost post (like a retweet) that shows on user's profile and feed
    // Use Snowflake ID for repost
    const repostId = generateSnowflakeId();
    
    // Get original post content for repost
    const originalPost = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        content: true,
        authorId: true,
        timestamp: true,
      },
    });

    if (originalPost) {
      // Create repost post with reference to original
      // The content will be the original post content, displayed as a repost
      await prisma.post.create({
        data: {
          id: repostId,
          content: originalPost.content,
          authorId: canonicalUserId, // Repost author is the user who shared
          timestamp: new Date(),
          // originalPostId: postId, // Store reference to original post - temporarily removed
        },
      });
    }

    // Create notification for post author (if not self-share)
    // Check if author is a User (not an Actor) before notifying
    const postAuthor = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        authorId: true,
      },
    });

    if (
      postAuthor &&
      postAuthor.authorId &&
      postAuthor.authorId !== canonicalUserId
    ) {
      // Check if the authorId references a User (not an Actor)
      const postAuthorUser = await prisma.user.findUnique({
        where: { id: postAuthor.authorId },
        select: { id: true },
      });
      
      if (postAuthorUser) {
        await notifyShare(
          postAuthor.authorId,
          canonicalUserId,
          postId
        );
      }
    }

    // Get updated share count
    const shareCount = await prisma.share.count({
      where: {
        postId,
      },
    });

  logger.info('Post shared successfully', { postId, userId: canonicalUserId, shareCount }, 'POST /api/posts/[id]/share');

  // Track post shared event
  trackServerEvent(canonicalUserId, 'post_shared', {
    postId,
    originalAuthorId: postAuthor?.authorId,
    shareCount,
    repostId,
  }).catch((error) => {
    logger.warn('Failed to track post_shared event', { error });
  });

  return successResponse(
    {
      data: {
        shareCount,
        isShared: true,
      },
    },
    201
  );
});

/**
 * DELETE /api/posts/[id]/share
 * Unshare/remove repost
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: postId } = PostIdParamSchema.parse(await context.params);

  const fallbackDisplayName = user.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : 'Anonymous';

  await ensureUserForAuth(user, { displayName: fallbackDisplayName });
  const canonicalUserId = getCanonicalUserId(user);

    // Find existing share
    const share = await prisma.share.findUnique({
      where: {
        userId_postId: {
          userId: canonicalUserId,
          postId,
        },
      },
    });

    if (!share) {
      throw new NotFoundError('Share', `${postId}-${canonicalUserId}`);
    }

    // Delete repost post if it exists
    // Repost posts have IDs like: repost-{originalPostId}-{userId}-{timestamp}
    // Note: originalPostId field temporarily removed, using ID pattern matching instead
    const repostIdPattern = `repost-${postId}-${canonicalUserId}-`;
    // Fetch all repost posts by this user and filter by pattern
    const allReposts = await prisma.post.findMany({
      where: {
        authorId: canonicalUserId,
        id: { contains: repostIdPattern },
      },
    });
    const repostPosts = allReposts.filter(p => p.id.startsWith(repostIdPattern));

    // Delete all repost posts for this share
    if (repostPosts.length > 0) {
      await prisma.post.deleteMany({
        where: {
          id: {
            in: repostPosts.map((p) => p.id),
          },
        },
      });
    }

    // Delete share
    await prisma.share.delete({
      where: {
        id: share.id,
      },
    });

    // Get updated share count
    const shareCount = await prisma.share.count({
      where: {
        postId,
      },
    });

  logger.info('Post unshared successfully', { postId, userId: canonicalUserId, shareCount }, 'DELETE /api/posts/[id]/share');

  // Track post unshared event
  trackServerEvent(canonicalUserId, 'post_unshared', {
    postId,
    shareCount,
  }).catch((error) => {
    logger.warn('Failed to track post_unshared event', { error });
  });

  return successResponse({
    data: {
      shareCount,
      isShared: false,
    },
  });
});
