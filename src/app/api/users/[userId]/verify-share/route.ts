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
import { UserIdParamSchema, SnowflakeIdSchema } from '@/lib/validation/schemas'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

const VerifyShareRequestSchema = z.object({
  shareId: SnowflakeIdSchema,
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
  
  // Check if the authenticated user has a database record
  if (!authUser.dbUserId) {
    throw new AuthorizationError('User profile not found. Please complete onboarding first.', 'share-verification', 'create');
  }
  
  const targetUser = await requireUserByIdentifier(userId, { id: true });
  const canonicalUserId = targetUser.id;

  // Verify user is verifying their own share
  if (authUser.dbUserId !== canonicalUserId) {
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
      
      // Verify tweet exists using Twitter API v2
      if (process.env.TWITTER_BEARER_TOKEN) {
        try {
          const twitterResponse = await fetch(
            `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=author_id,created_at,text`,
            {
              headers: {
                'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
              },
            }
          );
          
          if (twitterResponse.ok) {
            const tweetData = await twitterResponse.json();
            verified = true;
            verificationDetails = {
              tweetId,
              tweetUrl: postUrl,
              verificationMethod: 'twitter_api_v2',
              verified: true,
              tweetText: tweetData.data?.text || '',
              tweetAuthorId: tweetData.data?.author_id || '',
            };
            
            logger.info(
              `Twitter share verified via API: ${shareId}`,
              { shareId, tweetId, userId: canonicalUserId },
              'POST /api/users/[userId]/verify-share'
            );
          } else {
            logger.warn(
              `Tweet not found or API error: ${shareId}`,
              { shareId, tweetId, status: twitterResponse.status },
              'POST /api/users/[userId]/verify-share'
            );
          }
        } catch (error) {
          logger.error(
            `Twitter API verification failed: ${shareId}`,
            { shareId, tweetId, error },
            'POST /api/users/[userId]/verify-share'
          );
        }
      } else {
        // Fallback: Accept URL as proof if API key not configured
        verified = true;
        verificationDetails = {
          tweetId,
          tweetUrl: postUrl,
          verificationMethod: 'url_provided',
          verified: true,
        };
        
        logger.info(
          `Twitter share verification (URL only): ${shareId}`,
          { shareId, tweetId, userId: canonicalUserId },
          'POST /api/users/[userId]/verify-share'
        );
      }
    }
  } else if (platform === 'farcaster' && postUrl) {
    // Farcaster verification
    // Extract cast hash from URL (e.g., https://warpcast.com/user/0x...)
    const castHashMatch = postUrl.match(/0x[a-fA-F0-9]+/);
    if (castHashMatch) {
      const castHash = castHashMatch[0];
      
      // Verify cast exists using Farcaster Hubs API
      const hubUrl = process.env.FARCASTER_HUB_URL || 'https://hub.farcaster.xyz:2281';
      
      try {
        const hubResponse = await fetch(
          `${hubUrl}/v1/castById?hash=${castHash}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (hubResponse.ok) {
          const castData = await hubResponse.json();
          verified = true;
          verificationDetails = {
            castHash,
            castUrl: postUrl,
            verificationMethod: 'farcaster_hub_api',
            verified: true,
            castText: castData.data?.text || '',
            castAuthorFid: castData.data?.fid || '',
          };
          
          logger.info(
            `Farcaster share verified via Hubs API: ${shareId}`,
            { shareId, castHash, userId: canonicalUserId },
            'POST /api/users/[userId]/verify-share'
          );
        } else {
          logger.warn(
            `Cast not found or Hub API error: ${shareId}`,
            { shareId, castHash, status: hubResponse.status },
            'POST /api/users/[userId]/verify-share'
          );
        }
      } catch (error) {
        logger.warn(
          `Farcaster Hub API verification failed, falling back to URL: ${shareId}`,
          { shareId, castHash, error },
          'POST /api/users/[userId]/verify-share'
        );
        
        // Fallback: Accept URL as proof
        verified = true;
        verificationDetails = {
          castHash,
          castUrl: postUrl,
          verificationMethod: 'url_provided',
        };
      }
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

