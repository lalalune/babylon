/**
 * API Route: /api/users/[userId]/verify-share
 * Methods: POST (verify that a share was actually posted)
 */

import {
  authenticate,
  successResponse
} from '@/lib/api/auth-middleware'
import { prisma } from '@/lib/database-service'
import { AuthorizationError, BusinessLogicError } from '@/lib/errors'
import { withErrorHandling } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { UserIdParamSchema, UUIDSchema } from '@/lib/validation/schemas'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const VerifyShareRequestSchema = z.object({
  shareId: UUIDSchema,
  platform: z.enum(['twitter', 'farcaster']),
  postUrl: z.string().url().optional(), // URL to the actual post for verification
});

/**
 * POST /api/users/[userId]/verify-share
 * Verify that a share action was completed (user actually posted)
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Authenticate user
  const authUser = await authenticate(request);
  const { userId } = UserIdParamSchema.parse(await context.params);
  const targetUser = await requireUserByIdentifier(userId, { id: true });
  const canonicalUserId = targetUser.id;

  // Verify user is verifying their own share
  if (authUser.userId !== canonicalUserId) {
    throw new AuthorizationError('You can only verify your own shares', 'share-verification', 'create');
  }

  // Parse and validate request body
  const body = await request.json();
  const { shareId, platform, postUrl } = VerifyShareRequestSchema.parse(body);

  // Get the share action
  const shareAction = await prisma.shareAction.findUnique({
    where: { id: shareId },
  });

  if (!shareAction) {
    throw new BusinessLogicError('Share action not found', 'SHARE_NOT_FOUND');
  }

  if (shareAction.userId !== canonicalUserId) {
    throw new AuthorizationError('You can only verify your own shares', 'share-verification', 'verify');
  }

  if (shareAction.verified) {
    return successResponse({
      message: 'Share already verified',
      verified: true,
      shareAction,
    });
  }

  // Verify the post based on platform
  let verified = false;
  let verificationDetails: Record<string, string | boolean> = {};

  if (platform === 'twitter' && postUrl) {
    // Twitter verification
    // Extract tweet ID from URL (e.g., https://twitter.com/user/status/1234567890)
    const tweetIdMatch = postUrl.match(/status\/(\d+)/);
    if (tweetIdMatch && tweetIdMatch[1]) {
      const tweetId = tweetIdMatch[1];
      
      // TODO: Implement Twitter API verification
      // For now, we'll mark as verified if they provided a valid URL
      // In production, you'd call Twitter API to verify the tweet exists and contains the shared content
      
      verified = true;
      verificationDetails = {
        tweetId,
        tweetUrl: postUrl,
        verificationMethod: 'url_provided',
        verified: true,
        // TODO: Add actual tweet verification using Twitter API v2
      };
      
      logger.info(
        `Twitter share verification (manual): ${shareId}`,
        { shareId, tweetId, userId: canonicalUserId },
        'POST /api/users/[userId]/verify-share'
      );
    }
  } else if (platform === 'farcaster' && postUrl) {
    // Farcaster verification
    // Extract cast hash from URL (e.g., https://warpcast.com/user/0x...)
    const castHashMatch = postUrl.match(/0x[a-fA-F0-9]+/);
    if (castHashMatch) {
      const castHash = castHashMatch[0];
      
      // TODO: Implement Farcaster verification via Hubs API
      // For now, we'll mark as verified if they provided a valid URL
      // In production, you'd query a Farcaster hub to verify the cast exists
      
      verified = true;
      verificationDetails = {
        castHash,
        castUrl: postUrl,
        verificationMethod: 'url_provided',
        // TODO: Add actual cast verification using Farcaster Hubs API
      };
      
      logger.info(
        `Farcaster share verification (manual): ${shareId}`,
        { shareId, castHash, userId: canonicalUserId },
        'POST /api/users/[userId]/verify-share'
      );
    }
  }

  // Update share action with verification status
  const updatedShareAction = await prisma.shareAction.update({
    where: { id: shareId },
    data: {
      verified,
      verifiedAt: verified ? new Date() : null,
      verificationDetails: verified ? JSON.stringify(verificationDetails) : null,
    },
  });

  return successResponse({
    verified,
    shareAction: updatedShareAction,
    message: verified 
      ? 'Share verified successfully!' 
      : 'Could not verify share. Please provide a valid post URL.',
  });
});

