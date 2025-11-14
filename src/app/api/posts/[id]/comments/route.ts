/**
 * API Route: /api/posts/[id]/comments
 * Methods: GET (get comments), POST (add comment)
 */

import { authenticate, optionalAuth } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { BusinessLogicError, NotFoundError } from '@/lib/errors';
import { CreateCommentSchema, PostIdParamSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { notifyCommentOnPost, notifyReplyToComment } from '@/lib/services/notification-service';
import { prisma } from '@/lib/database-service';
import { ensureUserForAuth, getCanonicalUserId } from '@/lib/users/ensure-user';
import type { NextRequest } from 'next/server';

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

function buildCommentTree(
  comments: Array<{
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    parentCommentId: string | null;
    author: {
      id: string;
      displayName: string | null;
      username: string | null;
      profileImageUrl: string | null;
    };
    _count: {
      reactions: number;
      replies: number;
    };
    reactions: Array<{ id: string }>;
  }>,
  parentId: string | null = null
): CommentTreeItem[] {
  // Helper to find parent comment author name
  const findParentAuthorName = (parentCommentId: string | null): string | undefined => {
    if (!parentCommentId) return undefined;
    const parentComment = comments.find(c => c.id === parentCommentId);
    if (parentComment) {
      return parentComment.author.displayName || parentComment.author.username || 'Anonymous';
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
      userId: comment.author.id,
      userName: comment.author.displayName || comment.author.username || 'Anonymous',
      userUsername: comment.author.username || null,
      userAvatar: comment.author.profileImageUrl,
      parentCommentId: comment.parentCommentId,
      parentCommentAuthorName: findParentAuthorName(comment.parentCommentId),
      likeCount: comment._count.reactions,
      isLiked: comment.reactions.length > 0,
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

    // Get all comments for the post (including nested replies)
    const comments = await prisma.comment.findMany({
      where: {
        postId,
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
          },
        },
        _count: {
          select: {
            reactions: {
              where: {
                type: 'like',
              },
            },
            replies: true,
          },
        },
        reactions: canonicalUserId
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
    const threadedComments = buildCommentTree(comments);

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

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        postId,
        authorId: canonicalUserId,
        parentCommentId: parentCommentId || null,
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
          },
        },
        _count: {
          select: {
            reactions: true,
            replies: true,
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
      author: comment.author,
      likeCount: comment._count.reactions,
      replyCount: comment._count.replies,
    },
    201
  );
});
