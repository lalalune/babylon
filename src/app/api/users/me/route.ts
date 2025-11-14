/**
 * API Route: /api/users/me
 * Methods: GET (return authenticated user information)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'

const userSelect = {
  id: true,
  privyId: true,
  username: true,
  displayName: true,
  bio: true,
  profileImageUrl: true,
  coverImageUrl: true,
  walletAddress: true,
  profileComplete: true,
  hasUsername: true,
  hasBio: true,
  hasProfileImage: true,
  onChainRegistered: true,
  nftTokenId: true,
  referralCode: true,
  referredBy: true,
  reputationPoints: true,
  pointsAwardedForProfile: true,
  hasFarcaster: true,
  hasTwitter: true,
  farcasterUsername: true,
  twitterUsername: true,
  showTwitterPublic: true,
  showFarcasterPublic: true,
  showWalletPublic: true,
  createdAt: true,
  updatedAt: true,
} as const

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request)
  const privyId = authUser.privyId ?? authUser.userId

  logger.info(
    'Fetching user profile',
    { privyId, dbUserId: authUser.dbUserId },
    'GET /api/users/me'
  )

  const dbUser = await prisma.user.findUnique({
    where: { privyId },
    select: userSelect,
  })

  if (!dbUser) {
    logger.info(
      'Authenticated user has no profile record yet',
      { privyId, dbUserId: authUser.dbUserId },
      'GET /api/users/me'
    )

    return successResponse({
      authenticated: true,
      needsOnboarding: true,
      needsOnchain: false,
      user: null,
    })
  }

  const responseUser = {
    id: dbUser.id,
    privyId: dbUser.privyId,
    username: dbUser.username,
    displayName: dbUser.displayName,
    bio: dbUser.bio,
    profileImageUrl: dbUser.profileImageUrl,
    coverImageUrl: dbUser.coverImageUrl,
    walletAddress: dbUser.walletAddress,
    profileComplete: dbUser.profileComplete,
    hasUsername: dbUser.hasUsername,
    hasBio: dbUser.hasBio,
    hasProfileImage: dbUser.hasProfileImage,
    onChainRegistered: dbUser.onChainRegistered,
    nftTokenId: dbUser.nftTokenId,
    referralCode: dbUser.referralCode,
    referredBy: dbUser.referredBy,
    reputationPoints: dbUser.reputationPoints,
    pointsAwardedForProfile: dbUser.pointsAwardedForProfile,
    hasFarcaster: dbUser.hasFarcaster,
    hasTwitter: dbUser.hasTwitter,
    farcasterUsername: dbUser.farcasterUsername,
    twitterUsername: dbUser.twitterUsername,
    showTwitterPublic: dbUser.showTwitterPublic,
    showFarcasterPublic: dbUser.showFarcasterPublic,
    showWalletPublic: dbUser.showWalletPublic,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
  }

  const needsOnboarding = !dbUser.profileComplete
  const needsOnchain = dbUser.profileComplete && !dbUser.onChainRegistered

  logger.info(
    'Authenticated user profile fetched',
    { 
      userId: dbUser.id, 
      username: dbUser.username,
      profileComplete: dbUser.profileComplete,
      onChainRegistered: dbUser.onChainRegistered,
      nftTokenId: dbUser.nftTokenId,
      needsOnboarding, 
      needsOnchain 
    },
    'GET /api/users/me'
  )

  return successResponse({
    authenticated: true,
    needsOnboarding,
    needsOnchain,
    user: responseUser,
  })
})
