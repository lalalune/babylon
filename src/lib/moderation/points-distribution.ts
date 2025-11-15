/**
 * Points Distribution Service
 * 
 * Distributes forfeited account points to successful reporters when
 * CSAM/scammer is confirmed.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import { PointsService } from '@/lib/services/points-service'

/**
 * Distribute forfeited points to successful reporters
 * 
 * When a user is confirmed as CSAM/scammer, distribute their points
 * proportionally to all users who successfully reported them.
 */
export async function distributePointsToReporters(
  reportedUserId: string,
  reason: 'scammer' | 'csam'
): Promise<void> {
  logger.info('Distributing points to successful reporters', {
    reportedUserId,
    reason,
  }, 'PointsDistribution')

  // Get the reported user's point balance
  const reportedUser = await prisma.user.findUnique({
    where: { id: reportedUserId },
    select: {
      id: true,
      reputationPoints: true,
      earnedPoints: true,
      invitePoints: true,
      bonusPoints: true,
    },
  })

  if (!reportedUser) {
    logger.warn('Reported user not found', { reportedUserId }, 'PointsDistribution')
    return
  }

  // Calculate forfeited points (all points except earned points)
  // We only forfeit bonus/invite points, not earned points
  const forfeitedPoints = reportedUser.invitePoints + reportedUser.bonusPoints

  if (forfeitedPoints <= 0) {
    logger.info('No points to distribute', { reportedUserId, forfeitedPoints }, 'PointsDistribution')
    return
  }

  // Find all successful reports for this user
  // Successful = reports that led to this ban (CSAM/scammer)
  const successfulReports = await prisma.report.findMany({
    where: {
      reportedUserId,
      status: 'resolved',
      category: reason === 'scammer' ? 'spam' : 'inappropriate', // Map to report categories
      createdAt: {
        // Only consider reports from last 90 days
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    },
    select: {
      id: true,
      reporterId: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc', // Earlier reports get priority
    },
  })

  if (successfulReports.length === 0) {
    logger.info('No successful reports found', { reportedUserId }, 'PointsDistribution')
    // Still forfeit the points (remove them from the user)
    await forfeitUserPoints(reportedUserId, forfeitedPoints)
    return
  }

  // Distribute points proportionally
  // Each reporter gets an equal share
  const pointsPerReporter = Math.floor(forfeitedPoints / successfulReports.length)
  const remainder = forfeitedPoints % successfulReports.length

  logger.info('Distributing points', {
    reportedUserId,
    forfeitedPoints,
    successfulReportsCount: successfulReports.length,
    pointsPerReporter,
    remainder,
  }, 'PointsDistribution')

  // Distribute points to each reporter
  const distributionResults = await Promise.allSettled(
    successfulReports.map(async (report, index) => {
      // First reporter gets the remainder if any
      const pointsToAward = pointsPerReporter + (index === 0 ? remainder : 0)

      if (pointsToAward <= 0) {
        return
      }

      await PointsService.awardPoints(
        report.reporterId,
        pointsToAward,
        'report_reward',
        {
          reportedUserId,
          reportId: report.id,
          reason,
          forfeitedPoints: pointsToAward,
        }
      )

      logger.info('Awarded points to reporter', {
        reporterId: report.reporterId,
        points: pointsToAward,
        reportId: report.id,
      }, 'PointsDistribution')
    })
  )

  // Log any failures
  const failures = distributionResults.filter(r => r.status === 'rejected')
  if (failures.length > 0) {
    logger.error('Failed to distribute points to some reporters', {
      reportedUserId,
      failures: failures.length,
      total: distributionResults.length,
    }, 'PointsDistribution')
  }

  // Forfeit the points from the reported user
  await forfeitUserPoints(reportedUserId, forfeitedPoints)

  logger.info('✅ Points distribution complete', {
    reportedUserId,
    forfeitedPoints,
    reportersRewarded: successfulReports.length,
    totalDistributed: forfeitedPoints,
  }, 'PointsDistribution')
}

/**
 * Forfeit points from a user (remove bonus/invite points)
 */
async function forfeitUserPoints(userId: string, amount: number): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      reputationPoints: true,
      invitePoints: true,
      bonusPoints: true,
    },
  })

  if (!user) {
    return
  }

  // Calculate how much to remove from each category
  const totalForfeitable = user.invitePoints + user.bonusPoints
  if (totalForfeitable === 0) {
    return
  }

  // Remove proportionally from invite and bonus points
  // Avoid division by zero
  const inviteRatio = totalForfeitable > 0 ? user.invitePoints / totalForfeitable : 0
  const bonusRatio = totalForfeitable > 0 ? user.bonusPoints / totalForfeitable : 0

  const inviteToRemove = Math.floor(amount * inviteRatio)
  const bonusToRemove = Math.floor(amount * bonusRatio)

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      invitePoints: Math.max(0, user.invitePoints - inviteToRemove),
      bonusPoints: Math.max(0, user.bonusPoints - bonusToRemove),
      reputationPoints: Math.max(0, user.reputationPoints - amount),
    },
  })

  // Create transaction record
  await prisma.pointsTransaction.create({
    data: {
      id: await generateSnowflakeId(),
      userId,
      amount: -amount,
      pointsBefore: user.reputationPoints,
      pointsAfter: user.reputationPoints - amount,
      reason: 'forfeited',
      metadata: JSON.stringify({
        reason: 'csam_or_scammer_confirmed',
        forfeitedAmount: amount,
      }),
    },
  })

  logger.info('Forfeited points from user', {
    userId,
    amount,
    inviteRemoved: inviteToRemove,
    bonusRemoved: bonusToRemove,
  }, 'PointsDistribution')
}

/**
 * Check if a user should have points distributed (CSAM/scammer confirmed)
 */
export async function shouldDistributePoints(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isBanned: true,
      isScammer: true,
      isCSAM: true,
      invitePoints: true,
      bonusPoints: true,
    },
  })

  if (!user) {
    return false
  }

  // Only distribute if user is banned AND marked as scammer or CSAM
  return user.isBanned && (user.isScammer || user.isCSAM)
}

