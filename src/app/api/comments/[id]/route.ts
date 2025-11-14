/**
 * Comment Management API
 * 
 * @description
 * Edit or delete individual comments. Only comment authors can modify
 * their own comments. Includes cascade deletion of replies and reactions.
 * 
 * **Features:**
 * - Author-only editing
 * - Author-only deletion
 * - Cascade delete (removes replies and reactions)
 * - Content validation
 * - RLS enforcement
 * 
 * @openapi
 * /api/comments/{id}:
 *   patch:
 *     tags:
 *       - Comments
 *     summary: Edit comment
 *     description: Updates comment content (author only)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 description: Updated comment content
 *     responses:
 *       200:
 *         description: Comment updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 content:
 *                   type: string
 *                 author:
 *                   type: object
 *                 likeCount:
 *                   type: integer
 *                 replyCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the comment author
 *       404:
 *         description: Comment not found
 *   delete:
 *     tags:
 *       - Comments
 *     summary: Delete comment
 *     description: Deletes comment and all replies (author only)
 *     security:
 *       - PrivyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedCommentId:
 *                   type: string
 *                 deletedRepliesCount:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not the comment author
 *       404:
 *         description: Comment not found
 * 
 * @example
 * ```typescript
 * // Edit comment
 * await fetch(`/api/comments/${commentId}`, {
 *   method: 'PATCH',
 *   headers: { 'Authorization': `Bearer ${token}` },
 *   body: JSON.stringify({
 *     content: 'Updated comment text'
 *   })
 * });
 * 
 * // Delete comment
 * const response = await fetch(`/api/comments/${commentId}`, {
 *   method: 'DELETE',
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { deletedRepliesCount } = await response.json();
 * console.log(`Deleted comment and ${deletedRepliesCount} replies`);
 * ```
 * 
 * @see {@link /lib/db/context} RLS context
 */

import type { NextRequest } from 'next/server';
import { authenticate } from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import {  NotFoundError, AuthorizationError } from '@/lib/errors';
import { IdParamSchema, UpdateCommentSchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
/**
 * PATCH /api/comments/[id]
 * Edit a comment (only by the author)
 */
export const PATCH = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: commentId } = IdParamSchema.parse(await context.params);

  // Parse and validate request body
  const body = await request.json();
  const { content } = UpdateCommentSchema.parse(body);

  // Update comment with RLS
  const updatedComment = await asUser(user, async (db) => {
    // Find comment
    const comment = await db.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundError('Comment', commentId);
    }

    // Check if user is the author
    if (comment.authorId !== user.userId) {
      throw new AuthorizationError('You can only edit your own comments', 'comment', 'edit');
    }

    // Update comment
    const updated = await db.comment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
      },
      include: {
        User: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
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

    return updated;
  });

  logger.info('Comment updated successfully', { commentId, userId: user.userId }, 'PATCH /api/comments/[id]');

  return successResponse({
    id: updatedComment.id,
    content: updatedComment.content,
    postId: updatedComment.postId,
    authorId: updatedComment.authorId,
    parentCommentId: updatedComment.parentCommentId,
    createdAt: updatedComment.createdAt,
    updatedAt: updatedComment.updatedAt,
    author: updatedComment.User,
    likeCount: updatedComment._count.Reaction,
    replyCount: updatedComment._count.other_Comment,
  });
});

/**
 * DELETE /api/comments/[id]
 * Delete a comment (only by the author)
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // Authenticate user
  const user = await authenticate(request);
  const { id: commentId } = IdParamSchema.parse(await context.params);

  // Delete comment with RLS
  const deletedRepliesCount = await asUser(user, async (db) => {
    // Find comment
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: {
        _count: {
          select: {
            other_Comment: true,
          },
        },
      },
    });

    if (!comment) {
      throw new NotFoundError('Comment', commentId);
    }

    // Check if user is the author
    if (comment.authorId !== user.userId) {
      throw new AuthorizationError('You can only delete your own comments', 'comment', 'delete');
    }

    const repliesCount = comment._count.other_Comment;

    // Delete comment (cascade will delete reactions and replies)
    await db.comment.delete({
      where: { id: commentId },
    });

    return repliesCount;
  });

  logger.info('Comment deleted successfully', { commentId, userId: user.userId, deletedRepliesCount }, 'DELETE /api/comments/[id]');

  return successResponse({
    message: 'Comment deleted successfully',
    deletedCommentId: commentId,
    deletedRepliesCount,
  });
});
