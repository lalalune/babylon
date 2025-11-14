/**
 * Earned Points Service
 * Converts P&L from trading into earned points
 */

import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'

export class EarnedPointsService {
  /**
   * Convert P&L to earned points
   * Formula: 1 point per $10 of realized P&L
   * Minimum: -100 points (can't go below -100)
   * This encourages trading but limits downside risk
   */
  static pnlToPoints(pnl: number): number {
    const points = Math.floor(pnl / 10)
    // Cap negative points at -100 to avoid extreme penalties
    return Math.max(points, -100)
  }

  /**
   * Update earned points based on current lifetime P&L
   * This recalculates earned points from scratch based on lifetimePnL
   */
  static async syncEarnedPointsFromPnL(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        lifetimePnL: true,
        earnedPoints: true,
        invitePoints: true,
        bonusPoints: true,
        reputationPoints: true,
      },
    })

    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    const lifetimePnL = Number(user.lifetimePnL)
    const newEarnedPoints = this.pnlToPoints(lifetimePnL)

    // Only update if earned points have changed
    if (newEarnedPoints === user.earnedPoints) {
      return
    }

    // Calculate new total reputation points
    // Total = Invite Points + Earned Points + Bonus Points + Base (100)
    const basePoints = 100
    const newReputationPoints = basePoints + user.invitePoints + newEarnedPoints + user.bonusPoints

    await prisma.user.update({
      where: { id: userId },
      data: {
        earnedPoints: newEarnedPoints,
        reputationPoints: newReputationPoints,
      },
    })

    logger.info('Updated earned points from P&L', {
      userId,
      lifetimePnL,
      earnedPoints: newEarnedPoints,
      totalPoints: newReputationPoints,
    }, 'EarnedPointsService')
  }

  /**
   * Award earned points for a specific P&L amount (for incremental updates)
   * Use this when recording a trade's P&L
   */
  static async awardEarnedPointsForPnL(
    userId: string,
    previousLifetimePnL: number,
    newLifetimePnL: number,
    tradeType: string,
    relatedId?: string
  ): Promise<number> {
    const previousPoints = this.pnlToPoints(previousLifetimePnL)
    const computedEarnedPoints = this.pnlToPoints(newLifetimePnL)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        earnedPoints: true,
        invitePoints: true,
        bonusPoints: true,
        reputationPoints: true,
      },
    })

    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    const currentEarnedPoints = user.earnedPoints
    const earnedPointsDelta = computedEarnedPoints - currentEarnedPoints

    // Detect sync issues - fail fast if earned points don't match computed value
    if (previousPoints !== currentEarnedPoints && earnedPointsDelta !== 0) {
      throw new Error(
        `Earned points out of sync! Previous P&L $${previousLifetimePnL} should give ${previousPoints} points, but user has ${currentEarnedPoints} earned points`
      )
    }

    if (earnedPointsDelta === 0) {
      return 0
    }

    const newEarnedPoints = computedEarnedPoints
    const basePoints = 100
    const newReputationPoints = basePoints + user.invitePoints + newEarnedPoints + user.bonusPoints

    // Update user and create transaction
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          earnedPoints: newEarnedPoints,
          reputationPoints: newReputationPoints,
        },
      })

      await tx.pointsTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          userId,
          amount: earnedPointsDelta,
          pointsBefore: user.reputationPoints,
          pointsAfter: newReputationPoints,
          reason: 'trading_pnl',
          metadata: JSON.stringify({
            tradeType,
            relatedId,
            pnl: newLifetimePnL - previousLifetimePnL,
            previousLifetimePnL,
            newLifetimePnL,
            previousPointsFromPnL: previousPoints,
            previousEarnedPoints: currentEarnedPoints,
            newEarnedPoints,
            earnedPointsDelta,
          }),
        },
      })
    })

    logger.info('Awarded earned points for P&L', {
      userId,
      previousLifetimePnL,
      newLifetimePnL,
      earnedPointsDelta,
      totalEarnedPoints: newEarnedPoints,
      totalReputationPoints: newReputationPoints,
    }, 'EarnedPointsService')

    return earnedPointsDelta
  }

  /**
   * Bulk sync earned points for all users
   * Useful for migration or recalculation
   * Note: Individual user errors are caught to allow continuation
   */
  static async bulkSyncAllUsers(): Promise<{ success: number; errors: number }> {
    const users = await prisma.user.findMany({
      where: { isActor: false },
      select: { id: true },
    })

    logger.info(`Syncing earned points for ${users.length} users`, {}, 'EarnedPointsService')

    let successCount = 0
    const errorCount = 0

    for (const user of users) {
      await this.syncEarnedPointsFromPnL(user.id)
      successCount++
    }

    logger.info(`Bulk sync complete`, {
      total: users.length,
      success: successCount,
      errors: errorCount,
    }, 'EarnedPointsService')

    return { success: successCount, errors: errorCount }
  }
}

