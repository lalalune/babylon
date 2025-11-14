/**
 * API Route: /api/users/[userId]/share
 * Methods: POST (track share action and award points)
 */

import {
  authenticate,
  successResponse
} from '@/lib/api/auth-middleware'
import { prisma } from '@/lib/database-service'
import { AuthorizationError } from '@/lib/errors'
import { withErrorHandling } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import { PointsService } from '@/lib/services/points-service'
import { UserIdParamSchema, SnowflakeIdSchema } from '@/lib/validation/schemas'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { generateSnowflakeId } from '@/lib/snowflake'

const ShareRequestSchema = z.object({
  platform: z.enum(['twitter', 'farcaster', 'link', 'telegram', 'discord']),
  contentType: z.enum(['post', 'profile', 'market', 'referral', 'leaderboard']),
  contentId: SnowflakeIdSchema.optional(),
  url: z.string().url().optional()
});

/**
 * POST /api/users/[userId]/share
 * Track a share action and award points
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Authenticate user
  const authUser = await authenticate(request);
  const params = await context.params;
  const { userId } = UserIdParamSchema.parse(params);
  const targetUser = await requireUserByIdentifier(userId, { id: true });
  const canonicalUserId = targetUser.id;

  // Verify user is sharing their own content
  if (authUser.userId !== canonicalUserId) {
    throw new AuthorizationError('You can only track your own shares', 'share-action', 'create');
  }

  // Parse and validate request body
  const body = await request.json();
  const { platform, contentType, contentId, url } = ShareRequestSchema.parse(body);

  // Create share action record
  const shareAction = await prisma.shareAction.create({
    data: {
      id: await generateSnowflakeId(),
      userId: canonicalUserId,
      platform,
      contentType,
      contentId,
      url,
      pointsAwarded: false,
    },
  });

  // Award points for the share
  const pointsResult = await PointsService.awardShareAction(
    canonicalUserId,
    platform,
    contentType,
    contentId
  );

  // Update share action to mark points as awarded
  if (pointsResult.success && pointsResult.pointsAwarded > 0) {
    await prisma.shareAction.update({
      where: { id: shareAction.id },
      data: { pointsAwarded: true },
    });
  }

  logger.info(
    `User ${canonicalUserId} shared ${contentType} on ${platform}`,
    { userId: canonicalUserId, platform, contentType, contentId, pointsAwarded: pointsResult.pointsAwarded },
    'POST /api/users/[userId]/share'
  );

  return successResponse({
    shareAction,
    points: {
      awarded: pointsResult.pointsAwarded,
      newTotal: pointsResult.newTotal,
      alreadyAwarded: pointsResult.alreadyAwarded,
    },
  });
});
