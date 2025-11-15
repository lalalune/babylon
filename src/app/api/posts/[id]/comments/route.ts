/**
 * API Route: /api/posts/[id]/comments
 * Methods: GET (get comments), POST (add comment)
 */

import { authenticate, optionalAuth } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { CreateCommentSchema, PostIdParamSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { notifyCommentOnPost, notifyReplyToComment, notifyMention } from '@/lib/services/notification-service';
import { prisma } from '@/lib/prisma';
import { ensureUserForAuth, getCanonicalUserId } from '@/lib/users/ensure-user';
import type { NextRequest } from 'next/server';
import { generateSnowflakeId } from '@/lib/snowflake';
import { checkRateLimitAndDuplicates, RATE_LIMIT_CONFIGS, DUPLICATE_DETECTION_CONFIGS } from '@/lib/rate-limiting';
import { hasBlocked } from '@/lib/moderation/filters';

/**
 * Build threaded comment structure recursively
 */
type CommentTreeItem = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  userName: string;
  userUsername: string | null;
  userAvatar: string | null;
  parentCommentId: string | null;
  parentCommentAuthorName?: string;
  likeCount: number;
  isLiked: boolean;
  replies: CommentTreeItem[];
};

interface CommentInput {
  id: string;
  content: string;
  authorId: string;
  parentCommentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  User: {
    id: string;
    username: string | null;
    displayName: string | null;
    profileImageUrl: string | null;
    isActor: boolean;
  };
  Reaction: Array<{ id: string; userId: string; type: string }>;
  _count: { Reaction: number };
}

function buildCommentTree(
  comments: CommentInput[],
  parentId: string | null = null
): CommentTreeItem[] {
  // Helper to find parent comment author name
  const findParentAuthorName = (parentCommentId: string | null): string | undefined => {
    if (!parentCommentId) return undefined;
    const parentComment = comments.find(c => c.id === parentCommentId);
    if (parentComment) {
      return parentComment.User.displayName || parentComment.User.username || 'Anonymous';
    }
    return undefined;
  };

  return comments
    .filter((comment) => comment.parentCommentId === parentId)
    .map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      userId: comment.User.id,
      userName: comment.User.displayName || comment.User.username || 'Anonymous',
      userUsername: comment.User.username || null,
      userAvatar: comment.User.profileImageUrl,
      parentCommentId: comment.parentCommentId,
      parentCommentAuthorName: findParentAuthorName(comment.parentCommentId),
      likeCount: comment._count.Reaction,
      isLiked: comment.Reaction.length > 0,
      replies: buildCommentTree(comments, comment.id),
    }));
}

