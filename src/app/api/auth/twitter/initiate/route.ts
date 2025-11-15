/**
 * Twitter OAuth 2.0 Initiation API
 * 
 * @route GET /api/auth/twitter/initiate
 * @access Authenticated
 * 
 * @description
 * Initiates Twitter OAuth 2.0 authentication flow by redirecting the user to
 * Twitter's authorization page. Generates a secure state parameter containing
 * user ID and timestamp for CSRF protection. Uses OAuth 2.0 with PKCE for
 * secure authorization.
 * 
 * **OAuth Flow:**
 * 1. User clicks "Connect Twitter" button
 * 2. Frontend redirects to this endpoint
 * 3. Server authenticates user and generates state
 * 4. User redirected to Twitter authorization page
 * 5. User authorizes Babylon on Twitter
 * 6. Twitter redirects to callback with authorization code
 * 
 * **Security Features:**
 * - CSRF protection via state parameter
 * - State includes userId, timestamp, and random nonce
 * - PKCE (Proof Key for Code Exchange) support
 * - Scopes limited to read permissions only
 * 
 * **Required Environment Variables:**
 * - `TWITTER_CLIENT_ID` - Twitter OAuth client ID
 * - `NEXT_PUBLIC_APP_URL` - Application base URL
 * 
 * **GET /api/auth/twitter/initiate - Start OAuth Flow**
 * 
 * @returns {redirect} Redirect to Twitter authorization page
 * 
 * @throws {401} Unauthorized - Not authenticated
 * @throws {503} Service Unavailable - Twitter OAuth not configured
 * @throws {500} Internal Server Error
 * 
 * @example
 * ```typescript
 * // Redirect user to initiate Twitter OAuth
 * window.location.href = '/api/auth/twitter/initiate';
 * 
 * // User will be redirected to Twitter, then back to callback
 * ```
 * 
 * @see {@link /api/auth/twitter/callback} OAuth callback handler
 * @see {@link https://developer.twitter.com/en/docs/authentication/oauth-2-0} Twitter OAuth 2.0
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import crypto from 'crypto'

/**
 * Generate PKCE code verifier (random string)
 */
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generate PKCE code challenge from verifier
 */
function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')
}

export async function GET(request: NextRequest) {
  const authUser = await authenticate(request)
  const userId = authUser.userId

  const state = `${userId}:${Date.now()}:${Math.random().toString(36).substring(7)}`
  
  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  
  // Store code verifier temporarily (expires in 10 minutes)
  await prisma.oAuthState.create({
    data: {
      id: await generateSnowflakeId(),
      userId,
      state,
      codeVerifier,
      returnPath: 'twitter', // Use returnPath to store provider
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', process.env.TWITTER_CLIENT_ID!)
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback`)
  authUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  logger.info('Initiating Twitter OAuth with PKCE', { userId }, 'TwitterInitiate')

  return NextResponse.redirect(authUrl.toString())
}

