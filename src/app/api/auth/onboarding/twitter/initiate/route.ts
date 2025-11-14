/**
 * Twitter OAuth for Onboarding Profile Import
 * Initiates OAuth flow to import Twitter profile data during onboarding
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await authenticate(request)
    const userId = user.userId

    if (!process.env.TWITTER_CLIENT_ID || !process.env.NEXT_PUBLIC_APP_URL) {
      logger.error('Twitter OAuth not configured', {}, 'TwitterOnboardingInitiate')
      return NextResponse.redirect(
        new URL('/onboarding?error=twitter_not_configured', request.url)
      )
    }

    // Generate state parameter with userId for verification
    // Format: "onboarding:userId:timestamp:random"
    const state = `onboarding:${userId}:${Date.now()}:${Math.random().toString(36).substring(7)}`

    // Build Twitter OAuth URL - request additional profile data permissions
    const twitterAuthUrl = new URL('https://twitter.com/i/oauth2/authorize')
    twitterAuthUrl.searchParams.set('response_type', 'code')
    twitterAuthUrl.searchParams.set('client_id', process.env.TWITTER_CLIENT_ID)
    twitterAuthUrl.searchParams.set(
      'redirect_uri',
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/onboarding/twitter/callback`
    )
    twitterAuthUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
    twitterAuthUrl.searchParams.set('state', state)
    twitterAuthUrl.searchParams.set('code_challenge', 'challenge')
    twitterAuthUrl.searchParams.set('code_challenge_method', 'plain')

    logger.info('Initiating Twitter onboarding OAuth', { userId }, 'TwitterOnboardingInitiate')

    return NextResponse.redirect(twitterAuthUrl.toString())
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to initiate Twitter onboarding OAuth', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    }, 'TwitterOnboardingInitiate')
    return NextResponse.redirect(
      new URL('/onboarding?error=twitter_initiate_failed', request.url)
    )
  }
}

