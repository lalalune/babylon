/**
 * Twitter OAuth Callback for Onboarding
 * Imports Twitter profile data during onboarding
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/database-service'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')

    // Handle OAuth error
    if (oauthError) {
      logger.error('Twitter onboarding OAuth error', { oauthError }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('Twitter authentication failed')}`, request.url)
      )
    }

    if (!code || !state) {
      logger.warn('Twitter onboarding callback missing code or state', { hasCode: !!code, hasState: !!state }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=missing_params', request.url)
      )
    }

    // Verify state format: "onboarding:userId:timestamp:random"
    const stateParts = state.split(':')
    if (stateParts.length < 3) {
      logger.warn('Twitter onboarding callback invalid state format', { state }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=invalid_state', request.url)
      )
    }

    const [prefix, userId, timestampStr] = stateParts
    
    if (prefix !== 'onboarding') {
      logger.warn('Twitter onboarding callback wrong prefix', { prefix, expected: 'onboarding' }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=invalid_state', request.url)
      )
    }

    if (!userId || !timestampStr) {
      logger.warn('Twitter onboarding callback missing userId or timestamp', { state }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=invalid_state', request.url)
      )
    }

    const stateTimestamp = parseInt(timestampStr, 10)
    if (isNaN(stateTimestamp)) {
      logger.warn('Twitter onboarding callback invalid timestamp', { timestampStr }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=invalid_state', request.url)
      )
    }

    const now = Date.now()
    
    // State expires after 10 minutes
    if (now - stateTimestamp > 10 * 60 * 1000) {
      logger.warn('Twitter onboarding callback state expired', { stateTimestamp, now, ageMs: now - stateTimestamp }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=state_expired', request.url)
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
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/onboarding/twitter/callback`,
        code_verifier: 'challenge',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      logger.error('Failed to exchange Twitter code for onboarding', { errorData }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=token_exchange_failed', request.url)
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token

    // Get comprehensive user profile from Twitter
    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name,description,profile_image_url', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      logger.error('Failed to get Twitter user info for onboarding', {}, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=failed_to_get_user', request.url)
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

    // Validate required fields
    if (!userData.data?.id || !userData.data?.username) {
      logger.error('Invalid Twitter user data', { userData }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=invalid_twitter_data', request.url)
      )
    }

    const twitterUser = userData.data

    // Check for duplicate Twitter account
    const existingUser = await prisma.user.findFirst({
      where: {
        twitterId: twitterUser.id,
        id: { not: userId },
      },
    })

    if (existingUser) {
      logger.warn('Twitter account already linked', { twitterId: twitterUser.id, existingUserId: existingUser.id }, 'TwitterOnboardingCallback')
      return NextResponse.redirect(
        new URL('/?error=twitter_already_linked', request.url)
      )
    }

    // Extract profile data with fallbacks
    const profileData = {
      platform: 'twitter',
      username: twitterUser.username,
      displayName: twitterUser.name || twitterUser.username,
      bio: twitterUser.description || '',
      profileImageUrl: twitterUser.profile_image_url
        ? twitterUser.profile_image_url.replace('_normal', '_400x400') // Get higher resolution
        : null,
      twitterId: twitterUser.id,
      twitterUsername: twitterUser.username,
    }

    logger.info(
      'Twitter profile imported for onboarding',
      { userId, twitterUsername: twitterUser.username },
      'TwitterOnboardingCallback'
    )

    // Encode profile data and redirect back to app with data
    const encodedData = encodeURIComponent(JSON.stringify(profileData))
    return NextResponse.redirect(
      new URL(`/?social_import=twitter&data=${encodedData}`, request.url)
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Twitter onboarding OAuth callback error', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    }, 'TwitterOnboardingCallback')
    return NextResponse.redirect(
      new URL('/?error=oauth_failed', request.url)
    )
  }
}

