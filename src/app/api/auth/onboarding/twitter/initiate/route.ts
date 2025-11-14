/**
 * Twitter OAuth for Onboarding Profile Import
 * Initiates OAuth flow to import Twitter profile data during onboarding
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const user = await authenticate(request)
  const userId = user.userId

  const state = `onboarding:${userId}:${Date.now()}:${Math.random().toString(36).substring(7)}`

  const twitterAuthUrl = new URL('https://twitter.com/i/oauth2/authorize')
  twitterAuthUrl.searchParams.set('response_type', 'code')
  twitterAuthUrl.searchParams.set('client_id', process.env.TWITTER_CLIENT_ID!)
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
}

