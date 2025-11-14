/**
 * API Route: /api/users/signup
 * Methods: POST (complete off-chain onboarding profile)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { ConflictError } from '@/lib/errors'
import { OnboardingProfileSchema } from '@/lib/validation/schemas'
import { prisma } from '@/lib/database-service'
import { PointsService } from '@/lib/services/points-service'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { getPrivyClient } from '@/lib/api/auth-middleware'
import type { User as PrivyUser } from '@privy-io/server-auth'
import type { OnboardingProfilePayload } from '@/lib/onboarding/types'
import { trackServerEvent } from '@/lib/posthog/server'

interface SignupRequestBody {
  username: string
  displayName: string
  bio?: string | null
  profileImageUrl?: string | null
  coverImageUrl?: string | null
  referralCode?: string | null
  identityToken?: string | null
  isWaitlist?: boolean // Mark user as waitlist during signup
  tosAccepted?: boolean
  privacyPolicyAccepted?: boolean
}

const selectUserSummary = {
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
  createdAt: true,
  updatedAt: true,
} as const

const SignupSchema = OnboardingProfileSchema.extend({
  identityToken: z.string().min(1).optional().or(z.literal('').transform(() => undefined)),
  isWaitlist: z.boolean().optional().default(false),
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request)
  const body = await request.json().catch(() => ({})) as SignupRequestBody | Record<string, unknown>

  const parsedBody = SignupSchema.parse(body)
  const { identityToken, referralCode: rawReferralCode, isWaitlist, ...profileData } = parsedBody
  const parsedProfile = profileData as OnboardingProfilePayload
  const referralCode = rawReferralCode?.trim() || null

  const canonicalUserId = authUser.dbUserId ?? authUser.userId
  const privyId = authUser.privyId ?? authUser.userId
  const walletAddress = authUser.walletAddress?.toLowerCase() ?? null

  const privyClient = getPrivyClient()
  let identityUser: PrivyUser | null = null
  if (identityToken) {
    try {
      identityUser = await privyClient.getUserFromIdToken(identityToken)
    } catch (identityError) {
      logger.warn(
        'Failed to decode identity token during signup',
        { error: identityError },
        'POST /api/users/signup'
      )
    }
  } else {
    logger.info('Signup received no identity token; proceeding with provided payload only', undefined, 'POST /api/users/signup')
  }

  const identityFarcasterUsername =
    identityUser?.farcaster?.username ?? identityUser?.farcaster?.displayName ?? null
  const identityTwitterUsername = identityUser?.twitter?.username ?? null
  
  // Check for imported social data from onboarding flow
  const importedTwitter = parsedProfile.importedFrom === 'twitter'
  const importedFarcaster = parsedProfile.importedFrom === 'farcaster'

  const result = await prisma.$transaction(async (tx) => {
    // Guard username uniqueness
    const existingUsername = await tx.user.findUnique({
      where: { username: parsedProfile.username },
      select: { id: true },
    })

    if (existingUsername && existingUsername.id !== canonicalUserId) {
      throw new ConflictError('Username already taken', 'User.username')
    }

    // Guard wallet address uniqueness (if provided)
    if (walletAddress) {
      const existingWallet = await tx.user.findUnique({
        where: { walletAddress: walletAddress },
        select: { id: true },
      })

      if (existingWallet && existingWallet.id !== canonicalUserId) {
        throw new ConflictError('Wallet address already linked to another account', 'User.walletAddress')
      }
    }

    // Resolve referral (if provided)
    let resolvedReferrerId: string | null = null
    let resolvedReferralRecordId: string | null = null

    if (referralCode) {
      const normalizedCode = referralCode.trim()

      const referrerByUsername = await tx.user.findUnique({
        where: { username: normalizedCode },
        select: { id: true },
      })

      if (referrerByUsername && referrerByUsername.id !== canonicalUserId) {
        resolvedReferrerId = referrerByUsername.id

        const referralRecord = await tx.referral.upsert({
          where: { referralCode: normalizedCode },
          update: {
            referredUserId: canonicalUserId,
            status: 'pending',
          },
          create: {
            referrerId: referrerByUsername.id,
            referralCode: normalizedCode,
            referredUserId: canonicalUserId,
            status: 'pending',
          },
          select: { id: true },
        })

        resolvedReferralRecordId = referralRecord.id
      } else {
        const referralRecord = await tx.referral.findUnique({
          where: { referralCode: normalizedCode },
          select: { id: true, referrerId: true, referredUserId: true },
        })

        if (
          referralRecord &&
          referralRecord.referrerId !== canonicalUserId &&
          (!referralRecord.referredUserId || referralRecord.referredUserId === canonicalUserId)
        ) {
          resolvedReferrerId = referralRecord.referrerId
          resolvedReferralRecordId = referralRecord.id
        }
      }
    }

    const baseUserData = {
      username: parsedProfile.username,
      displayName: parsedProfile.displayName,
      bio: parsedProfile.bio ?? '',
      profileImageUrl: parsedProfile.profileImageUrl ?? null,
      coverImageUrl: parsedProfile.coverImageUrl ?? null,
      walletAddress,
      profileComplete: true,
      hasUsername: true,
      hasBio: Boolean(parsedProfile.bio && parsedProfile.bio.trim().length > 0),
      hasProfileImage: Boolean(parsedProfile.profileImageUrl),
      // Waitlist users start with 100 points instead of 1000
      ...(isWaitlist ? { reputationPoints: 100 } : {}),
      // Legal acceptance (GDPR compliance)
      ...(parsedProfile.tosAccepted ? {
        tosAccepted: true,
        tosAcceptedAt: new Date(),
        tosAcceptedVersion: '2025-11-11',
      } : {}),
      ...(parsedProfile.privacyPolicyAccepted ? {
        privacyPolicyAccepted: true,
        privacyPolicyAcceptedAt: new Date(),
        privacyPolicyAcceptedVersion: '2025-11-11',
      } : {}),
    }

    const user = await tx.user.upsert({
      where: { id: canonicalUserId },
      update: {
        ...baseUserData,
        referredBy: resolvedReferrerId ?? undefined,
        // Handle Farcaster from Privy identity or onboarding import
        ...(identityFarcasterUsername || importedFarcaster
          ? {
              hasFarcaster: true,
              farcasterUsername: parsedProfile.farcasterUsername ?? identityFarcasterUsername,
              farcasterFid: parsedProfile.farcasterFid ?? undefined,
            }
          : {}),
        // Handle Twitter from Privy identity or onboarding import
        ...(identityTwitterUsername || importedTwitter
          ? {
              hasTwitter: true,
              twitterUsername: parsedProfile.twitterUsername ?? identityTwitterUsername,
              twitterId: parsedProfile.twitterId ?? undefined,
            }
          : {}),
      },
      create: {
        id: canonicalUserId,
        privyId,
        ...baseUserData,
        referredBy: resolvedReferrerId,
        // Handle Farcaster from Privy identity or onboarding import
        ...(identityFarcasterUsername || importedFarcaster
          ? {
              hasFarcaster: true,
              farcasterUsername: parsedProfile.farcasterUsername ?? identityFarcasterUsername,
              farcasterFid: parsedProfile.farcasterFid ?? undefined,
            }
          : {}),
        // Handle Twitter from Privy identity or onboarding import
        ...(identityTwitterUsername || importedTwitter
          ? {
              hasTwitter: true,
              twitterUsername: parsedProfile.twitterUsername ?? identityTwitterUsername,
              twitterId: parsedProfile.twitterId ?? undefined,
            }
          : {}),
      },
      select: selectUserSummary,
    })

    if (resolvedReferralRecordId) {
      await tx.referral.update({
        where: { id: resolvedReferralRecordId },
        data: {
          referredUserId: user.id,
          status: 'pending',
        },
      })
    }

    return {
      user,
      referrerId: resolvedReferrerId,
      referralRecordId: resolvedReferralRecordId,
    }
  })

  // Award points for social account linking
  if (identityFarcasterUsername || importedFarcaster) {
    const farcasterUsername = parsedProfile.farcasterUsername ?? identityFarcasterUsername
    if (farcasterUsername) {
      await PointsService.awardFarcasterLink(result.user.id, farcasterUsername)
    }
  }
  if (identityTwitterUsername || importedTwitter) {
    const twitterUsername = parsedProfile.twitterUsername ?? identityTwitterUsername
    if (twitterUsername) {
      await PointsService.awardTwitterLink(result.user.id, twitterUsername)
    }
  }
  if (walletAddress) {
    await PointsService.awardWalletConnect(result.user.id, walletAddress)
  }

  if (!result.user.pointsAwardedForProfile) {
    await PointsService.awardProfileCompletion(result.user.id)
  }

  logger.info(
    'User completed off-chain onboarding',
    {
      userId: result.user.id,
      hasReferrer: Boolean(result.referrerId),
    },
    'POST /api/users/signup'
  )

  // Track signup with PostHog
  await trackServerEvent(result.user.id, 'signup_completed', {
    username: result.user.username,
    hasReferrer: Boolean(result.referrerId),
    hasFarcaster: result.user.hasFarcaster,
    hasTwitter: result.user.hasTwitter,
    hasProfileImage: result.user.hasProfileImage,
    hasBio: result.user.hasBio,
    onChainRegistered: result.user.onChainRegistered,
  })

  return successResponse({
    user: {
      ...result.user,
      createdAt: result.user.createdAt.toISOString(),
      updatedAt: result.user.updatedAt.toISOString(),
    },
    referral: result.referrerId
      ? {
          referrerId: result.referrerId,
          referralRecordId: result.referralRecordId,
        }
      : null,
  })
})
