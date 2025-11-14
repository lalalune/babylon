/**
 * Twitter OAuth 2.0 Initiation
 * Redirects user to Twitter authorization page
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authUser = await authenticate(request)
    const userId = authUser.userId

    // Validate required environment variables
    if (!process.env.TWITTER_CLIENT_ID || !process.env.NEXT_PUBLIC_APP_URL) {
      logger.error('Twitter OAuth not configured', { 
        hasClientId: !!process.env.TWITTER_CLIENT_ID,
        hasAppUrl: !!process.env.NEXT_PUBLIC_APP_URL 
      }, 'TwitterInitiate')
      return NextResponse.json(
        { error: 'Twitter OAuth not configured' },
        { status: 503 }
      )
    }

    // Generate state parameter (userId:timestamp:random)
    const state = `${userId}:${Date.now()}:${Math.random().toString(36).substring(7)}`

    // Twitter OAuth 2.0 authorization URL
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', process.env.TWITTER_CLIENT_ID)
    authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback`)
    authUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('code_challenge', 'challenge') // TODO: Implement PKCE properly
    authUrl.searchParams.set('code_challenge_method', 'plain')

    logger.info('Initiating Twitter OAuth', { userId }, 'TwitterInitiate')

    return NextResponse.redirect(authUrl.toString())
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('Failed to initiate Twitter OAuth', { 
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined 
    }, 'TwitterInitiate')
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    )
  }
}

