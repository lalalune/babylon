/**
 * API Route: /api/users/export-data
 * Methods: GET (export all user data for GDPR compliance)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'

export const GET = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request)
  const userId = authUser.dbUserId ?? authUser.userId

  logger.info('User requested data export', { userId }, 'GET /api/users/export-data')

  // Fetch all user data from database
  const [
    user,
    comments,
    reactions,
    posts,
    positions,
    follows,
    followers,
    balanceTransactions,
    pointsTransactions,
    referrals,
    notifications,
    feedback,
    performanceMetrics,
    tradingFees,
    referralFeesEarned,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        privyId: true,
        walletAddress: true,
        username: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        coverImageUrl: true,
        email: true,
        virtualBalance: true,
        totalDeposited: true,
        totalWithdrawn: true,
        lifetimePnL: true,
        onChainRegistered: true,
        nftTokenId: true,
        registrationTxHash: true,
        registrationBlockNumber: true,
        registrationTimestamp: true,
        reputationPoints: true,
        invitePoints: true,
        earnedPoints: true,
        bonusPoints: true,
        profileComplete: true,
        hasFarcaster: true,
        hasTwitter: true,
        farcasterUsername: true,
        farcasterFid: true,
        twitterUsername: true,
        twitterId: true,
        referralCode: true,
        referredBy: true,
        referralCount: true,
        waitlistPosition: true,
        waitlistJoinedAt: true,
        isWaitlistActive: true,
        waitlistGraduatedAt: true,
        tosAccepted: true,
        tosAcceptedAt: true,
        tosAcceptedVersion: true,
        privacyPolicyAccepted: true,
        privacyPolicyAcceptedAt: true,
        privacyPolicyAcceptedVersion: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.comment.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        content: true,
        postId: true,
        parentCommentId: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.reaction.findMany({
      where: { userId },
      select: {
        id: true,
        postId: true,
        commentId: true,
        type: true,
        createdAt: true,
      },
    }),
    prisma.post.findMany({
      where: { authorId: userId },
      select: {
        id: true,
        type: true,
        content: true,
        fullContent: true,
        articleTitle: true,
        timestamp: true,
        createdAt: true,
        deletedAt: true, // Include deleted status for GDPR export
      },
    }),
    prisma.position.findMany({
      where: { userId },
      select: {
        id: true,
        marketId: true,
        side: true,
        shares: true,
        avgPrice: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.follow.findMany({
      where: { followerId: userId },
      select: {
        id: true,
        followingId: true,
        createdAt: true,
      },
    }),
    prisma.follow.findMany({
      where: { followingId: userId },
      select: {
        id: true,
        followerId: true,
        createdAt: true,
      },
    }),
    prisma.balanceTransaction.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        amount: true,
        balanceBefore: true,
        balanceAfter: true,
        relatedId: true,
        description: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pointsTransaction.findMany({
      where: { userId },
      select: {
        id: true,
        amount: true,
        pointsBefore: true,
        pointsAfter: true,
        reason: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.referral.findMany({
      where: { referrerId: userId },
      select: {
        id: true,
        referralCode: true,
        referredUserId: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        actorId: true,
        postId: true,
        commentId: true,
        title: true,
        message: true,
        read: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit to recent notifications
    }),
    prisma.feedback.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        score: true,
        rating: true,
        comment: true,
        category: true,
        interactionType: true,
        createdAt: true,
      },
    }),
    prisma.agentPerformanceMetrics.findUnique({
      where: { userId },
      select: {
        id: true,
        gamesPlayed: true,
        gamesWon: true,
        averageGameScore: true,
        normalizedPnL: true,
        totalTrades: true,
        profitableTrades: true,
        winRate: true,
        averageROI: true,
        reputationScore: true,
        trustLevel: true,
        totalFeedbackCount: true,
        averageFeedbackScore: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.tradingFee.findMany({
      where: { userId },
      select: {
        id: true,
        tradeType: true,
        tradeId: true,
        marketId: true,
        feeAmount: true,
        platformFee: true,
        referrerFee: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.tradingFee.findMany({
      where: { referrerId: userId },
      select: {
        id: true,
        userId: true,
        tradeType: true,
        referrerFee: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  if (!user) {
    return successResponse({ error: 'User not found' }, 404)
  }

  // Compile all data into a comprehensive export
  const exportData = {
    export_info: {
      exported_at: new Date().toISOString(),
      user_id: userId,
      format_version: '1.0',
    },
    personal_information: {
      ...user,
      // Important notice about blockchain data
      blockchain_notice:
        'On-chain data (wallet address, NFT token ID, registration transaction) is recorded on public blockchain and cannot be deleted.',
    },
    content: {
      posts,
      comments,
      reactions,
    },
    trading: {
      positions,
      balance_transactions: balanceTransactions,
    },
    social: {
      following: follows,
      followers,
      referrals,
    },
    points_and_reputation: {
      points_transactions: pointsTransactions,
      performance_metrics: performanceMetrics,
      feedback_given_and_received: feedback,
    },
    financial: {
      trading_fees_paid: tradingFees,
      referral_fees_earned: referralFeesEarned,
    },
    notifications: notifications,
    legal_consent: {
      terms_of_service: {
        accepted: user.tosAccepted,
        accepted_at: user.tosAcceptedAt,
        version: user.tosAcceptedVersion,
      },
      privacy_policy: {
        accepted: user.privacyPolicyAccepted,
        accepted_at: user.privacyPolicyAcceptedAt,
        version: user.privacyPolicyAcceptedVersion,
      },
    },
  }

  // Return as JSON download
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="babylon-data-export-${userId}-${Date.now()}.json"`,
    },
  })
})

