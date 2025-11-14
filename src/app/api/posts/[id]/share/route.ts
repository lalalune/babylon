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
import { NPCInteractionTracker } from '@/lib/services/npc-interaction-tracker';
import { logger } from '@/lib/logger';
import { parsePostId } from '@/lib/post-id-parser';
import { ensureUserForAuth, getCanonicalUserId } from '@/lib/users/ensure-user';
import { generateSnowflakeId } from '@/lib/snowflake';
import { trackServerEvent } from '@/lib/posthog/server';
import { broadcastToChannel } from '@/lib/sse/event-broadcaster';
import { cachedDb } from '@/lib/cached-database-service';
import { checkRateLimitAndDuplicates, RATE_LIMIT_CONFIGS } from '@/lib/rate-limiting';

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
  
  // Apply rate limiting (no duplicate detection - DB prevents duplicate shares)
  const rateLimitError = checkRateLimitAndDuplicates(
    user.userId,
    null,
    RATE_LIMIT_CONFIGS.SHARE_POST
  );
  if (rateLimitError) {
    return rateLimitError;
  }
  
  const body = await request.json()
  const validatedBody = Object.keys(body).length > 0 ? SharePostSchema.parse(body) : { comment: undefined }
  const quoteComment = validatedBody.comment?.trim()

  const fallbackDisplayName = user.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : 'Anonymous';

  const { user: canonicalUser } = await ensureUserForAuth(user, { displayName: fallbackDisplayName });
  const canonicalUserId = canonicalUser.id;

    // Check if post exists first
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, deletedAt: true, authorId: true },
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
    } else if (post.deletedAt) {
      // Post exists but is deleted
      throw new BusinessLogicError('Cannot share deleted post', 'POST_DELETED');
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
        id: await generateSnowflakeId(),
        userId: canonicalUserId,
        postId,
      },
    });

    await NPCInteractionTracker.trackShare(canonicalUserId, postId)

    // Create a repost post (like a retweet) that shows on user's profile and feed
    // Use Snowflake ID for repost
    const repostId = await generateSnowflakeId();
    
    // Get original post content and author for repost
    const originalPost = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        content: true,
        authorId: true,
        timestamp: true,
      },
    });

    let repostPostData = null;

    if (originalPost) {
      // Get original author info (could be User, Actor, or Organization)
      const [originalUser, originalActor, originalOrg] = await Promise.all([
        prisma.user.findUnique({
          where: { id: originalPost.authorId },
          select: { username: true, displayName: true, profileImageUrl: true },
        }),
        prisma.actor.findUnique({
          where: { id: originalPost.authorId },
          select: { name: true, profileImageUrl: true },
        }),
        prisma.organization.findUnique({
          where: { id: originalPost.authorId },
          select: { name: true, imageUrl: true },
        }),
      ]);

      const originalAuthorName = originalUser?.displayName || originalUser?.username || originalActor?.name || originalOrg?.name || originalPost.authorId;
      const originalAuthorUsername = originalUser?.username || originalPost.authorId;
      const originalAuthorProfileImageUrl = originalUser?.profileImageUrl || originalActor?.profileImageUrl || originalOrg?.imageUrl;

      // If quote comment is provided, create a quote post with commentary
      // Otherwise, create a simple repost
      const repostContent = quoteComment 
        ? `${quoteComment}\n\n--- Reposted from @${originalAuthorUsername} ---\n${originalPost.content}`
        : originalPost.content;

      // Create repost post with reference to original
      const createdRepost = await prisma.post.create({
        data: {
          id: repostId,
          content: repostContent,
          authorId: canonicalUserId, // Repost author is the user who shared
          timestamp: new Date(),
          originalPostId: postId, // Store reference to original post
        },
      });

      // Format repost data for broadcast
      repostPostData = {
        id: createdRepost.id,
        content: createdRepost.content,
        authorId: createdRepost.authorId,
        authorName: canonicalUser.username || canonicalUser.displayName || `user_${canonicalUserId.slice(0, 8)}`,
        authorUsername: canonicalUser.username,
        authorDisplayName: canonicalUser.displayName,
        authorProfileImageUrl: canonicalUser.profileImageUrl,
        timestamp: createdRepost.timestamp.toISOString(),
        isRepost: true,
        originalPostId: postId,
        originalAuthorId: originalPost.authorId,
        originalAuthorName: originalAuthorName,
        originalAuthorUsername: originalAuthorUsername,
        originalAuthorProfileImageUrl: originalAuthorProfileImageUrl,
        originalContent: originalPost.content, // Include original content separately
        quoteComment: quoteComment || null,
      };

      await cachedDb.invalidatePostsCache()
      await cachedDb.invalidateActorPostsCache(canonicalUserId)
      logger.info('Invalidated post caches after repost', { repostId }, 'POST /api/posts/[id]/share')

      broadcastToChannel('feed', {
        type: 'new_post',
        post: repostPostData,
      })
      logger.info('Broadcast repost to feed channel', { repostId, postId }, 'POST /api/posts/[id]/share')
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

  trackServerEvent(canonicalUserId, 'post_shared', {
    postId,
    originalAuthorId: postAuthor?.authorId,
    shareCount,
    repostId,
  })

  return successResponse(
    {
      data: {
        shareCount,
        isShared: true,
        repostPost: repostPostData, // Include repost post data for optimistic UI
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
    // Since we don't have originalPostId field, we need to find reposts by:
    // 1. Posts authored by this user
    // 2. Created around the same time as the share record
    // 3. Content matches (either exact or with quote comment prefix)
    
    // Get the original post content to match against
    const originalPostContent = await prisma.post.findUnique({
      where: { id: postId },
      select: { content: true },
    });

    if (originalPostContent) {
      // Find repost posts created by this user around the time they shared
      // Look for posts created within a reasonable time window of the share
      const shareCreatedAt = share.createdAt;
      const windowStart = new Date(shareCreatedAt.getTime() - 1000); // 1 second before
      const windowEnd = new Date(shareCreatedAt.getTime() + 60000); // 1 minute after

      const potentialReposts = await prisma.post.findMany({
        where: {
          authorId: canonicalUserId,
          timestamp: {
            gte: windowStart,
            lte: windowEnd,
          },
          deletedAt: null,
        },
      });

      // Filter to find actual reposts (content matches original or contains it as quote)
      const repostPosts = potentialReposts.filter(p => {
        // Exact match (simple repost)
        if (p.content === originalPostContent.content) return true;
        // Quote post match (contains original content after separator)
        if (p.content.includes(originalPostContent.content)) return true;
        return false;
      });

      // Delete all repost posts for this share
      if (repostPosts.length > 0) {
        await prisma.post.deleteMany({
          where: {
            id: {
              in: repostPosts.map((p) => p.id),
            },
          },
        });
        logger.info('Deleted repost posts', { count: repostPosts.length, postIds: repostPosts.map(p => p.id) }, 'DELETE /api/posts/[id]/share');
      } else {
        logger.warn('No repost posts found to delete', { postId, userId: canonicalUserId, windowStart, windowEnd }, 'DELETE /api/posts/[id]/share');
      }
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

  await cachedDb.invalidatePostsCache()
  await cachedDb.invalidateActorPostsCache(canonicalUserId)
  logger.info('Invalidated post caches after unshare', { postId }, 'DELETE /api/posts/[id]/share')

  logger.info('Post unshared successfully', { postId, userId: canonicalUserId, shareCount }, 'DELETE /api/posts/[id]/share')

  trackServerEvent(canonicalUserId, 'post_unshared', {
    postId,
    shareCount,
  })

  return successResponse({
    data: {
      shareCount,
      isShared: false,
    },
  });
});
