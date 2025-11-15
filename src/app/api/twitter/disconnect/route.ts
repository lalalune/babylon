/**
 * API Route: /api/twitter/disconnect
 * Disconnects user's Twitter account (removes OAuth 2.0 credentials)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'

export async function POST(request: NextRequest) {
  const authUser = await authenticate(request)
  const user = await requireUserByIdentifier(authUser.userId, { id: true })

  // Clear Twitter OAuth 2.0 credentials from user
  await prisma.user.update({
    where: { id: user.id },
    data: {
      twitterAccessToken: null,
      twitterRefreshToken: null,
      twitterTokenExpiresAt: null,
      twitterId: null,
      twitterUsername: null,
      hasTwitter: false,
    },
  })

  logger.info('Twitter account disconnected', { userId: user.id }, 'TwitterDisconnect')

  return NextResponse.json({ success: true })
}

