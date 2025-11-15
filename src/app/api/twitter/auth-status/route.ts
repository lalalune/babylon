/**
 * API Route: /api/twitter/auth-status
 * Checks if user has connected their Twitter account via OAuth 2.0
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'

export async function GET(request: NextRequest) {
  const authUser = await authenticate(request)
  const user = await requireUserByIdentifier(authUser.userId, { 
    id: true,
    twitterAccessToken: true,
    twitterUsername: true,
    updatedAt: true,
  })

  if (!user.twitterAccessToken) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    screenName: user.twitterUsername,
    connectedAt: user.updatedAt,
  })
}

