/**
 * API Route: /api/twitter/auth-status
 * Checks if user has connected their Twitter account for posting
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { prisma } from '@/lib/database-service'
import { requireUserByIdentifier } from '@/lib/users/user-lookup'

export async function GET(request: NextRequest) {
  const authUser = await authenticate(request)
  const user = await requireUserByIdentifier(authUser.userId, { id: true })

  const twitterToken = await prisma.twitterOAuthToken.findUnique({
    where: { userId: user.id },
    select: {
      screenName: true,
      createdAt: true,
    },
  })

  if (!twitterToken) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    screenName: twitterToken.screenName,
    connectedAt: twitterToken.createdAt,
  })
}

