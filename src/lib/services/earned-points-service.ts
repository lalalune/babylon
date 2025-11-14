/**
 * Earned Points Service
 * Converts P&L from trading into earned points
 */

import { prisma } from '@/lib/database-service'
import { logger } from '@/lib/logger'

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
    try {
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
        throw new Error('User not found')
      }

      const lifetimePnL = Number(user.lifetimePnL)
      const newEarnedPoints = this.pnlToPoints(lifetimePnL)

      // Only update if earned points have changed
      if (newEarnedPoints !== user.earnedPoints) {
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
    } catch (error) {
      logger.error('Error syncing earned points from P&L', error, 'EarnedPointsService')
      throw error
    }
  }

  /**
   * Award earned points for a specific P&L amount (for incremental updates)
   * Use this when recording a trade's P&L
   */
  static async awardEarnedPointsForPnL(
    userId: string,
    pnlAmount: number,
    tradeType: string,
    relatedId?: string
  ): Promise<void> {
    try {
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
        throw new Error('User not found')
      }

      // Calculate points for this P&L
      const pointsFromThisTrade = this.pnlToPoints(pnlAmount)

      // Skip if no points change
      if (pointsFromThisTrade === 0) {
        return
      }

      const newEarnedPoints = user.earnedPoints + pointsFromThisTrade
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
            userId,
            amount: pointsFromThisTrade,
            pointsBefore: user.reputationPoints,
            pointsAfter: newReputationPoints,
            reason: 'trading_pnl',
            metadata: JSON.stringify({
              pnlAmount,
              tradeType,
              relatedId,
              pointsFromTrade: pointsFromThisTrade,
            }),
          },
        })
      })

      logger.info('Awarded earned points for P&L', {
        userId,
        pnlAmount,
        pointsFromTrade: pointsFromThisTrade,
        totalEarnedPoints: newEarnedPoints,
        totalReputationPoints: newReputationPoints,
      }, 'EarnedPointsService')
    } catch (error) {
      logger.error('Error awarding earned points for P&L', error, 'EarnedPointsService')
      throw error
    }
  }

  /**
   * Bulk sync earned points for all users
   * Useful for migration or recalculation
   */
  static async bulkSyncAllUsers(): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        where: { isActor: false },
        select: { id: true },
      })

      logger.info(`Syncing earned points for ${users.length} users`, {}, 'EarnedPointsService')

      let successCount = 0
      let errorCount = 0

      for (const user of users) {
        try {
          await this.syncEarnedPointsFromPnL(user.id)
          successCount++
        } catch (error) {
          errorCount++
          logger.error(`Error syncing user ${user.id}`, error, 'EarnedPointsService')
        }
      }

      logger.info(`Bulk sync complete`, {
        total: users.length,
        success: successCount,
        errors: errorCount,
      }, 'EarnedPointsService')
    } catch (error) {
      logger.error('Error in bulk sync', error, 'EarnedPointsService')
      throw error
    }
  }
}

