/**
 * Twitter OAuth 2.0 Callback Handler
 * Handles the OAuth redirect from Twitter and links the account
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { PointsService } from '@/lib/services/points-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')

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

    // Exchange code for access token
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
        code_verifier: 'challenge', // TODO: Implement PKCE properly
      }),
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Twitter OAuth callback error', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    }, 'TwitterCallback')
    return NextResponse.redirect(
      new URL('/rewards?error=oauth_failed', request.url)
    )
  }
}

