/**
 * API Route: /api/twitter/oauth/request-token
 * Initiates Twitter OAuth 1.0a flow for posting tweets
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
  const userId = searchParams.get('user_id')
  const returnPath = searchParams.get('return_path') || '/markets'

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
  }

    // Generate OAuth 1.0a request token
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomBytes(32)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')

    const callbackUrl = `${APP_URL}/api/twitter/oauth/callback`

    const requestTokenParams = {
      oauth_callback: callbackUrl,
      oauth_consumer_key: X_API_KEY,
      oauth_nonce: nonce,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_version: '1.0',
    }

    // Generate signature
    const signature = await generateOAuth1Signature(
      'POST',
      'https://api.twitter.com/oauth/request_token',
      requestTokenParams,
      X_API_KEY_SECRET,
    )

    // Create auth header
    const authHeader = generateAuthHeader(requestTokenParams, signature)

    // Request token from Twitter
    const response = await fetch(
      'https://api.twitter.com/oauth/request_token',
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
        },
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('OAuth 1.0a request token failed', { error: errorText }, 'TwitterOAuth')
      return NextResponse.json(
        { error: `OAuth 1.0a request token failed: ${errorText}` },
        { status: 500 },
      )
    }

    const responseText = await response.text()
    const urlParams = new URLSearchParams(responseText)
    const oauthToken = urlParams.get('oauth_token')
    const oauthTokenSecret = urlParams.get('oauth_token_secret')

    if (!oauthToken || !oauthTokenSecret) {
      return NextResponse.json(
        { error: 'No oauth_token in response' },
        { status: 500 },
      )
    }

    // Store the token secret temporarily (with user ID for later retrieval)
    await prisma.oAuthState.create({
      data: {
        id: await generateSnowflakeId(),
        state: oauthToken,
        codeVerifier: oauthTokenSecret, // Store token secret here
        userId,
        returnPath,
        expiresAt: new Date(Date.now() + 600_000), // 10 minutes
      },
    })

  // Redirect to Twitter authorization page
  const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`
  return NextResponse.redirect(authUrl)
}

