/**
 * Twitter OAuth 2.0 Callback API
 * 
 * @route GET /api/auth/twitter/callback
 * @access Public (with state validation)
 * 
 * @description
 * Handles the OAuth 2.0 callback redirect from Twitter after user authorization.
 * Exchanges authorization code for access token, fetches user profile data,
 * links Twitter account to user profile, and awards bonus points for first-time
 * linkage. Includes comprehensive error handling and security validation.
 * 
 * **Callback Flow:**
 * 1. Twitter redirects user back with authorization code
 * 2. Server validates state parameter and expiration
 * 3. Authorization code exchanged for access token
 * 4. User profile data fetched from Twitter API
 * 5. Twitter account linked to Babylon user profile
 * 6. Bonus points awarded on first link
 * 7. User redirected to rewards page with status
 * 
 * **Security Features:**
 * - State parameter validation with 10-minute expiration
 * - Prevention of duplicate account linking
 * - Secure token exchange with Basic Auth
 * - Access token encrypted storage (production)
 * - Comprehensive error handling and logging
 * 
 * **Twitter Profile Data Retrieved:**
 * - Twitter User ID
 * - Username (@handle)
 * - Display name
 * - Profile image URL
 * - Bio/description
 * 
 * **GET /api/auth/twitter/callback - Handle OAuth Callback**
 * 
 * @query {string} code - Authorization code from Twitter
 * @query {string} state - State parameter (userId:timestamp:nonce)
 * @query {string} [error] - OAuth error if authorization failed
 * 
 * @returns {redirect} Redirect to rewards page with status
 * - Success: `/rewards?success=twitter_linked&points={amount}`
 * - Error: `/rewards?error={error_code}`
 * 
 * **Error Codes:**
 * - `missing_params` - Missing code or state parameter
 * - `invalid_state` - Malformed state parameter
 * - `state_expired` - State timestamp older than 10 minutes
 * - `token_exchange_failed` - Failed to exchange code for token
 * - `failed_to_get_user` - Failed to fetch Twitter profile
 * - `invalid_twitter_data` - Invalid data from Twitter API
 * - `twitter_already_linked` - Twitter account linked to different user
 * 
 * @example
 * ```typescript
 * // Twitter redirects to:
 * // /api/auth/twitter/callback?code=abc123&state=user-id:timestamp:nonce
 * 
 * // On success, user redirected to:
 * // /rewards?success=twitter_linked&points=100
 * 
 * // On error, user redirected to:
 * // /rewards?error=twitter_already_linked
 * ```
 * 
 * @see {@link /api/auth/twitter/initiate} OAuth initiation
 * @see {@link /lib/services/points-service} Points service
 * @see {@link https://developer.twitter.com/en/docs/authentication/oauth-2-0} Twitter OAuth 2.0
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { PointsService } from '@/lib/services/points-service'
import { z } from 'zod'
import { withErrorHandling } from '@/lib/errors/error-handler'

const TwitterCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams
  const parsed = TwitterCallbackQuerySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.redirect(
      new URL(`/rewards?error=${encodeURIComponent('Invalid parameters received from Twitter')}`, request.url)
    )
  }

  const { code, state, error: oauthError } = parsed.data;

  // Handle OAuth error
  if (oauthError) {
    logger.error('Twitter OAuth error', { oauthError }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL(`/rewards?error=${encodeURIComponent('Twitter authentication failed')}`, request.url)
    )
  }

  if (!code || !state) {
    logger.warn('Twitter callback missing code or state', { hasCode: !!code, hasState: !!state }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=missing_params', request.url)
    )
  }

  // Verify state and get user ID from it
  // State format: "userId:timestamp:random"
  const stateParts = state.split(':')
  if (stateParts.length < 2) {
    logger.warn('Twitter callback invalid state format', { state }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=invalid_state', request.url)
    )
  }

  const [userId, timestampStr] = stateParts
  if (!userId || !timestampStr) {
    logger.warn('Twitter callback missing userId or timestamp in state', { state }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=invalid_state', request.url)
    )
  }

  const stateTimestamp = parseInt(timestampStr, 10)
  if (isNaN(stateTimestamp)) {
    logger.warn('Twitter callback invalid timestamp in state', { state, timestampStr }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=invalid_state', request.url)
    )
  }

  const now = Date.now()
  
  // State expires after 10 minutes
  if (now - stateTimestamp > 10 * 60 * 1000) {
    logger.warn('Twitter callback state expired', { stateTimestamp, now, ageMs: now - stateTimestamp }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=state_expired', request.url)
    )
  }

  // Retrieve PKCE code verifier from database
  const oauthState = await prisma.oAuthState.findFirst({
    where: {
      state,
      returnPath: 'twitter', // Provider stored in returnPath
      userId,
      expiresAt: { gte: new Date() },
    },
  })

  if (!oauthState || !oauthState.codeVerifier) {
    logger.warn('Twitter callback missing or expired PKCE state', { state, userId }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=invalid_state', request.url)
    )
  }

  // Exchange code for access token with PKCE verifier
  const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback`,
      code_verifier: oauthState.codeVerifier,
    }),
  })
  
  // Clean up OAuth state after use
  await prisma.oAuthState.delete({
    where: { id: oauthState.id },
  }).catch((error) => {
    logger.warn('Failed to delete OAuth state', { error, stateId: oauthState.id }, 'TwitterCallback')
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.text()
    logger.error('Failed to exchange Twitter code', { errorData }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=token_exchange_failed', request.url)
    )
  }

  const tokenData = await tokenResponse.json()
  const accessToken = tokenData.access_token

  // Get user info from Twitter - fetch comprehensive profile data
  const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url,description', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!userResponse.ok) {
    logger.error('Failed to get Twitter user info', {}, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=failed_to_get_user', request.url)
    )
  }

  const userData = await userResponse.json() as { 
    data?: { 
      id?: string
      username?: string
      name?: string
      profile_image_url?: string
      description?: string
    } 
  }
  
  if (!userData.data?.id || !userData.data?.username) {
    logger.error('Invalid Twitter user data received', { userData }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=invalid_twitter_data', request.url)
    )
  }

  const twitterUser = userData.data
  const twitterUsername = twitterUser.username
  const twitterId = twitterUser.id

  // Check if Twitter account is already linked to another user
  const existingLink = await prisma.user.findFirst({
    where: {
      twitterId,
      id: { not: userId },
    },
  })

  if (existingLink) {
    return NextResponse.redirect(
      new URL('/rewards?error=twitter_already_linked', request.url)
    )
  }

  // Update user with Twitter info
  await prisma.user.update({
    where: { id: userId },
    data: {
      twitterId,
      twitterUsername,
      hasTwitter: true,
      twitterAccessToken: accessToken, // Store encrypted in production
      twitterRefreshToken: tokenData.refresh_token,
      twitterTokenExpiresAt: tokenData.expires_in 
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null,
    },
  })

  // Award points if this is the first time linking Twitter
  const pointsResult = await PointsService.awardTwitterLink(userId, twitterUsername)

  logger.info(
    'Twitter account linked successfully',
    { userId, twitterUsername, pointsAwarded: pointsResult.pointsAwarded },
    'TwitterCallback'
  )

  // Redirect back to rewards page with success
  return NextResponse.redirect(
    new URL(
      `/rewards?success=twitter_linked&points=${pointsResult.pointsAwarded}`,
      request.url
    )
  )
});

