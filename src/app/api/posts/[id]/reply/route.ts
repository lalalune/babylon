/**
 * API Route: /api/posts/[id]/reply
 * Methods: POST (reply to a post with rate limiting and quality checks)
 */

import { authenticate } from '@/lib/api/auth-middleware';
import { prisma } from '@/lib/database-service';
import { BusinessLogicError } from '@/lib/errors';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { parsePostId } from '@/lib/post-id-parser';
import { FollowingMechanics } from '@/lib/services/following-mechanics';
import { GroupChatInvite } from '@/lib/services/group-chat-invite';
import { MessageQualityChecker } from '@/lib/services/message-quality-checker';
import { ReplyRateLimiter } from '@/lib/services/reply-rate-limiter';
import { generateSnowflakeId } from '@/lib/snowflake';
import { ensureUserForAuth } from '@/lib/users/ensure-user';
import { PostIdParamSchema, ReplyToPostSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';

/**
 * POST /api/posts/[id]/reply
 * Reply to a post with comprehensive checks
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  // 1. Authenticate user
  const user = await authenticate(request);
  const { id: postId } = PostIdParamSchema.parse(await context.params);

  // 2. Parse and validate request body
  const body = await request.json();
  const { content, marketId, sentiment } = ReplyToPostSchema.parse(body);

  // 3. Extract NPC/author ID from post ID
  const parseResult = parsePostId(postId);

  // Require valid format for replies (unlike likes, which can use defaults)
  if (!parseResult.success) {
    throw new BusinessLogicError('Invalid post ID format', 'INVALID_POST_ID_FORMAT');
  }

    const { gameId, authorId: npcId, timestamp } = parseResult.metadata;

    const displayName = user.walletAddress
      ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
      : 'Anonymous';

    const { user: dbUser } = await ensureUserForAuth(user, { displayName });
    const canonicalUserId = dbUser.id;

    // 4. Check rate limiting
    const rateLimitResult = await ReplyRateLimiter.canReply(canonicalUserId, npcId);

    if (!rateLimitResult.allowed) {
      throw new BusinessLogicError(rateLimitResult.reason || 'Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    }

    // 5. Check message quality
    const qualityResult = await MessageQualityChecker.checkQuality(
      content,
      canonicalUserId,
      'reply',
      postId
    );

    if (!qualityResult.passed) {
      throw new BusinessLogicError(qualityResult.errors.join('; '), 'QUALITY_CHECK_FAILED');
    }

    // 6. Ensure user exists in database
    // 7. Ensure post exists (upsert pattern)
    await prisma.post.upsert({
      where: { id: postId },
      update: {},
      create: {
        id: postId,
        content: '[Game-generated post]',
        authorId: npcId,
        gameId,
        timestamp,
      },
    });

    // 8. Create comment
    const now = new Date();
    const comment = await prisma.comment.create({
      data: {
        id: await generateSnowflakeId(),
        content: content.trim(),
        postId,
        authorId: canonicalUserId,
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
          },
        },
      },
    });

    // 9. Record the interaction
    await ReplyRateLimiter.recordReply(
      canonicalUserId,
      npcId,
      postId,
      comment.id,
      qualityResult.score
    );

    // 10. Check for following chance
    const followingChance = await FollowingMechanics.calculateFollowingChance(
      canonicalUserId,
      npcId,
      rateLimitResult.replyStreak || 0,
      qualityResult.score
    );

    let followed = false;
    if (followingChance.willFollow) {
      await FollowingMechanics.recordFollow(
        canonicalUserId,
        npcId,
        `Streak: ${rateLimitResult.replyStreak}, Quality: ${qualityResult.score.toFixed(2)}`
      );
      followed = true;
    }

    // 11. Check for group chat invite chance (only if followed)
    let invitedToChat = false;
    let chatInfo = null;

    if (followed || (await FollowingMechanics.isFollowing(canonicalUserId, npcId))) {
      const inviteChance = await GroupChatInvite.calculateInviteChance(canonicalUserId, npcId);

      if (inviteChance.willInvite && inviteChance.chatId && inviteChance.chatName) {
        await GroupChatInvite.recordInvite(
          canonicalUserId,
          npcId,
          inviteChance.chatId,
          inviteChance.chatName
        );
        invitedToChat = true;
        chatInfo = {
          chatId: inviteChance.chatId,
          chatName: inviteChance.chatName,
          isOwned: inviteChance.isOwned,
        };
      }
    }

  // 12. Return success with all the feedback
  logger.info('Reply created successfully', {
    postId,
    userId: canonicalUserId,
    commentId: comment.id,
    followed,
    invitedToChat,
    marketId, // Optional: for analytics/tracking
    sentiment // Optional: for analytics/tracking
  }, 'POST /api/posts/[id]/reply');

  return successResponse(
    {
      comment: {
        id: comment.id,
        content: comment.content,
        postId: comment.postId,
        authorId: comment.authorId,
        createdAt: comment.createdAt,
        author: comment.User,
      },
      quality: {
        score: qualityResult.score,
        warnings: qualityResult.warnings,
        factors: qualityResult.factors,
      },
      streak: {
        current: rateLimitResult.replyStreak || 0,
        reason: rateLimitResult.reason,
      },
      following: {
        followed,
        probability: followingChance.probability,
        reasons: followingChance.reasons,
      },
      groupChat: {
        invited: invitedToChat,
        ...(chatInfo || {}),
      },
    },
    201
  );
});
