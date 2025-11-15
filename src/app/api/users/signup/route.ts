/**
 * API Route: /api/users/signup
 * Methods: POST (complete off-chain onboarding profile)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { OnboardingProfileSchema } from '@/lib/validation/schemas'
import { prisma } from '@/lib/prisma'
import { PointsService } from '@/lib/services/points-service'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { getPrivyClient } from '@/lib/api/auth-middleware'
import type { User as PrivyUser } from '@privy-io/server-auth'
import type { OnboardingProfilePayload } from '@/lib/onboarding/types'
import { trackServerEvent } from '@/lib/posthog/server'
import { notifyNewAccount } from '@/lib/services/notification-service'
import { generateSnowflakeId } from '@/lib/snowflake'
import { withRetry, isRetryableError } from '@/lib/prisma-retry'
import type { JsonValue } from '@/types/common'

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
  const body = await request.json() as SignupRequestBody | Record<string, JsonValue>

  const parsedBody = SignupSchema.parse(body)
  const { identityToken, referralCode: rawReferralCode, isWaitlist, ...profileData } = parsedBody
  const parsedProfile = profileData as OnboardingProfilePayload
  const referralCode = rawReferralCode?.trim() || null

  const canonicalUserId = authUser.dbUserId ?? authUser.userId
  const privyId = authUser.privyId ?? authUser.userId
  const walletAddress = authUser.walletAddress?.toLowerCase() ?? null

  // Fetch identity data from Privy if token provided
  let identityFarcasterUsername: string | undefined
  let identityTwitterUsername: string | undefined

  if (identityToken) {
    try {
      const privyClient = getPrivyClient()
      const identityUser: PrivyUser = await privyClient.getUserFromIdToken(identityToken)

      identityFarcasterUsername = identityUser.farcaster?.username ?? undefined
      identityTwitterUsername = identityUser.twitter?.username ?? undefined
    } catch (error) {
      logger.warn(
        'Failed to decode identity token during signup',
        { error },
        'POST /api/users/signup'
      )
    }
  } else {
    logger.info('Signup received no identity token; proceeding with provided payload only', undefined, 'POST /api/users/signup')
  }
  
  // Check for imported social data from onboarding flow
  const importedTwitter = parsedProfile.importedFrom === 'twitter'
  const importedFarcaster = parsedProfile.importedFrom === 'farcaster'

  // Wrap transaction with retry logic for connection errors
  const result = await withRetry(
    () => prisma.$transaction(async (tx) => {
      await tx.user.findUnique({
        where: { username: parsedProfile.username },
        select: { id: true },
      })

      if (walletAddress) {
        await tx.user.findUnique({
          where: { walletAddress: walletAddress },
          select: { id: true },
        })
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
              id: await generateSnowflakeId(),
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
          updatedAt: new Date(),
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
    }),
    'signup transaction',
    { maxRetries: 3, initialDelayMs: 200, maxDelayMs: 2000 }
  ).catch((error: unknown) => {
    // Improve error message for connection errors
    if (isRetryableError(error)) {
      logger.error(
        'Database connection error during signup transaction',
        { error: error instanceof Error ? error.message : String(error) },
        'POST /api/users/signup'
      );
      throw new Error('Database connection error. Please try again in a moment.');
    }
    throw error;
  })

  // Award points for social account linking
  const pointsAwarded = {
    farcaster: 0,
    twitter: 0,
    wallet: 0,
    profile: 0,
  };

  if (identityFarcasterUsername || importedFarcaster) {
    const farcasterUsername = parsedProfile.farcasterUsername ?? identityFarcasterUsername
    if (farcasterUsername) {
      const pointsResult = await PointsService.awardFarcasterLink(result.user.id, farcasterUsername)
      pointsAwarded.farcaster = pointsResult.pointsAwarded;
      logger.info(
        'Awarded Farcaster link points',
        { userId: result.user.id, username: farcasterUsername, points: pointsResult.pointsAwarded },
        'POST /api/users/signup'
      );
    }
  }
  if (identityTwitterUsername || importedTwitter) {
    const twitterUsername = parsedProfile.twitterUsername ?? identityTwitterUsername
    if (twitterUsername) {
      const pointsResult = await PointsService.awardTwitterLink(result.user.id, twitterUsername)
      pointsAwarded.twitter = pointsResult.pointsAwarded;
      logger.info(
        'Awarded Twitter link points',
        { userId: result.user.id, username: twitterUsername, points: pointsResult.pointsAwarded },
        'POST /api/users/signup'
      );
    }
  }
  if (walletAddress) {
    const pointsResult = await PointsService.awardWalletConnect(result.user.id, walletAddress)
    pointsAwarded.wallet = pointsResult.pointsAwarded;
    logger.info(
      'Awarded wallet connect points',
      { userId: result.user.id, address: walletAddress, points: pointsResult.pointsAwarded },
      'POST /api/users/signup'
    );
  }

  if (!result.user.pointsAwardedForProfile) {
    const pointsResult = await PointsService.awardProfileCompletion(result.user.id)
    pointsAwarded.profile = pointsResult.pointsAwarded;
    logger.info(
      'Awarded profile completion points',
      { userId: result.user.id, points: pointsResult.pointsAwarded },
      'POST /api/users/signup'
    );
  }

  const totalPointsAwarded = Object.values(pointsAwarded).reduce((sum, p) => sum + p, 0);

  logger.info(
    'User completed off-chain onboarding',
    {
      userId: result.user.id,
      hasReferrer: Boolean(result.referrerId),
      pointsAwarded: pointsAwarded,
      totalPointsAwarded: totalPointsAwarded,
      hasFarcaster: result.user.hasFarcaster,
      hasTwitter: result.user.hasTwitter,
    },
    'POST /api/users/signup'
  )

  await notifyNewAccount(result.user.id)

  logger.warn('Failed to send welcome notification', { userId: result.user.id }, 'POST /api/users/signup')

  // Track signup with PostHog
  await trackServerEvent(result.user.id, 'signup_completed', {
    username: result.user.username,
    hasReferrer: Boolean(result.referrerId),
    hasFarcaster: result.user.hasFarcaster,
    hasTwitter: result.user.hasTwitter,
    hasProfileImage: result.user.hasProfileImage,
    hasBio: result.user.hasBio,
    onChainRegistered: result.user.onChainRegistered,
    pointsAwarded: totalPointsAwarded,
    pointsBreakdown: pointsAwarded,
    importedFrom: parsedProfile.importedFrom || null,
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
