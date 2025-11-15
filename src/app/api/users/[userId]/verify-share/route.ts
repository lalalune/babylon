/**
 * API Route: /api/users/[userId]/verify-share
 * Methods: POST (verify that a share was actually posted)
 */

import {
  authenticate,
  successResponse
} from '@/lib/api/auth-middleware'
import { prisma } from '@/lib/prisma'
import { AuthorizationError, BusinessLogicError } from '@/lib/errors'
import { withErrorHandling } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'
import { UserIdParamSchema, SnowflakeIdSchema } from '@/lib/validation/schemas'
import { PointsService } from '@/lib/services/points-service'
import { POINTS } from '@/lib/constants/points'
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
    // Calculate points based on platform (same logic as PointsService.awardShareAction)
    const pointsAmount = platform === 'twitter' ? POINTS.SHARE_TO_TWITTER : POINTS.SHARE_ACTION;
    
    return successResponse({
      message: 'Share already verified',
      verified: true,
      shareAction,
      points: {
        awarded: shareAction.pointsAwarded ? pointsAmount : 0,
        alreadyAwarded: shareAction.pointsAwarded,
      },
    });
  }

  // Require post URL for verification
  if (!postUrl) {
    throw new BusinessLogicError('Post URL is required for verification', 'MISSING_POST_URL');
  }

  // Verify the post based on platform
  let verified = false;
  let verificationDetails: Record<string, string | boolean> = {};
  let verificationError: string | null = null;

  if (platform === 'twitter') {
    // Twitter verification - STRICT MODE
    // Extract tweet ID from URL (e.g., https://twitter.com/user/status/1234567890 or https://x.com/user/status/1234567890)
    const tweetIdMatch = postUrl.match(/(?:twitter\.com|x\.com)\/[^/]+\/status\/(\d+)/);
    
    if (!tweetIdMatch || !tweetIdMatch[1]) {
      verificationError = 'Invalid Twitter/X URL format. Expected: https://twitter.com/username/status/123456789';
      logger.warn(
        `Invalid Twitter URL format: ${shareId}`,
        { shareId, postUrl, userId: canonicalUserId },
        'POST /api/users/[userId]/verify-share'
      );
    } else {
      const tweetId = tweetIdMatch[1];
      
      // Check if Twitter API is configured
      if (!process.env.TWITTER_BEARER_TOKEN) {
        verificationError = 'Twitter verification is not configured. Please contact support.';
        logger.error(
          'TWITTER_BEARER_TOKEN not configured',
          { shareId, tweetId },
          'POST /api/users/[userId]/verify-share'
        );
      } else {
        // Verify tweet exists using Twitter API v2
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
            
            if (tweetData.data) {
              // VALIDATION 1: Check if user has linked Twitter account
              const user = await prisma.user.findUnique({
                where: { id: canonicalUserId },
                select: { 
                  twitterUsername: true,
                },
              });

              if (!user?.twitterUsername) {
                verificationError = 'Please link your Twitter/X account first to verify tweets.';
                logger.warn(
                  `User has no linked Twitter account: ${shareId}`,
                  { shareId, userId: canonicalUserId },
                  'POST /api/users/[userId]/verify-share'
                );
              } else {
                // VALIDATION 2: Verify tweet contains the shared URL
                const tweetText = (tweetData.data.text || '').toLowerCase();
                const sharedUrl = shareAction.url?.toLowerCase() || '';
                
                // Check if the tweet contains the shared URL or its domain
                const urlDomain = sharedUrl ? new URL(sharedUrl).hostname : '';
                const containsUrl = sharedUrl && (
                  tweetText.includes(sharedUrl) || 
                  tweetText.includes(urlDomain)
                );

                if (!containsUrl && sharedUrl) {
                  verificationError = `This tweet does not contain the shared link (${urlDomain}). Please paste the tweet where you actually shared the link.`;
                  logger.warn(
                    `Tweet does not contain shared URL: ${shareId}`,
                    { 
                      shareId, 
                      tweetText: tweetText.substring(0, 100),
                      expectedUrl: sharedUrl,
                    },
                    'POST /api/users/[userId]/verify-share'
                  );
                } else {
                  // Note: Twitter API v2 doesn't return username directly with tweets
                  // We would need to expand author data or use a separate API call
                  // For now, we validate by URL content only
                  // TODO: Add author verification when Twitter API access is expanded
                  
                  verified = true;
                  verificationDetails = {
                    tweetId,
                    tweetUrl: postUrl,
                    verificationMethod: 'twitter_api_v2',
                    verified: true,
                    tweetText: tweetData.data.text || '',
                    tweetAuthorId: tweetData.data.author_id || '',
                    verifiedAt: new Date().toISOString(),
                    urlMatch: containsUrl,
                  };
                  
                  logger.info(
                    `Twitter share verified via API: ${shareId}`,
                    { shareId, tweetId, userId: canonicalUserId },
                    'POST /api/users/[userId]/verify-share'
                  );
                }
              }
            } else {
              verificationError = 'Tweet not found or has been deleted';
              logger.warn(
                `Tweet not found in API response: ${shareId}`,
                { shareId, tweetId },
                'POST /api/users/[userId]/verify-share'
              );
            }
          } else if (twitterResponse.status === 404) {
            verificationError = 'Tweet not found. Please check the URL and try again.';
            logger.warn(
              `Tweet not found (404): ${shareId}`,
              { shareId, tweetId },
              'POST /api/users/[userId]/verify-share'
            );
          } else {
            verificationError = `Twitter API error (${twitterResponse.status}). Please try again later.`;
            logger.error(
              `Twitter API error: ${shareId}`,
              { shareId, tweetId, status: twitterResponse.status },
              'POST /api/users/[userId]/verify-share'
            );
          }
        } catch (error) {
          verificationError = 'Failed to verify with Twitter API. Please try again later.';
          logger.error(
            `Twitter API verification exception: ${shareId}`,
            { shareId, tweetId, error },
            'POST /api/users/[userId]/verify-share'
          );
        }
      }
    }
  } else if (platform === 'farcaster') {
    // Farcaster verification - STRICT MODE via Neynar API
    // Use URL-based lookup which is more reliable than hash extraction
    
    // Check if Neynar API key is configured
    if (!process.env.NEYNAR_API_KEY) {
      verificationError = 'Farcaster verification is not configured. Please contact support.';
      logger.error(
        'NEYNAR_API_KEY not configured',
        { shareId, postUrl },
        'POST /api/users/[userId]/verify-share'
      );
    } else {
      try {
        // Use Neynar API to verify cast by URL (more reliable than hash extraction)
        logger.info(
          `Attempting to verify Farcaster cast: ${shareId}`,
          { shareId, postUrl },
          'POST /api/users/[userId]/verify-share'
        );
        
        const neynarResponse = await fetch(
          `https://api.neynar.com/v2/farcaster/cast?identifier=${encodeURIComponent(postUrl)}&type=url`,
          {
            headers: {
              'accept': 'application/json',
              'api_key': process.env.NEYNAR_API_KEY,
            },
            signal: AbortSignal.timeout(10000), // 10 second timeout
          }
        );
        
        if (neynarResponse.ok) {
          const neynarData = await neynarResponse.json();
          
          logger.info(
            `Neynar API response received: ${shareId}`,
            { shareId, hasCast: !!neynarData.cast },
            'POST /api/users/[userId]/verify-share'
          );
          
          if (neynarData.cast) {
            // VALIDATION 1: Check if user has linked Farcaster account
            const user = await prisma.user.findUnique({
              where: { id: canonicalUserId },
              select: { 
                farcasterUsername: true,
                farcasterFid: true,
              },
            });

            if (!user?.farcasterUsername && !user?.farcasterFid) {
              verificationError = 'Please link your Farcaster account first to verify casts.';
              logger.warn(
                `User has no linked Farcaster account: ${shareId}`,
                { shareId, userId: canonicalUserId },
                'POST /api/users/[userId]/verify-share'
              );
            } else {
              // VALIDATION 2: Verify cast author matches user's Farcaster account
              const castAuthorUsername = neynarData.cast.author?.username?.toLowerCase();
              const castAuthorFid = neynarData.cast.author?.fid?.toString();
              const userFarcasterUsername = user.farcasterUsername?.toLowerCase();
              const userFarcasterFid = user.farcasterFid?.toString();

              const isAuthorMatch = 
                (userFarcasterUsername && castAuthorUsername === userFarcasterUsername) ||
                (userFarcasterFid && castAuthorFid === userFarcasterFid);

              if (!isAuthorMatch) {
                verificationError = `This cast was not posted by your Farcaster account (@${userFarcasterUsername || userFarcasterFid}). Please paste a cast from your own account.`;
                logger.warn(
                  `Cast author mismatch: ${shareId}`,
                  { 
                    shareId, 
                    castAuthor: castAuthorUsername,
                    castAuthorFid,
                    expectedUsername: userFarcasterUsername,
                    expectedFid: userFarcasterFid,
                  },
                  'POST /api/users/[userId]/verify-share'
                );
              } else {
                // VALIDATION 3: Verify cast contains the shared URL
                const castText = (neynarData.cast.text || '').toLowerCase();
                const sharedUrl = shareAction.url?.toLowerCase() || '';
                
                // Check if the cast contains the shared URL or its domain
                const urlDomain = sharedUrl ? new URL(sharedUrl).hostname : '';
                const containsUrl = sharedUrl && (
                  castText.includes(sharedUrl) || 
                  castText.includes(urlDomain)
                );

                if (!containsUrl && sharedUrl) {
                  verificationError = `This cast does not contain the shared link (${urlDomain}). Please paste the cast where you actually shared the link.`;
                  logger.warn(
                    `Cast does not contain shared URL: ${shareId}`,
                    { 
                      shareId, 
                      castText: castText.substring(0, 100),
                      expectedUrl: sharedUrl,
                    },
                    'POST /api/users/[userId]/verify-share'
                  );
                } else {
                  // All validations passed!
                  verified = true;
                  verificationDetails = {
                    castHash: neynarData.cast.hash,
                    castUrl: postUrl,
                    verificationMethod: 'neynar_api_url',
                    verified: true,
                    castText: neynarData.cast.text || '',
                    castAuthorUsername: castAuthorUsername || '',
                    castAuthorFid: castAuthorFid || '',
                    verifiedAt: new Date().toISOString(),
                    authorMatch: true,
                    urlMatch: containsUrl,
                  };
                  
                  logger.info(
                    `Farcaster share verified via Neynar API: ${shareId}`,
                    { shareId, castHash: neynarData.cast.hash, userId: canonicalUserId },
                    'POST /api/users/[userId]/verify-share'
                  );
                }
              }
            }
          } else {
            verificationError = 'Cast not found or has been deleted';
            logger.warn(
              `Cast not found in Neynar response: ${shareId}`,
              { shareId, postUrl },
              'POST /api/users/[userId]/verify-share'
            );
          }
        } else if (neynarResponse.status === 404) {
          verificationError = 'Cast not found. Please check the URL and try again.';
          logger.warn(
            `Cast not found (404) via Neynar: ${shareId}`,
            { shareId, postUrl },
            'POST /api/users/[userId]/verify-share'
          );
        } else {
          const errorText = await neynarResponse.text().catch(() => '');
          verificationError = `Neynar API error (${neynarResponse.status}). Please try again later.`;
          logger.error(
            `Neynar API error: ${shareId}`,
            { shareId, postUrl, status: neynarResponse.status, error: errorText },
            'POST /api/users/[userId]/verify-share'
          );
        }
      } catch (error) {
        // NO FALLBACK - strict verification only
        verificationError = 'Failed to verify with Neynar API. Please try again later.';
        logger.error(
          `Neynar API verification exception: ${shareId}`,
          { shareId, postUrl, error: error instanceof Error ? error.message : String(error) },
          'POST /api/users/[userId]/verify-share'
        );
      }
    }
  }

  // Award points only if verification succeeded
  let pointsAwarded = 0;
  let newPointsTotal = 0;

  if (verified) {
    // Award points through PointsService
    const pointsResult = await PointsService.awardShareAction(
      canonicalUserId,
      platform,
      shareAction.contentType,
      shareAction.contentId || undefined
    );

    if (pointsResult.success) {
      pointsAwarded = pointsResult.pointsAwarded;
      newPointsTotal = pointsResult.newTotal;
      
      logger.info(
        `Awarded ${pointsAwarded} points for verified share`,
        { shareId, userId: canonicalUserId, platform, pointsAwarded },
        'POST /api/users/[userId]/verify-share'
      );
    }
  }

  // Update share action with verification status and points
  const updatedShareAction = await prisma.shareAction.update({
    where: { id: shareId },
    data: {
      verified,
      verifiedAt: verified ? new Date() : null,
      verificationDetails: verified ? JSON.stringify(verificationDetails) : null,
      pointsAwarded: verified && pointsAwarded > 0,
    },
  });

  return successResponse({
    verified,
    shareAction: updatedShareAction,
    points: {
      awarded: pointsAwarded,
      newTotal: newPointsTotal,
    },
    message: verified 
      ? `Share verified successfully! You earned ${pointsAwarded} points.` 
      : verificationError || 'Could not verify share. Please provide a valid post URL.',
  });
});

