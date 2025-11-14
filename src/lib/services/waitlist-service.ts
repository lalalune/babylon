/**
 * Waitlist Service
 * Manages waitlist signups, positions, and invite codes
 */

import { prisma } from '@/lib/database-service';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import { nanoid } from 'nanoid';

export interface WaitlistMarkResult {
  success: boolean
  waitlistPosition: number
  inviteCode: string
  points: number
  referrerRewarded?: boolean
  error?: string
}

export interface WaitlistPosition {
  waitlistPosition: number // Historical signup order (for records)
  leaderboardRank: number  // Actual position in line (dynamic, based on points)
  totalAhead: number       // How many people are ahead (by points)
  totalCount: number       // Total people on waitlist
  percentile: number       // Top X% of waitlist
  inviteCode: string
  points: number
  invitePoints: number
  earnedPoints: number
  bonusPoints: number
  referralCount: number
}

export class WaitlistService {
  /**
   * Generate a unique invite code
   */
  static generateInviteCode(): string {
    return nanoid(8).toUpperCase()
  }

  /**
   * Mark an existing user as waitlisted (after they complete onboarding)
   * NOTE: Users should be created through normal onboarding flow first
   */
  static async markAsWaitlisted(
    userId: string,
    referralCode?: string
  ): Promise<WaitlistMarkResult> {
    // Get user - they should already exist from onboarding
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        waitlistPosition: true,
        referralCode: true,
        referredBy: true,
        reputationPoints: true,
        invitePoints: true,
        earnedPoints: true,
        bonusPoints: true,
        isWaitlistActive: true,
      },
    })

    if (!user) {
      throw new Error('User not found - must complete onboarding first')
    }

    // If user already marked as waitlisted, return their info
    if (user.waitlistPosition && user.isWaitlistActive) {
      return {
        success: true,
        waitlistPosition: user.waitlistPosition,
        inviteCode: user.referralCode || '',
        points: user.reputationPoints,
      }
    }

    // Get the highest waitlist position
    const lastPosition = await prisma.user.findFirst({
      where: { waitlistPosition: { not: null } },
      orderBy: { waitlistPosition: 'desc' },
      select: { waitlistPosition: true },
    })

    const newPosition = (lastPosition?.waitlistPosition || 0) + 1
    
    // Generate invite code if user doesn't have one
    const inviteCode = user.referralCode || this.generateInviteCode()

    // Handle referral rewards with validation
    let referrerRewarded = false
    
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode },
        select: { 
          id: true,
          reputationPoints: true,
          invitePoints: true,
          referralCount: true,
        },
      })

      if (referrer) {
        // PREVENT SELF-REFERRAL: Can't refer yourself!
        if (referrer.id === userId) {
          logger.warn(`User ${userId} attempted self-referral`, {
            userId,
            referralCode,
          }, 'WaitlistService')
        }
        // PREVENT DOUBLE-REFERRAL: Check if user was already referred
        else if (user.referredBy) {
          logger.warn(`User ${userId} already referred by ${user.referredBy}, ignoring new referral`, {
            userId,
            existingReferrer: user.referredBy,
            attemptedReferrer: referrer.id,
          }, 'WaitlistService')
        }
        // Valid referral - award points!
        else {
          // Award +50 points to referrer
          const newInvitePoints = referrer.invitePoints + 50
          const newReputationPoints = referrer.reputationPoints + 50
          
          await prisma.user.update({
            where: { id: referrer.id },
            data: {
              invitePoints: newInvitePoints,
              reputationPoints: newReputationPoints,
              referralCount: { increment: 1 },
            },
          })

          // Create points transaction for referrer
          await prisma.pointsTransaction.create({
            data: {
              id: await generateSnowflakeId(),
              userId: referrer.id,
              amount: 50,
              pointsBefore: referrer.reputationPoints,
              pointsAfter: newReputationPoints,
              reason: 'referral',
              metadata: JSON.stringify({
                type: 'waitlist_referral',
                referredUserId: userId,
              }),
            },
          })

          referrerRewarded = true
          
          logger.info(`Rewarded referrer ${referrer.id} with 50 points`, {
            referrerId: referrer.id,
            newPoints: newReputationPoints,
          }, 'WaitlistService')
        }
      } else {
        logger.warn(`Invalid referral code: ${referralCode}`, {
          userId,
          referralCode,
        }, 'WaitlistService')
      }
    }

    // Update user as waitlisted
    // IMPORTANT: Don't change reputationPoints here - they should already have correct amount from onboarding
    // Only set referredBy if referrerRewarded (valid referral)
    await prisma.user.update({
      where: { id: userId },
      data: {
        waitlistPosition: newPosition,
        waitlistJoinedAt: new Date(),
        isWaitlistActive: true,
        referralCode: inviteCode,
        ...(referrerRewarded && referralCode ? {
          referredBy: (await prisma.user.findUnique({
            where: { referralCode },
            select: { id: true }
          }))?.id
        } : {}),
      },
    })

    logger.info(`User marked as waitlisted`, {
      userId,
      position: newPosition,
      referrerRewarded,
    }, 'WaitlistService')

    return {
      success: true,
      waitlistPosition: newPosition,
      inviteCode,
      points: user.reputationPoints,
      referrerRewarded,
    }
  }

  /**
   * Graduate a user from waitlist to full access
   */
  static async graduateFromWaitlist(userId: string): Promise<boolean> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isWaitlistActive: false,
        waitlistGraduatedAt: new Date(),
      },
    })

    logger.info('User graduated from waitlist', { userId }, 'WaitlistService')
    return true
  }

  /**
   * Get user's waitlist position and stats
   * CRITICAL: Position is based on INVITE POINTS (leaderboard rank), not signup order!
   * This creates the viral loop incentive.
   */
  static async getWaitlistPosition(userId: string): Promise<WaitlistPosition | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        waitlistPosition: true,
        waitlistJoinedAt: true,
        isWaitlistActive: true,
        referralCode: true,
        reputationPoints: true,
        invitePoints: true,
        earnedPoints: true,
        bonusPoints: true,
        referralCount: true,
      },
    })

    if (!user || !user.isWaitlistActive) {
      return null
    }

      // Count users ahead in line based on INVITE POINTS (viral loop!)
      // Users with more invites are closer to the front
      const usersAhead = await prisma.user.count({
        where: {
          isWaitlistActive: true,
          OR: [
            // Primary sort: More invite points = better position
            { invitePoints: { gt: user.invitePoints } },
            // Tie-breaker: If same invite points, earlier signup wins
            {
              invitePoints: user.invitePoints,
              waitlistJoinedAt: { lt: user.waitlistJoinedAt || new Date() },
            },
          ],
        },
      })

      // Calculate leaderboard rank (actual position in line)
      const leaderboardRank = usersAhead + 1

      // Get total waitlist count
      const totalCount = await this.getTotalWaitlistCount()

      // Calculate percentile (what % of people are behind you)
      const percentile = totalCount > 0 
        ? Math.round(((totalCount - usersAhead) / totalCount) * 100) 
        : 100

      return {
        waitlistPosition: user.waitlistPosition || 0,  // Historical record
        leaderboardRank,                               // What users see!
        totalAhead: usersAhead,
        totalCount,
        percentile,
        inviteCode: user.referralCode || '',
        points: user.reputationPoints,
        invitePoints: user.invitePoints,
        earnedPoints: user.earnedPoints,
        bonusPoints: user.bonusPoints,
        referralCount: user.referralCount,
      }
  }

  /**
   * Award bonus points for email verification
   */
  static async awardEmailBonus(userId: string, email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pointsAwardedForEmail: true,
        reputationPoints: true,
        bonusPoints: true,
      },
    })

    if (!user) {
      return false
    }

    // Don't award if already awarded
    if (user.pointsAwardedForEmail) {
      return false
    }

    const bonusAmount = 25
    const newBonusPoints = user.bonusPoints + bonusAmount
    const newReputationPoints = user.reputationPoints + bonusAmount

    await prisma.user.update({
      where: { id: userId },
      data: {
        email,
        emailVerified: true,
        pointsAwardedForEmail: true,
        bonusPoints: newBonusPoints,
        reputationPoints: newReputationPoints,
      },
    })

    // Create points transaction
    await prisma.pointsTransaction.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        amount: bonusAmount,
        pointsBefore: user.reputationPoints,
        pointsAfter: newReputationPoints,
        reason: 'email_verification',
        metadata: JSON.stringify({ email }),
      },
    })

    logger.info(`Awarded email bonus to user ${userId}`, {
      userId,
      bonusAmount,
    }, 'WaitlistService')

    return true
  }

  /**
   * Award bonus points for wallet connection
   */
  static async awardWalletBonus(userId: string, walletAddress: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        pointsAwardedForWallet: true,
        reputationPoints: true,
        bonusPoints: true,
      },
    })

    if (!user) {
      return false
    }

    // Don't award if already awarded
    if (user.pointsAwardedForWallet) {
      return false
    }

    const bonusAmount = 25
    const newBonusPoints = user.bonusPoints + bonusAmount
    const newReputationPoints = user.reputationPoints + bonusAmount

    await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress,
        pointsAwardedForWallet: true,
        bonusPoints: newBonusPoints,
        reputationPoints: newReputationPoints,
      },
    })

    // Create points transaction
    await prisma.pointsTransaction.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        amount: bonusAmount,
        pointsBefore: user.reputationPoints,
        pointsAfter: newReputationPoints,
        reason: 'wallet_connect',
        metadata: JSON.stringify({ walletAddress }),
      },
    })

    logger.info(`Awarded wallet bonus to user ${userId}`, {
      userId,
      bonusAmount,
    }, 'WaitlistService')

    return true
  }

  /**
   * Get total waitlist count
   */
  static async getTotalWaitlistCount(): Promise<number> {
    return await prisma.user.count({
      where: {
        waitlistPosition: { not: null },
        isWaitlistActive: true,
      },
    })
  }

  /**
   * Get top waitlist users (leaderboard)
   * Sorted by invite points (most invites = best position)
   */
  static async getTopWaitlistUsers(limit: number = 10) {
    const users = await prisma.user.findMany({
      where: { isWaitlistActive: true },
      orderBy: [
        { invitePoints: 'desc' },       // Primary: Most invite points
        { waitlistJoinedAt: 'asc' },    // Tie-breaker: Earlier signup
      ],
      take: limit,
      select: {
        id: true,
        username: true,
        displayName: true,
        profileImageUrl: true,
        invitePoints: true,
        reputationPoints: true,
        referralCount: true,
        waitlistJoinedAt: true,
      },
    })

    return users.map((user, index) => ({
      ...user,
      rank: index + 1,
    }))
  }
}

