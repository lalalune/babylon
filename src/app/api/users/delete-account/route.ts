/**
 * API Route: /api/users/delete-account
 * Methods: POST (delete user account - GDPR right to erasure)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const DeleteAccountSchema = z.object({
  confirmation: z.literal('DELETE MY ACCOUNT'),
  reason: z.string().optional(),
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request)
  const userId = authUser.dbUserId ?? authUser.userId

  const body = await request.json()
  const { reason } = DeleteAccountSchema.parse(body)

  logger.info(
    'User requested account deletion',
    { userId, reason: reason || 'No reason provided' },
    'POST /api/users/delete-account'
  )

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      walletAddress: true,
      onChainRegistered: true,
      nftTokenId: true,
    },
  })

  if (!user) {
    return successResponse({ error: 'User not found' }, 404)
  }

  // Important notice about blockchain data
  const blockchainNotice = user.onChainRegistered
    ? {
        blockchain_data_notice:
          'Your on-chain data (wallet address, NFT token ID, transaction history) is permanently recorded on the blockchain and cannot be deleted. It will remain publicly visible.',
        wallet_address: user.walletAddress,
        nft_token_id: user.nftTokenId,
      }
    : null

  // Perform cascading deletion in a transaction
  // Note: Many relationships have onDelete: Cascade in schema, so Prisma handles them
  await prisma.$transaction(async (tx) => {
    // Delete related data that doesn't cascade automatically or needs special handling
    
    // Delete referral relationships
    await tx.referral.updateMany({
      where: { referredUserId: userId },
      data: { referredUserId: null }, // Preserve referral record but disconnect user
    })

    // Delete trading fees where user was referrer (set to null)
    await tx.tradingFee.updateMany({
      where: { referrerId: userId },
      data: { referrerId: null },
    })

    // Anonymize feedback (preserve for AI training but disconnect from user)
    await tx.feedback.updateMany({
      where: { fromUserId: userId },
      data: { fromUserId: null },
    })

    await tx.feedback.updateMany({
      where: { toUserId: userId },
      data: { toUserId: null },
    })

    // Delete user actor follows
    await tx.userActorFollow.deleteMany({
      where: { userId },
    })

    // Delete user interactions
    await tx.userInteraction.deleteMany({
      where: { userId },
    })

    // Delete group chat memberships
    await tx.groupChatMembership.deleteMany({
      where: { userId },
    })

    // Delete follow status
    await tx.followStatus.deleteMany({
      where: { userId },
    })

    // Delete share actions
    await tx.shareAction.deleteMany({
      where: { userId },
    })

    // Delete pool deposits
    await tx.poolDeposit.deleteMany({
      where: { userId },
    })

    // Finally, delete the user (this will cascade to most other tables)
    await tx.user.delete({
      where: { id: userId },
    })

    logger.info('User account deleted successfully', { userId, username: user.username }, 'POST /api/users/delete-account')
  })

  return successResponse({
    success: true,
    message: 'Your account has been permanently deleted.',
    deleted_data: {
      user_id: userId,
      username: user.username,
      deletion_time: new Date().toISOString(),
    },
    ...(blockchainNotice ? { blockchain_notice: blockchainNotice } : {}),
    important_notes: [
      'Your account and personal data have been deleted from our servers.',
      'Some anonymized data may be retained for analytics and AI training.',
      'Blockchain data (if any) remains permanently on the blockchain and cannot be deleted.',
      'If you registered via email, you may need to contact our authentication provider (Privy) to delete your auth account separately.',
    ],
  })
})

