/**
 * API Route: /api/users/onboarding/onchain
 * Methods: POST (trigger on-chain registration for a user)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { prisma } from '@/lib/prisma'
import { processOnchainRegistration } from '@/lib/onboarding/onchain-service'
import { logger } from '@/lib/logger'
import { BusinessLogicError, ConflictError } from '@/lib/errors'
import type { JsonValue } from '@/types/common'

interface OnchainRequestBody {
  walletAddress?: string | null
  txHash?: string | null
  referralCode?: string | null
}

const selectUserForOnchain = {
  id: true,
  privyId: true,
  username: true,
  displayName: true,
  bio: true,
  profileImageUrl: true,
  coverImageUrl: true,
  walletAddress: true,
  onChainRegistered: true,
  nftTokenId: true,
  referredBy: true,
} as const

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request)
  const body = await request.json() as OnchainRequestBody | Record<string, JsonValue>

  const txHash =
    typeof (body as OnchainRequestBody).txHash === 'string'
      ? ((body as OnchainRequestBody).txHash?.trim() || null)
      : null
  const walletOverride =
    typeof (body as OnchainRequestBody).walletAddress === 'string'
      ? ((body as OnchainRequestBody).walletAddress?.trim() || null)
      : null
  const referralCode =
    typeof (body as OnchainRequestBody).referralCode === 'string'
      ? ((body as OnchainRequestBody).referralCode?.trim() || null)
      : null

  const canonicalUserId = authUser.dbUserId ?? authUser.userId

  const dbUser = await prisma.user.findUnique({
    where: { id: canonicalUserId },
    select: selectUserForOnchain,
  })

  if (!dbUser) {
    throw new ConflictError('User record not found. Complete signup before on-chain registration.', 'User')
  }

  if (!dbUser.username || !dbUser.displayName) {
    throw new BusinessLogicError(
      'User profile incomplete. Finish signup before on-chain registration.',
      'PROFILE_INCOMPLETE'
    )
  }

  const walletAddress = walletOverride?.toLowerCase() ?? dbUser.walletAddress ?? authUser.walletAddress
  if (!walletAddress) {
    throw new BusinessLogicError('Wallet address is required for on-chain registration.', 'WALLET_REQUIRED')
  }

  const onchainResult = await processOnchainRegistration({
    user: authUser,
    walletAddress,
    username: dbUser.username,
    displayName: dbUser.displayName,
    bio: dbUser.bio ?? undefined,
    profileImageUrl: dbUser.profileImageUrl ?? undefined,
    coverImageUrl: dbUser.coverImageUrl ?? undefined,
    referralCode,
    txHash,
  })

  const refreshedUser = await prisma.user.findUnique({
    where: { id: canonicalUserId },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      coverImageUrl: true,
      walletAddress: true,
      onChainRegistered: true,
      nftTokenId: true,
      reputationPoints: true,
      updatedAt: true,
    },
  })

  logger.info(
    'User completed on-chain onboarding',
    {
      userId: canonicalUserId,
      alreadyRegistered: onchainResult.alreadyRegistered,
      tokenId: onchainResult.tokenId,
    },
    'POST /api/users/onboarding/onchain'
  )

  return successResponse(
    {
      onchain: onchainResult,
      user: refreshedUser
        ? {
            ...refreshedUser,
            updatedAt: refreshedUser.updatedAt.toISOString(),
          }
        : null,
    },
    200
  )
})
