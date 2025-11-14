/**
 * API Route: /api/users/[userId]/update-profile
 * Methods: POST (update user profile)
 */

import {
  authenticate,
  successResponse
} from '@/lib/api/auth-middleware';
import { prisma } from '@/lib/database-service';
import { AuthorizationError } from '@/lib/errors';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { notifyProfileComplete } from '@/lib/services/notification-service';
import { PointsService } from '@/lib/services/points-service';
import { UpdateUserSchema, UserIdParamSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';
import { requireUserByIdentifier } from '@/lib/users/user-lookup';
import { confirmOnchainProfileUpdate } from '@/lib/onboarding/onchain-service';
import { trackServerEvent } from '@/lib/posthog/server';
import { updateProfileBackendSigned, isBackendSigningEnabled } from '@/lib/profile/backend-signer';
import { checkProfileUpdateRateLimit, logProfileUpdate } from '@/lib/profile/rate-limiter';
import type { Address } from 'viem';

/**
 * POST /api/users/[userId]/update-profile
 * Update user profile information
 */
export const POST = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  // Authenticate user
  const authUser = await authenticate(request);
  const params = await context.params;
  const { userId } = UserIdParamSchema.parse(params);
  const targetUser = await requireUserByIdentifier(userId, { id: true });
  const canonicalUserId = targetUser.id;

  // Ensure user can only update their own profile
  if (authUser.userId !== canonicalUserId) {
    throw new AuthorizationError('You can only update your own profile', 'profile', 'update');
  }

  // Parse and validate request body
  const body = await request.json();
  const parsedBody = UpdateUserSchema.parse(body);
  const {
    username,
    displayName,
    bio,
    profileImageUrl,
    coverImageUrl,
    showTwitterPublic,
    showFarcasterPublic,
    showWalletPublic,
    onchainTxHash,
  } = parsedBody;

  await prisma.user.findFirst({
    where: {
      username: username!.trim(),
      id: { not: canonicalUserId },
    },
  })

  const currentUser = await prisma.user.findUnique({
    where: { id: canonicalUserId },
    select: {
      username: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      coverImageUrl: true,
      hasUsername: true,
      hasBio: true,
      hasProfileImage: true,
      usernameChangedAt: true,
      pointsAwardedForProfile: true,
      walletAddress: true,
      onChainRegistered: true,
      nftTokenId: true,
    },
  })

  const normalizedUsername = username !== undefined ? username.trim() : undefined;
  const normalizedDisplayName = displayName !== undefined ? displayName.trim() : undefined;
  const normalizedBio = bio !== undefined ? bio.trim() : undefined;
  const normalizedProfileImageUrl = profileImageUrl !== undefined ? profileImageUrl.trim() : undefined;
  const normalizedCoverImageUrl = coverImageUrl !== undefined ? coverImageUrl.trim() : undefined;

  const isUsernameChanging =
    normalizedUsername !== undefined &&
    normalizedUsername !== (currentUser!.username ?? '')

  await checkProfileUpdateRateLimit(canonicalUserId, isUsernameChanging)

  const hasOnchainProfileChanges = [
    normalizedUsername !== undefined && normalizedUsername !== (currentUser!.username ?? ''),
    normalizedDisplayName !== undefined && normalizedDisplayName !== (currentUser!.displayName ?? ''),
    normalizedBio !== undefined && normalizedBio !== (currentUser!.bio ?? ''),
  ].some(Boolean)

  const requiresOnchainUpdate = hasOnchainProfileChanges && currentUser!.onChainRegistered && currentUser!.nftTokenId

  let onchainMetadata: Record<string, unknown> | null = null
  let backendSignedTxHash: `0x${string}` | undefined
  
  if (requiresOnchainUpdate) {
    if (isBackendSigningEnabled()) {
      logger.info(
        'Using backend signing for profile update',
        { userId: canonicalUserId },
        'POST /api/users/[userId]/update-profile'
      )

      const endpoint = `https://babylon.market/agent/${currentUser!.walletAddress!.toLowerCase()}`
      const metadata = {
        name: normalizedDisplayName!,
        username: normalizedUsername!,
        bio: normalizedBio!,
        profileImageUrl: normalizedProfileImageUrl!,
        coverImageUrl: normalizedCoverImageUrl!,
      }

      const result = await updateProfileBackendSigned({
        userAddress: currentUser!.walletAddress! as Address,
        metadata,
        endpoint,
      })

      backendSignedTxHash = result.txHash
      onchainMetadata = result.metadata as unknown as Record<string, unknown>

      logger.info(
        'Backend-signed profile update successful',
        { userId: canonicalUserId, txHash: backendSignedTxHash },
        'POST /api/users/[userId]/update-profile'
      )

      logger.error(
        'Backend signing failed',
        { userId: canonicalUserId },
        'POST /api/users/[userId]/update-profile'
      )
    } else {
      const onchainResult = await confirmOnchainProfileUpdate({
        userId: canonicalUserId,
        walletAddress: currentUser!.walletAddress!,
        txHash: onchainTxHash! as `0x${string}`,
      })

      onchainMetadata = onchainResult.metadata

      logger.info(
        'Confirmed user-signed on-chain profile update',
        { userId: canonicalUserId, txHash: onchainTxHash, tokenId: onchainResult.tokenId },
        'POST /api/users/[userId]/update-profile'
      )
    }
  }

  const updatedUser = await prisma.user.update({
    where: { id: canonicalUserId },
    data: {
      ...(normalizedUsername !== undefined && { username: normalizedUsername || null }),
      ...(normalizedDisplayName !== undefined && { displayName: normalizedDisplayName || null }),
      ...(normalizedBio !== undefined && { bio: normalizedBio || null }),
      ...(normalizedProfileImageUrl !== undefined && { profileImageUrl: normalizedProfileImageUrl || null }),
      ...(normalizedCoverImageUrl !== undefined && { coverImageUrl: normalizedCoverImageUrl || null }),
      ...(showTwitterPublic !== undefined && { showTwitterPublic }),
      ...(showFarcasterPublic !== undefined && { showFarcasterPublic }),
      ...(showWalletPublic !== undefined && { showWalletPublic }),
      ...(isUsernameChanging && { usernameChangedAt: new Date() }),
      hasUsername: normalizedUsername !== undefined ? normalizedUsername.length > 0 : undefined,
      hasBio: normalizedBio !== undefined ? normalizedBio.length > 0 : undefined,
      hasProfileImage: normalizedProfileImageUrl !== undefined ? normalizedProfileImageUrl.length > 0 : undefined,
      profileComplete:
        normalizedUsername !== undefined &&
        normalizedDisplayName !== undefined &&
        normalizedBio !== undefined &&
        normalizedProfileImageUrl !== undefined
          ? normalizedUsername.length > 0 &&
            normalizedDisplayName.length > 0 &&
            normalizedBio.length > 0 &&
            normalizedProfileImageUrl.length > 0
          : undefined,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      coverImageUrl: true,
      profileComplete: true,
      hasUsername: true,
      hasBio: true,
      hasProfileImage: true,
      reputationPoints: true,
      referralCount: true,
      referralCode: true,
      usernameChangedAt: true,
      onChainRegistered: true,
      nftTokenId: true,
    },
  });

  // Award points for profile milestones
  const pointsAwarded: { reason: string; amount: number }[] = [];

  if (!currentUser!.pointsAwardedForProfile) {
    const hasUsername = updatedUser.username && updatedUser.username.trim().length > 0;
    const hasImage = updatedUser.profileImageUrl && updatedUser.profileImageUrl.trim().length > 0;
    const hasBio = updatedUser.bio && updatedUser.bio.trim().length >= 50;

    if (hasUsername && hasImage && hasBio) {
      const result = await PointsService.awardProfileCompletion(canonicalUserId);
      if (result.success && result.pointsAwarded > 0) {
        pointsAwarded.push({ reason: 'profile_completion', amount: result.pointsAwarded });
        logger.info(
          `Awarded ${result.pointsAwarded} points to user ${canonicalUserId} for completing profile (username + image + bio)`,
          { userId: canonicalUserId, points: result.pointsAwarded },
          'POST /api/users/[userId]/update-profile'
        );

        await notifyProfileComplete(canonicalUserId, result.pointsAwarded);
        logger.info('Profile completion notification sent', { userId: canonicalUserId }, 'POST /api/users/[userId]/update-profile');
      }
    }
  }

  if (pointsAwarded.length > 0) {
    logger.info(
      `Awarded points for profile updates: ${pointsAwarded.map((p) => `${p.reason}(+${p.amount})`).join(', ')}`,
      { userId: canonicalUserId, pointsAwarded },
      'POST /api/users/[userId]/update-profile'
    );
  }

  // Log the profile update for rate limiting and auditing
  const fieldsUpdated = Object.keys(parsedBody).filter(key => parsedBody[key as keyof typeof parsedBody] !== undefined);
  await logProfileUpdate(
    canonicalUserId,
    fieldsUpdated,
    Boolean(backendSignedTxHash),
    backendSignedTxHash || onchainTxHash
  );

  logger.info(
    'Profile updated successfully',
    { userId: canonicalUserId, pointsAwarded: pointsAwarded.length, onchainConfirmed: requiresOnchainUpdate, backendSigned: Boolean(backendSignedTxHash) },
    'POST /api/users/[userId]/update-profile'
  );

  // Track profile updated event
  trackServerEvent(canonicalUserId, 'profile_updated', {
    fieldsUpdated,
    hasNewProfileImage: normalizedProfileImageUrl !== undefined && normalizedProfileImageUrl !== currentUser!.profileImageUrl,
    hasNewCoverImage: normalizedCoverImageUrl !== undefined && normalizedCoverImageUrl !== currentUser!.coverImageUrl,
    hasNewBio: normalizedBio !== undefined && normalizedBio !== currentUser!.bio,
    usernameChanged: isUsernameChanging,
    profileComplete: updatedUser.profileComplete,
    pointsAwarded: pointsAwarded.reduce((sum, p) => sum + p.amount, 0),
    onchainUpdate: requiresOnchainUpdate,
    backendSigned: Boolean(backendSignedTxHash),
  }).catch((error) => {
    logger.warn('Failed to track profile_updated event', { error });
  });

  return successResponse({
    user: updatedUser,
    message: 'Profile updated successfully',
    pointsAwarded,
    onchain: requiresOnchainUpdate
      ? {
          txHash: backendSignedTxHash || onchainTxHash,
          metadata: onchainMetadata,
          backendSigned: Boolean(backendSignedTxHash),
        }
      : null,
  });
});
