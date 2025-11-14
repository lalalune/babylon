/**
 * Points Service
 *
 * Centralized service for managing reputation points and rewards
 * Tracks all point transactions and ensures no duplicate awards
 */
import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import { POINTS, type PointsReason } from '@/lib/constants/points';

import type { JsonValue } from '@/types/common';

type LeaderboardCategory = 'all' | 'earned' | 'referral';

interface AwardPointsResult {
  success: boolean;
  pointsAwarded: number;
  newTotal: number;
  alreadyAwarded?: boolean;
  error?: string;
}

export class PointsService {
  /**
   * Award points to a user with transaction tracking
   */
  static async awardPoints(
    userId: string,
    amount: number,
    reason: PointsReason,
    metadata?: Record<string, JsonValue>
  ): Promise<AwardPointsResult> {
    // Get current user state
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        reputationPoints: true,
        invitePoints: true,
        earnedPoints: true,
        bonusPoints: true,
        pointsAwardedForProfile: true,
        pointsAwardedForFarcaster: true,
        pointsAwardedForTwitter: true,
        pointsAwardedForWallet: true,
      },
    });

    if (!user) {
      return {
        success: false,
        pointsAwarded: 0,
        newTotal: 0,
        error: 'User not found',
      };
    }

    // Check if points were already awarded for this reason
    const alreadyAwarded = this.checkAlreadyAwarded(user, reason);
    if (alreadyAwarded) {
      return {
        success: true,
        pointsAwarded: 0,
        newTotal: user.reputationPoints,
        alreadyAwarded: true,
      };
    }

    const pointsBefore = user.reputationPoints;
    const pointsAfter = pointsBefore + amount;

    // Build update data with proper typing for Prisma
    const updateData: {
      reputationPoints: number
      invitePoints?: number
      bonusPoints?: number
      pointsAwardedForProfile?: boolean
      pointsAwardedForFarcaster?: boolean
      pointsAwardedForTwitter?: boolean
      pointsAwardedForWallet?: boolean
    } = {
      reputationPoints: pointsAfter,
    };

    // Set the appropriate tracking flag and update correct point type
    switch (reason) {
      case 'referral_signup':
        updateData.invitePoints = user.invitePoints + amount;
        break;
      case 'profile_completion':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForProfile = true;
        break;
      case 'farcaster_link':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForFarcaster = true;
        break;
      case 'twitter_link':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForTwitter = true;
        break;
      case 'wallet_connect':
        updateData.bonusPoints = user.bonusPoints + amount;
        updateData.pointsAwardedForWallet = true;
        break;
      case 'share_action':
      case 'share_to_twitter':
        updateData.bonusPoints = user.bonusPoints + amount;
        break;
      default:
        // For admin awards, purchases, etc - add to bonus
        updateData.bonusPoints = user.bonusPoints + amount;
        break;
    }

    // Execute in transaction
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: updateData,
      });

      await tx.pointsTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          userId,
          amount,
          pointsBefore,
          pointsAfter,
          reason,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    });

    logger.info(
      `Awarded ${amount} points to user ${userId} for ${reason}`,
      { userId, amount, reason, pointsBefore, pointsAfter },
      'PointsService'
    );

    return {
      success: true,
      pointsAwarded: amount,
      newTotal: pointsAfter,
    };
  }

  /**
   * Award points for profile completion (username + image + bio)
   * This consolidates what were previously separate rewards
   */
  static async awardProfileCompletion(
    userId: string
  ): Promise<AwardPointsResult> {
    return this.awardPoints(
      userId,
      POINTS.PROFILE_COMPLETION,
      'profile_completion'
    );
  }

  /**
   * Award points for Farcaster link
   */
  static async awardFarcasterLink(
    userId: string,
    farcasterUsername?: string
  ): Promise<AwardPointsResult> {
    return this.awardPoints(
      userId,
      POINTS.FARCASTER_LINK,
      'farcaster_link',
      farcasterUsername ? { farcasterUsername } : undefined
    );
  }

  /**
   * Award points for Twitter link
   */
  static async awardTwitterLink(
    userId: string,
    twitterUsername?: string
  ): Promise<AwardPointsResult> {
    return this.awardPoints(
      userId,
      POINTS.TWITTER_LINK,
      'twitter_link',
      twitterUsername ? { twitterUsername } : undefined
    );
  }

  /**
   * Award points for wallet connection
   */
  static async awardWalletConnect(
    userId: string,
    walletAddress?: string
  ): Promise<AwardPointsResult> {
    return this.awardPoints(
      userId,
      POINTS.WALLET_CONNECT,
      'wallet_connect',
      walletAddress ? { walletAddress } : undefined
    );
  }

  /**
   * Award points for share action
   */
  static async awardShareAction(
    userId: string,
    platform: string,
    contentType: string,
    contentId?: string
  ): Promise<AwardPointsResult> {
    const amount =
      platform === 'twitter' ? POINTS.SHARE_TO_TWITTER : POINTS.SHARE_ACTION;
    const reason = platform === 'twitter' ? 'share_to_twitter' : 'share_action';

    return this.awardPoints(userId, amount, reason, {
      platform,
      contentType,
      ...(contentId ? { contentId } : {}),
    });
  }

  /**
   * Award points for referral signup
   */
  static async awardReferralSignup(
    referrerId: string,
    referredUserId: string
  ): Promise<AwardPointsResult> {
    const result = await this.awardPoints(
      referrerId,
      POINTS.REFERRAL_SIGNUP,
      'referral_signup',
      { referredUserId }
    );

    // Also increment referral count
    if (result.success) {
      await prisma.user.update({
        where: { id: referrerId },
        data: { referralCount: { increment: 1 } },
      });
    }

    return result;
  }

  /**
   * Purchase points via x402 payment (100 points = $1)
   */
  static async purchasePoints(
    userId: string,
    amountUSD: number,
    paymentRequestId: string,
    paymentTxHash?: string
  ): Promise<AwardPointsResult> {
    // Calculate points: 100 points per $1
    const pointsAmount = Math.floor(amountUSD * 100)

    // Get current user state
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputationPoints: true },
    })

    if (!user) {
      return {
        success: false,
        pointsAwarded: 0,
        newTotal: 0,
        error: 'User not found',
      }
    }

    const pointsBefore = user.reputationPoints
    const pointsAfter = pointsBefore + pointsAmount

    // Execute in transaction
    await prisma.$transaction(async (tx) => {
      // Update user points
      await tx.user.update({
        where: { id: userId },
        data: { reputationPoints: pointsAfter },
      });
      // Create transaction record with payment details
      await tx.pointsTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          userId,
          amount: pointsAmount,
          pointsBefore,
          pointsAfter,
          reason: 'purchase',
          metadata: JSON.stringify({
            amountUSD,
            pointsPerDollar: 100,
            purchasedAt: new Date().toISOString(),
          }),
          paymentRequestId,
          paymentTxHash,
          paymentAmount: amountUSD.toFixed(2),
          paymentVerified: true,
        },
      });
    });

    logger.info(
      `User ${userId} purchased ${pointsAmount} points for $${amountUSD}`,
      { userId, pointsAmount, amountUSD, paymentRequestId },
      'PointsService'
    )

    return {
      success: true,
      pointsAwarded: pointsAmount,
      newTotal: pointsAfter,
    }
  }

  /**
   * Check if points were already awarded for a specific reason
   */
  private static checkAlreadyAwarded(
    user: {
      pointsAwardedForProfile: boolean;
      pointsAwardedForFarcaster: boolean;
      pointsAwardedForTwitter: boolean;
      pointsAwardedForWallet: boolean;
    },
    reason: PointsReason
  ): boolean {
    switch (reason) {
      case 'profile_completion':
        return user.pointsAwardedForProfile;
      case 'farcaster_link':
        return user.pointsAwardedForFarcaster;
      case 'twitter_link':
        return user.pointsAwardedForTwitter;
      case 'wallet_connect':
        return user.pointsAwardedForWallet;
      default:
        return false; // For share actions and referrals, allow multiple awards
    }
  }

  /**
   * Get user's points and transaction history
   */
  static async getUserPoints(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        reputationPoints: true,
        referralCount: true,
        PointsTransaction: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      points: user.reputationPoints,
      referralCount: user.referralCount,
      transactions: user.PointsTransaction,
    };
  }

  /**
   * Get leaderboard with pagination (includes both Users and Actors with pools)
   */
  static async getLeaderboard(
    page: number = 1,
    pageSize: number = 100,
    minPoints: number = 500,
    pointsCategory: LeaderboardCategory = 'all'
  ) {
    const skip = (page - 1) * pageSize;

    const userWhere: {
      isActor: false;
      reputationPoints?: { gte: number };
      earnedPoints?: { not: number };
      invitePoints?: { gt: number };
    } = {
      isActor: false,
    };

    if (pointsCategory === 'all') {
      userWhere.reputationPoints = { gte: minPoints };
    } else if (pointsCategory === 'earned') {
      userWhere.earnedPoints = { not: 0 };
    } else if (pointsCategory === 'referral') {
      userWhere.invitePoints = { gt: 0 };
    }

    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        username: true,
        displayName: true,
        profileImageUrl: true,
        reputationPoints: true,
        invitePoints: true,
        earnedPoints: true,
        bonusPoints: true,
        referralCount: true,
        virtualBalance: true,
        lifetimePnL: true,
        createdAt: true,
      },
    });

    const combined = [
      ...users.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        profileImageUrl: user.profileImageUrl,
        allPoints: user.reputationPoints, // All Points = total reputation
        invitePoints: user.invitePoints,
        earnedPoints: user.earnedPoints,
        bonusPoints: user.bonusPoints,
        referralCount: user.referralCount,
        balance: Number(user.virtualBalance),
        lifetimePnL: Number(user.lifetimePnL),
        createdAt: user.createdAt,
        isActor: false,
        tier: null as string | null,
      })),
    ];

    if (pointsCategory === 'all') {
      const actors = await prisma.actor.findMany({
        where: {
          reputationPoints: { gte: minPoints },
          hasPool: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
          profileImageUrl: true,
          reputationPoints: true,
          tier: true,
          createdAt: true,
        },
      });

      combined.push(
        ...actors.map((actor) => ({
          id: actor.id,
          username: actor.id,
          displayName: actor.name,
          profileImageUrl: actor.profileImageUrl,
          allPoints: actor.reputationPoints,
          invitePoints: 0,
          earnedPoints: 0,
          bonusPoints: 0,
          referralCount: 0,
          balance: 0,
          lifetimePnL: 0,
          createdAt: actor.createdAt,
          isActor: true,
          tier: actor.tier,
        }))
      );
    }

    const sortField: 'allPoints' | 'earnedPoints' | 'invitePoints' =
      pointsCategory === 'all'
        ? 'allPoints'
        : pointsCategory === 'earned'
          ? 'earnedPoints'
          : 'invitePoints';

    combined.sort((a, b) => {
      const comparison = b[sortField] - a[sortField];
      if (comparison !== 0) {
        return comparison;
      }

      if (pointsCategory === 'referral') {
        const referralComparison = b.referralCount - a.referralCount;
        if (referralComparison !== 0) {
          return referralComparison;
        }
      }

      if (pointsCategory === 'earned') {
        const pnlComparison = b.lifetimePnL - a.lifetimePnL;
        if (pnlComparison !== 0) {
          return pnlComparison;
        }
      }

      return b.allPoints - a.allPoints;
    });

    const paginatedResults = combined.slice(skip, skip + pageSize);

    const resultsWithRank = paginatedResults.map((entry, index) => ({
      ...entry,
      rank: skip + index + 1,
    }));

    return {
      users: resultsWithRank,
      totalCount: combined.length,
      page,
      pageSize,
      totalPages: Math.ceil(combined.length / pageSize),
      pointsCategory,
    };
  }

  /**
   * Get user's rank on leaderboard (including actors)
   */
  static async getUserRank(userId: string): Promise<number | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reputationPoints: true, isActor: true },
    });

    if (!user || user.isActor) {
      return null;
    }

    // Count users with more points
    const higherUsersCount = await prisma.user.count({
      where: {
        reputationPoints: { gt: user.reputationPoints },
        isActor: false,
      },
    });

    // Count actors with more points
    const higherActorsCount = await prisma.actor.count({
      where: {
        reputationPoints: { gt: user.reputationPoints },
        hasPool: true,
      },
    });

    return higherUsersCount + higherActorsCount + 1;
  }
}
