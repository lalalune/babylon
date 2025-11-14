/**
 * API Route: /api/twitter/upload-media
 * Uploads media to Twitter using OAuth 1.0a
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
      { error: 'Twitter account not connected' },
      { status: 401 }
    )
  }

  const body = await request.json()
  const imageDataUrl = body.image as string

  if (!imageDataUrl?.startsWith('data:')) {
    return NextResponse.json(
      { error: 'Invalid or missing image data URL' },
      { status: 400 }
    )
  }

    // Extract content type and base64 data
    const matches = imageDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
    if (!matches || matches.length !== 3 || !matches[1] || !matches[2]) {
      return NextResponse.json(
        { error: 'Invalid image data URL format' },
        { status: 400 }
      )
    }

    const contentType: string = matches[1]
    const imageBase64: string = matches[2]

    // Convert base64 to Uint8Array
    const binaryString = atob(imageBase64)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    logger.info(
      `Media Upload: Type=${contentType}, Size=${bytes.length} bytes`,
      { userId: user.id },
      'TwitterMediaUpload'
    )

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

    // --- INIT ---
    const initParams = {
      command: 'INIT',
      total_bytes: bytes.length.toString(),
      media_type: contentType,
    }

    const initSignature = await generateOAuth1Signature(
      'POST',
      'https://upload.twitter.com/1.1/media/upload.json',
      { ...oauthParams, ...initParams },
      X_API_KEY_SECRET,
      twitterToken.oauth1TokenSecret,
    )

    const initHeader = generateAuthHeader(oauthParams, initSignature)
    const initBody = new URLSearchParams(initParams)

    const initResponse = await fetch(
      'https://upload.twitter.com/1.1/media/upload.json',
      {
        method: 'POST',
        headers: {
          Authorization: initHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: initBody,
      },
    )

    if (!initResponse.ok) {
      const errorText = await initResponse.text()
      logger.error('INIT failed', { error: errorText }, 'TwitterMediaUpload')
      throw new Error(`Twitter Media INIT failed: ${errorText}`)
    }

    const initData = await initResponse.json() as { media_id_string?: string }
    if (!initData.media_id_string) {
      throw new Error('Twitter API did not return a media ID after INIT')
    }

    const mediaId = initData.media_id_string

    // --- APPEND ---
    const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB chunks
    const totalChunks = Math.ceil(bytes.length / CHUNK_SIZE)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, bytes.length)
      const chunk = bytes.slice(start, end)

      const currentTimestamp = getNormalizedTimestamp()
      const currentNonce = randomBytes(32)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')

      const currentOauthParams = {
        oauth_consumer_key: X_API_KEY,
        oauth_nonce: currentNonce,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: currentTimestamp,
        oauth_token: twitterToken.oauth1Token,
        oauth_version: '1.0',
      }

      const appendFormData = new FormData()
      appendFormData.append('command', 'APPEND')
      appendFormData.append('media_id', mediaId)
      appendFormData.append('segment_index', i.toString())
      appendFormData.append('media', new Blob([chunk]), 'media')

      const appendSignature = await generateOAuth1Signature(
        'POST',
        'https://upload.twitter.com/1.1/media/upload.json',
        { ...currentOauthParams },
        X_API_KEY_SECRET,
        twitterToken.oauth1TokenSecret,
      )

      const appendHeader = generateAuthHeader(currentOauthParams, appendSignature)

      const appendResponse = await fetch(
        'https://upload.twitter.com/1.1/media/upload.json',
        {
          method: 'POST',
          headers: {
            Authorization: appendHeader,
          },
          body: appendFormData,
        },
      )

      if (!appendResponse.ok) {
        const errorText = await appendResponse.text()
        logger.error(
          `APPEND chunk ${i + 1} failed`,
          { error: errorText },
          'TwitterMediaUpload'
        )
        throw new Error(`Twitter Media APPEND chunk ${i + 1} failed: ${errorText}`)
      }
    }

    // --- FINALIZE ---
    const finalizeParams = {
      command: 'FINALIZE',
      media_id: mediaId,
    }

    const finalizeSignature = await generateOAuth1Signature(
      'POST',
      'https://upload.twitter.com/1.1/media/upload.json',
      { ...oauthParams, ...finalizeParams },
      X_API_KEY_SECRET,
      twitterToken.oauth1TokenSecret,
    )

    const finalizeHeader = generateAuthHeader(oauthParams, finalizeSignature)
    const finalizeBody = new URLSearchParams(finalizeParams)

    const finalizeResponse = await fetch(
      'https://upload.twitter.com/1.1/media/upload.json',
      {
        method: 'POST',
        headers: {
          Authorization: finalizeHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: finalizeBody,
      },
    )

    if (!finalizeResponse.ok) {
      const errorText = await finalizeResponse.text()
      logger.error('FINALIZE failed', { error: errorText }, 'TwitterMediaUpload')
      throw new Error(`Twitter Media FINALIZE failed: ${errorText}`)
    }

    logger.info('Media upload completed', { mediaId, userId: user.id }, 'TwitterMediaUpload')

  return NextResponse.json({
    success: true,
    media_id_string: mediaId,
  })
}

