/**
 * API Route: /api/twitter/disconnect
 * Disconnects user's Twitter account (removes OAuth 1.0a credentials)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'

export async function POST(request: NextRequest) {
  const authUser = await authenticate(request)
  const user = await requireUserByIdentifier(authUser.userId, { id: true })

  await prisma.twitterOAuthToken.deleteMany({
    where: { userId: user.id },
  })

  logger.info('Twitter account disconnected', { userId: user.id }, 'TwitterDisconnect')

  return NextResponse.json({ success: true })
}

