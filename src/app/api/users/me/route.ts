/**
 * Current User Profile API
 * 
 * @route GET /api/users/me
 * @access Authenticated
 * 
 * @description
 * Returns the authenticated user's complete profile information including
 * profile status, social connections, reputation, and onboarding state.
 * Central endpoint for user session management and profile data.
 * 
 * **Profile Data Includes:**
 * - **Identity:** username, display name, bio, avatar, cover image
 * - **Onboarding Status:** profile completion, on-chain registration
 * - **Social Links:** Farcaster, Twitter connections and visibility settings
 * - **Blockchain:** wallet address, NFT token ID, on-chain status
 * - **Reputation:** reputation points, referral code, referral source
 * - **Stats:** cached profile statistics (posts, followers, following)
 * - **Permissions:** admin status, actor/agent flag
 * 
 * **Onboarding States:**
 * - `needsOnboarding: true` - User needs to complete profile setup
 * - `needsOnchain: true` - Profile complete but not registered on-chain
 * - Both false - Fully onboarded user
 * 
 * **Profile Completeness:**
 * A profile is considered complete when user has:
 * - Set a username
 * - Added a bio
 * - Uploaded a profile image
 * 
 * **Caching:**
 * Profile stats (posts, followers, etc.) are cached for performance.
 * Cache is invalidated on relevant user actions.
 * 
 * @returns {object} User profile response
 * @property {boolean} authenticated - Always true (auth required)
 * @property {boolean} needsOnboarding - Whether user needs profile setup
 * @property {boolean} needsOnchain - Whether user needs on-chain registration
 * @property {object|null} user - User profile object (null if no profile yet)
 * @property {object} user.stats - Cached profile statistics
 * 
 * **User Object Fields:**
 * @property {string} user.id - User ID
 * @property {string} user.privyId - Privy authentication ID
 * @property {string} user.username - Unique username
 * @property {string} user.displayName - Display name
 * @property {string} user.bio - User biography
 * @property {string} user.profileImageUrl - Profile image URL
 * @property {string} user.coverImageUrl - Cover image URL
 * @property {string} user.walletAddress - Blockchain wallet address
 * @property {boolean} user.onChainRegistered - On-chain registration status
 * @property {string} user.nftTokenId - Associated NFT token ID
 * @property {string} user.referralCode - User's referral code
 * @property {string} user.referredBy - Referrer's code (if referred)
 * @property {number} user.reputationPoints - Reputation score
 * @property {boolean} user.hasFarcaster - Farcaster connected
 * @property {boolean} user.hasTwitter - Twitter connected
 * @property {boolean} user.isAdmin - Admin privileges
 * @property {boolean} user.isActor - Agent/actor flag
 * 
 * @throws {401} Unauthorized - authentication required
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Get current user profile
 * const response = await fetch('/api/users/me', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * const { user, needsOnboarding, needsOnchain } = await response.json();
 * 
 * if (needsOnboarding) {
 *   // Redirect to onboarding flow
 *   router.push('/onboarding');
 * } else if (needsOnchain) {
 *   // Prompt for on-chain registration
 *   showOnchainModal();
 * } else {
 *   // User fully onboarded
 *   console.log(`Welcome, ${user.displayName}!`);
 * }
 * ```
 * 
 * @see {@link /lib/cached-database-service} Profile stats caching
 * @see {@link /lib/api/auth-middleware} Authentication
 * @see {@link /src/app/onboarding/page.tsx} Onboarding flow
 * @see {@link /src/contexts/AuthContext.tsx} Auth context consumer
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { cachedDb } from '@/lib/cached-database-service'

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
  isAdmin: true,
  isActor: true,
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

  // Get cached profile stats
  const stats = await cachedDb.getUserProfileStats(dbUser.id)

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
    isAdmin: dbUser.isAdmin,
    isActor: dbUser.isActor,
    createdAt: dbUser.createdAt.toISOString(),
    updatedAt: dbUser.updatedAt.toISOString(),
    stats: stats || undefined,
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
