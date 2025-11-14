/**
 * API Route: /api/comments/[id]/replies
 * Methods: POST (add reply to comment)
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import {  NotFoundError } from '@/lib/errors';
import { IdParamSchema, CreateCommentSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
/**
 * POST /api/comments/[id]/replies
 * Add a reply to a comment
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: parentCommentId } = IdParamSchema.parse(await context.params);

  // Parse and validate request body
  const body = await request.json();
  const validatedData = CreateCommentSchema.parse(body);
  const { content } = validatedData;

  // Create reply with RLS
  const reply = await asUser(user, async (db) => {
    // Check if parent comment exists
    const parentComment = await db.comment.findUnique({
      where: { id: parentCommentId },
    });

    if (!parentComment) {
      throw new NotFoundError('Parent comment', parentCommentId);
    }

    // Auto-create post if it doesn't exist (for consistency)
    // PostId format: gameId-authorId-timestamp
    const postId = parentComment.postId;
    const postParts = postId.split('-');
    if (postParts.length >= 3) {
      const gameId = postParts[0];
      const authorId = postParts[1];
      const timestampStr = postParts.slice(2).join('-');

      if (gameId && authorId) {
        // Ensure post exists (upsert pattern)
        await db.post.upsert({
          where: { id: postId },
          update: {},  // Don't update if exists
          create: {
            id: postId,
            content: '[Game-generated post]',  // Placeholder content
            authorId,
            gameId,
            timestamp: new Date(timestampStr),
          },
        });
      }
    }

    // Create reply (comment with parentCommentId)
    const newReply = await db.comment.create({
      data: {
        content: content.trim(),
        postId: parentComment.postId,
        authorId: user.userId,
        parentCommentId,
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

    return newReply;
  });

  logger.info('Reply created successfully', { parentCommentId, userId: user.userId, replyId: reply.id }, 'POST /api/comments/[id]/replies');

  return successResponse(
    {
      id: reply.id,
      content: reply.content,
      postId: reply.postId,
      authorId: reply.authorId,
      parentCommentId: reply.parentCommentId,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      author: reply.author,
      likeCount: reply._count.reactions,
      replyCount: reply._count.replies,
    },
    201
  );
});
