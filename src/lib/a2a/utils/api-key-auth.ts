import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export const A2A_API_KEY_HEADER = 'x-babylon-api-key'
const REQUIRED_API_KEY = process.env.BABYLON_A2A_API_KEY

function isLocalRequest(req: NextRequest): boolean {
  const host = req.headers.get('host')?.toLowerCase() ?? ''
  return host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('::1')
}

interface AuthOptions {
  endpoint: string
}

/**
 * Validates the Babylon A2A API key header.
 * Returns a NextResponse on authentication failure, otherwise null.
 */
export function ensureA2AApiKey(
  req: NextRequest,
  options: AuthOptions
): NextResponse | null {
  if (isLocalRequest(req)) {
    // Allow local development without requiring the API key header.
    return null
  }

  if (!REQUIRED_API_KEY) {
    logger.error('BABYLON_A2A_API_KEY is not configured', options, 'A2AAuth')
    return NextResponse.json({
      error: 'A2A server is not configured. Contact Babylon support.'
    }, { status: 503 })
  }

  const provided = req.headers.get(A2A_API_KEY_HEADER)
  if (provided !== REQUIRED_API_KEY) {
    logger.warn('Invalid or missing A2A API key', {
      endpoint: options.endpoint,
      headerPresent: Boolean(provided)
    }, 'A2AAuth')

    return NextResponse.json({
      error: 'Unauthorized',
      message: 'Valid X-Babylon-Api-Key header is required'
    }, {
      status: 401,
      headers: {
        'WWW-Authenticate': 'ApiKey realm="Babylon", header="X-Babylon-Api-Key"'
      }
    })
  }

  return null
}

