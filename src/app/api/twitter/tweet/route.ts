/**
 * API Route: /api/twitter/tweet
 * Posts a tweet using OAuth 1.0a
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { authenticate } from '@/lib/api/auth-middleware'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'

const X_API_KEY = process.env.X_API_KEY!
const X_API_KEY_SECRET = process.env.X_API_KEY_SECRET!

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

function getNormalizedTimestamp(): string {
  return Math.floor(Date.now() / 1000).toString()
}

export async function POST(request: NextRequest) {
  const authUser = await authenticate(request)
  const user = await requireUserByIdentifier(authUser.userId, {
    id: true,
    username: true,
  })

  const twitterToken = await prisma.twitterOAuthToken.findUnique({
    where: { userId: user.id },
  })

  if (!twitterToken) {
    return NextResponse.json(
      { error: 'Twitter account not connected. Please connect your X account first.' },
      { status: 401 }
    )
  }

    // Parse request body
    const body = await request.json()
    const { text, media_ids, contentType, contentId } = body as {
      text: string
      media_ids?: string[]
      contentType?: 'market' | 'profile' | 'referral'
      contentId?: string
    }

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Missing tweet text' },
        { status: 400 }
      )
    }

    logger.info(
      'Posting tweet',
      { 
        userId: user.id, 
        textLength: text.length,
        hasMedia: Boolean(media_ids && media_ids.length > 0)
      },
      'TwitterPost'
    )

    // Generate OAuth 1.0a params
    const timestamp = getNormalizedTimestamp()
    const oauthParams = {
      oauth_consumer_key: X_API_KEY,
      oauth_nonce: randomBytes(32)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, ''),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_token: twitterToken.oauth1Token,
      oauth_version: '1.0',
    }

    // Create tweet payload (API v2 format)
    const tweetPayload: { text: string; media?: { media_ids: string[] } } = {
      text: text,
    }

    if (media_ids && media_ids.length > 0) {
      tweetPayload.media = { media_ids }
    }

    // Sign the request (only OAuth params for JSON body)
    const signature = await generateOAuth1Signature(
      'POST',
      'https://api.twitter.com/2/tweets',
      { ...oauthParams },
      X_API_KEY_SECRET,
      twitterToken.oauth1TokenSecret,
    )

    const tweetAuthHeader = generateAuthHeader(oauthParams, signature)

    // Post the tweet
    const tweetResponse = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: tweetAuthHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(tweetPayload),
    })

    const errorText = await tweetResponse.text()
    logger.error(
      'Tweet creation failed',
      { error: errorText, status: tweetResponse.status },
      'TwitterPost'
    )

    const responseData = await tweetResponse.json() as { 
      data?: { id: string; text: string } 
    }
    
    logger.info(
      'Tweet posted successfully',
      { userId: user.id, tweetId: responseData.data?.id },
      'TwitterPost'
    )

    if (contentType) {
      const token = request.headers.get('authorization')!.replace('Bearer ', '')
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/users/${user.id}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'twitter',
          contentType,
          contentId,
          url: `https://twitter.com/${twitterToken.screenName}/status/${responseData.data!.id}`,
        }),
      })

      logger.warn('Failed to track share', undefined, 'TwitterPost')
    }

  return NextResponse.json({
    success: true,
    tweet: responseData,
    tweetUrl: `https://twitter.com/${twitterToken.screenName || 'i'}/status/${responseData.data?.id}`,
  })
}