/**
 * GET /api/posts/[id]/comments
 * Get threaded comments for a post
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: postId } = await context.params;

  // Optional authentication (to show liked status for logged-in users)
  const user = await optionalAuth(request);

  // Validate post ID
  if (!postId) {
    throw new BusinessLogicError('Post ID is required', 'POST_ID_REQUIRED');
  }

  const canonicalUserId = user ? getCanonicalUserId(user) : undefined;

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    throw new NotFoundError('Post', postId);
  }

  if (post.deletedAt) {
    throw new NotFoundError('Post (deleted)', postId);
  }

    // Get all comments for the post (including nested replies)
    const comments = await prisma.comment.findMany({
      where: {
        postId,
      },
      include: {
        User: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
            isActor: true,
          },
        },
        _count: {
          select: {
            Reaction: {
              where: {
                type: 'like',
              },
            },
            other_Comment: true,
          },
        },
        Reaction: canonicalUserId
          ? {
              where: {
                userId: canonicalUserId,
                type: 'like',
              },
              select: {
                id: true,
              },
            }
          : false,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Build threaded structure
    const threadedComments = buildCommentTree(comments as CommentInput[]);

    // Get total comment count (including replies)
    const totalComments = comments.length;

  logger.info('Comments fetched successfully', { postId, total: totalComments }, 'GET /api/posts/[id]/comments');

  return successResponse({
    data: {
      comments: threadedComments,
      total: totalComments,
    },
  });
});

/**
 * POST /api/posts/[id]/comments
 * Add a comment to a post
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: postId } = PostIdParamSchema.parse(await context.params);

  // Parse and validate request body
  const body = await request.json();
  const validatedData = CreateCommentSchema.parse(body);
  const { content, parentCommentId } = validatedData;

  if (content.length > 5000) {
    throw new BusinessLogicError('Comment is too long (max 5000 characters)', 'COMMENT_TOO_LONG');
  }

  // Apply rate limiting and duplicate detection
  const rateLimitError = checkRateLimitAndDuplicates(
    user.userId,
    content,
    RATE_LIMIT_CONFIGS.CREATE_COMMENT,
    DUPLICATE_DETECTION_CONFIGS.COMMENT
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
    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    // If post doesn't exist, try to auto-create it based on format
    if (!post) {
      // Try multiple post ID formats
      // Format 1: gameId-gameTimestamp-authorId-isoTimestamp (e.g., babylon-1761441310151-kash-patrol-2025-10-01T02:12:00Z)
      // Format 2: post-{timestamp}-{random} (e.g., post-1762099655817-0.7781412938928327)
      // Format 3: post-{timestamp}-{actorId}-{random} (e.g., post-1762099655817-kash-patrol-abc123)

      let gameId = 'babylon'; // default game
      let authorId = 'system'; // default author for game-generated posts
      let timestamp = new Date();

      // Check Format 1: Has ISO timestamp at the end
      const isoTimestampMatch = postId.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)$/);

      if (isoTimestampMatch && isoTimestampMatch[1]) {
        // Format 1: gameId-gameTimestamp-authorId-isoTimestamp
        const timestampStr = isoTimestampMatch[1];
        timestamp = new Date(timestampStr);

        // Extract gameId (first part before first hyphen)
        const firstHyphenIndex = postId.indexOf('-');
        if (firstHyphenIndex !== -1) {
          gameId = postId.substring(0, firstHyphenIndex);

          // Extract authorId (everything between second hyphen and the ISO timestamp)
          const withoutGameId = postId.substring(firstHyphenIndex + 1);
          const secondHyphenIndex = withoutGameId.indexOf('-');
          if (secondHyphenIndex !== -1) {
            const afterGameTimestamp = withoutGameId.substring(secondHyphenIndex + 1);
            authorId = afterGameTimestamp.substring(0, afterGameTimestamp.lastIndexOf('-' + timestampStr));
          }
        }
      } else if (postId.startsWith('post-')) {
        // Format 2 or 3: GameEngine format
        const parts = postId.split('-');

        if (parts.length >= 3 && parts[1]) {
          // Try to extract timestamp from second part
          const timestampPart = parts[1];
          const timestampNum = parseInt(timestampPart, 10);

          if (!isNaN(timestampNum) && timestampNum > 1000000000000) {
            // Valid timestamp (milliseconds since epoch)
            timestamp = new Date(timestampNum);

            // Check if third part looks like an actor ID (not a decimal)
            if (parts.length >= 4 && parts[2] && !parts[2].includes('.')) {
              // Format 3: post-{timestamp}-{actorId}-{random}
              authorId = parts[2];
            }
            // Otherwise Format 2: post-{timestamp}-{random}
            // Keep default authorId = 'system'
          }
        }
      } else {
        // Unknown format, reject
        throw new BusinessLogicError('Invalid post ID format', 'INVALID_POST_ID_FORMAT');
      }

      // Ensure post exists (upsert pattern)
      const upsertedPost = await prisma.post.upsert({
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
      
      // Check if the upserted/existing post is deleted
      if (upsertedPost.deletedAt) {
        throw new BusinessLogicError('Cannot comment on deleted post', 'POST_DELETED');
      }
    } else if (post.deletedAt) {
      // Post exists but is deleted - cannot comment
      throw new BusinessLogicError('Cannot comment on deleted post', 'POST_DELETED');
    }

    // If parentCommentId provided, validate it exists and belongs to this post
    if (parentCommentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentCommentId },
      });

      if (!parentComment) {
        throw new NotFoundError('Parent comment', parentCommentId);
      }

      if (parentComment.postId !== postId) {
        throw new BusinessLogicError('Parent comment does not belong to this post', 'PARENT_COMMENT_MISMATCH');
      }
    }

    // Get the post to find the authorId for notifications
    // Check if author is a User (not an Actor) - only Users can receive notifications
    const postRecord = await prisma.post.findUnique({
      where: { id: postId },
      select: { 
        id: true,
        authorId: true,
      },
    });

    // Check if either user has blocked the other
    if (postRecord) {
      const [isBlocked, hasBlockedMe] = await Promise.all([
        hasBlocked(postRecord.authorId, canonicalUserId),
        hasBlocked(canonicalUserId, postRecord.authorId),
      ]);

      if (isBlocked || hasBlockedMe) {
        throw new BusinessLogicError('Cannot comment on this post', 'BLOCKED_USER');
      }
    }

    // Create comment
    const now = new Date();
    const comment = await prisma.comment.create({
      data: {
        id: await generateSnowflakeId(),
        content: content.trim(),
        postId,
        authorId: canonicalUserId,
        parentCommentId: parentCommentId || null,
        createdAt: now,
        updatedAt: now,
      },
      include: {
        User: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
            isActor: true,
          },
        },
        _count: {
          select: {
            Reaction: true,
            other_Comment: true,
          },
        },
      },
    });

    // Create notifications
    if (parentCommentId) {
      // Reply to comment - notify the parent comment author
      // Comments are always authored by Users, so we can safely notify
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentCommentId },
        select: { authorId: true },
      });
      if (parentComment && parentComment.authorId !== canonicalUserId) {
        await notifyReplyToComment(
          parentComment.authorId,
          canonicalUserId,
          postId,
          parentCommentId,
          comment.id
        );
      }
    } else {
      // Comment on post - notify the post author only if they're a User (not an Actor)
      // Check if authorId references a User (not an Actor)
      if (
        postRecord && 
        postRecord.authorId && 
        postRecord.authorId !== canonicalUserId
      ) {
        // Check if the authorId references a User (not an Actor)
        const postAuthorUser = await prisma.user.findUnique({
          where: { id: postRecord.authorId },
          select: { id: true },
        });
        
        if (postAuthorUser) {
          await notifyCommentOnPost(
            postRecord.authorId,
            canonicalUserId,
            postId,
            comment.id
          );
        }
      }
    }

    const mentions = content.match(/@(\w+)/g)!
    const usernames = [...new Set(mentions.map(m => m.substring(1)))]
    
    const mentionedUsers = await prisma.user.findMany({
      where: {
        username: { in: usernames },
      },
      select: { id: true, username: true },
    })

    await Promise.all(
      mentionedUsers.map(mentionedUser =>
        notifyMention(
          mentionedUser.id,
          canonicalUserId,
          postId,
          comment.id
        )
      )
    )

    logger.info('Sent mention notifications from comment', { 
      postId, 
      commentId: comment.id,
      mentionCount: mentionedUsers.length,
      mentionedUsernames: mentionedUsers.map(u => u.username)
    }, 'POST /api/posts/[id]/comments')

  logger.info('Comment created successfully', { postId, userId: canonicalUserId, commentId: comment.id, parentCommentId }, 'POST /api/posts/[id]/comments');

  return successResponse(
    {
      id: comment.id,
      content: comment.content,
      postId: comment.postId,
      authorId: comment.authorId,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: comment.User,
      likeCount: comment._count.Reaction,
      replyCount: comment._count.other_Comment,
    },
    201
  );
});
