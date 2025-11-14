/**
 * API Route: /api/twitter/oauth/callback
 * Handles Twitter OAuth 1.0a callback
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'

const X_API_KEY = process.env.X_API_KEY!
const X_API_KEY_SECRET = process.env.X_API_KEY_SECRET!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function encodeRFC3986(str: string): string {
  return encodeURIComponent(str)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\%20/g, '+')
}

async function generateOAuth1Signature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = '',
): Promise<string> {
  const paramString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRFC3986(key)}=${encodeRFC3986(value)}`)
    .join('&')

  const signatureBase = [
    method.toUpperCase(),
    encodeRFC3986(url),
    encodeRFC3986(paramString),
  ].join('&')

  const signingKey = `${encodeRFC3986(consumerSecret)}&${encodeRFC3986(tokenSecret)}`

  const signature = await crypto.subtle
    .importKey(
      'raw',
      new TextEncoder().encode(signingKey),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign'],
    )
    .then((key) =>
      crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureBase)),
    )

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

function generateAuthHeader(
  oauthParams: Record<string, string>,
  signature: string,
): string {
  return (
    'OAuth ' +
    Object.entries({
      ...oauthParams,
      oauth_signature: signature,
    })
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}="${encodeURIComponent(value)}"`,
      )
      .join(', ')
  )
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const oauthToken = searchParams.get('oauth_token')
  const oauthVerifier = searchParams.get('oauth_verifier')

  if (!oauthToken || !oauthVerifier) {
    return NextResponse.redirect(
      new URL('/markets?error=missing_oauth_params', APP_URL)
    )
  }

    // Get the stored token secret and user ID
    const storedState = await prisma.oAuthState.findUnique({
      where: { state: oauthToken },
    })

    if (!storedState || storedState.expiresAt < new Date()) {
      return NextResponse.redirect(
        new URL('/markets?error=invalid_or_expired_token', APP_URL)
      )
    }

    const tokenSecret = storedState.codeVerifier
    const userId = storedState.userId
    const returnPath = storedState.returnPath || '/markets'

    if (!userId) {
      return NextResponse.redirect(
        new URL('/markets?error=no_user_id', APP_URL)
      )
    }

    // Generate signature for access token request
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomBytes(32)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')

    const accessTokenParams = {
      oauth_consumer_key: X_API_KEY,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
      oauth_version: '1.0',
    }

    const signature = await generateOAuth1Signature(
      'POST',
      'https://api.twitter.com/oauth/access_token',
      accessTokenParams,
      X_API_KEY_SECRET,
      tokenSecret,
    )

    const authHeader = generateAuthHeader(accessTokenParams, signature)

    // Request access token
    const response = await fetch('https://api.twitter.com/oauth/access_token', {
      method: 'POST',
      headers: {
        Authorization: authHeader,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('OAuth 1.0a access token failed', { error: errorText }, 'TwitterOAuth')
      return NextResponse.redirect(
        new URL('/markets?error=access_token_failed', APP_URL)
      )
    }

    const responseText = await response.text()
    const urlParams = new URLSearchParams(responseText)

    const accessToken = urlParams.get('oauth_token')
    const accessTokenSecret = urlParams.get('oauth_token_secret')
    const screenName = urlParams.get('screen_name')

    if (!accessToken || !accessTokenSecret) {
      return NextResponse.redirect(
        new URL('/markets?error=invalid_access_token', APP_URL)
      )
    }

    // Store OAuth 1.0a credentials in database
    await prisma.twitterOAuthToken.upsert({
      where: { userId },
      create: {
        id: await generateSnowflakeId(),
        userId,
        oauth1Token: accessToken,
        oauth1TokenSecret: accessTokenSecret,
        screenName: screenName || undefined,
        updatedAt: new Date(),
      },
      update: {
        oauth1Token: accessToken,
        oauth1TokenSecret: accessTokenSecret,
        screenName: screenName || undefined,
        updatedAt: new Date(),
      },
    })

    // Clean up the temporary state
    await prisma.oAuthState.delete({
      where: { state: oauthToken },
    })

    logger.info(
      'Twitter OAuth 1.0a completed successfully',
      { userId, screenName },
      'TwitterOAuth'
    )

  // Redirect back to the original page with success
  return NextResponse.redirect(
    new URL(`${returnPath}?twitter_auth=success`, APP_URL)
  )
}

