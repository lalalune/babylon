/**
 * Agent0 Reputation Cache Service
 * 
 * Caches ERC-8004/Agent0 reputation scores with 24-hour staleness check.
 * Recalculates reputation when cache is stale.
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
// Note: Agent0 client import will be used when implementing Agent0 reputation fetch
import { recalculateReputation } from './reputation-service'

const CACHE_STALE_HOURS = 24
const CACHE_STALE_MS = CACHE_STALE_HOURS * 60 * 60 * 1000

// Removed unused interface

/**
 * Get cached reputation score for a user/agent
 * Returns cached value if fresh, otherwise recalculates
 */
export async function getCachedAgent0ReputationScore(
  userId: string
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      agent0TokenId: true,
      isBanned: true,
      isScammer: true,
      isCSAM: true,
      earnedPoints: true,
      reputationPoints: true,
      AgentPerformanceMetrics: {
        select: {
          reputationScore: true,
          lastActivityAt: true,
          updatedAt: true,
        },
      },
    },
  })

  if (!user) {
    logger.warn('User not found for reputation cache', { userId }, 'Agent0ReputationCache')
    return 50 // Neutral default
  }

  // If banned, return 0
  if (user.isBanned) {
    return 0
  }

  // If scammer or CSAM, return very low score (but not 0, to distinguish from banned)
  if (user.isScammer || user.isCSAM) {
    return 5 // Very low but not zero
  }

  // Check if we have cached data
  const metrics = user.AgentPerformanceMetrics
  if (metrics) {
    const cacheAge = Date.now() - metrics.updatedAt.getTime()
    
    // If cache is fresh (< 24 hours), return cached score
    if (cacheAge < CACHE_STALE_MS) {
      logger.debug('Using cached reputation score', {
        userId,
        score: metrics.reputationScore,
        cacheAgeHours: cacheAge / (60 * 60 * 1000),
      }, 'Agent0ReputationCache')
      return metrics.reputationScore
    }
  }

  // Cache is stale or missing, recalculate
  logger.info('Recalculating stale reputation score', {
    userId,
    agent0TokenId: user.agent0TokenId,
    hasMetrics: !!metrics,
  }, 'Agent0ReputationCache')

  // Recalculate local reputation
  await recalculateReputation(userId)

  // Note: Agent0 network reputation aggregation is handled by:
  // - Agent0FeedbackService.getAgentReputation() - Fetches on-chain reputation
  // - ReputationBridge.getReputation() - Aggregates on-chain + local reputation
  // For now, we use local reputation calculation which is sufficient for most use cases
  if (user.agent0TokenId) {
    logger.debug('Agent0 token ID found, using local reputation calculation', {
      userId,
      agent0TokenId: user.agent0TokenId,
    }, 'Agent0ReputationCache')
    // To fetch on-chain Agent0 reputation, use ReputationBridge or Agent0FeedbackService
  }

  // Return local reputation if Agent0 fetch failed or no token ID
  const updatedMetrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId },
    select: { reputationScore: true },
  })

  return updatedMetrics?.reputationScore ?? 50 // Neutral default
}

/**
 * Invalidate reputation cache for a user
 * Forces recalculation on next access
 */
export async function invalidateReputationCache(userId: string): Promise<void> {
  await prisma.agentPerformanceMetrics.updateMany({
    where: { userId },
    data: {
      updatedAt: new Date(Date.now() - CACHE_STALE_MS - 1), // Make it stale
    },
  })

  logger.info('Invalidated reputation cache', { userId }, 'Agent0ReputationCache')
}

/**
 * Check if user has sent more points than earned (reputation loss condition)
 */
export async function checkOverspending(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      earnedPoints: true,
      reputationPoints: true,
      invitePoints: true,
      bonusPoints: true,
      PointsTransaction: {
        where: {
          reason: 'transfer_sent',
        },
        select: {
          amount: true,
        },
      },
    },
  })

  if (!user) {
    return false
  }

  // Calculate total points sent (negative amounts)
  const totalSent = Math.abs(
    user.PointsTransaction.reduce((sum, tx) => sum + Math.min(0, tx.amount), 0)
  )

  // Total earned = earnedPoints + invitePoints + bonusPoints
  const totalEarned = user.earnedPoints + user.invitePoints + user.bonusPoints

  // If sent more than earned, they're overspending
  return totalSent > totalEarned
}

/**
 * Calculate reputation score based on activity and behavior
 * 
 * Rules:
 * - Neutral (50) for inactivity
 * - Loss for overspending (sending more than earned)
 * - 0 for bans
 * - Very low (5) for scammers/CSAM
 */
export async function calculateAgent0ReputationScore(
  userId: string
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isBanned: true,
      isScammer: true,
      isCSAM: true,
      earnedPoints: true,
      AgentPerformanceMetrics: {
        select: {
          gamesPlayed: true,
          totalFeedbackCount: true,
          averageFeedbackScore: true,
          normalizedPnL: true,
          lastActivityAt: true,
        },
      },
    },
  })

  if (!user) {
    return 50 // Neutral default
  }

  // Banned users get 0
  if (user.isBanned) {
    return 0
  }

  // Scammers/CSAM get very low score (but not 0)
  if (user.isScammer || user.isCSAM) {
    return 5
  }

  const metrics = user.AgentPerformanceMetrics
  const hasActivity = metrics && (
    metrics.gamesPlayed > 0 ||
    metrics.totalFeedbackCount > 0 ||
    metrics.lastActivityAt !== null
  )

  // No activity = neutral score (50)
  if (!hasActivity) {
    return 50
  }

  // Check for overspending
  const isOverspending = await checkOverspending(userId)
  if (isOverspending) {
    // Reduce reputation based on overspending ratio
    const overspendingRatio = await calculateOverspendingRatio(userId)
    // Penalty: reduce score by up to 30 points based on overspending
    const penalty = Math.min(30, overspendingRatio * 30)
    const baseScore = metrics?.averageFeedbackScore ?? 50
    return Math.max(0, baseScore - penalty)
  }

  // Use standard reputation calculation
  return await recalculateReputation(userId).then(m => m?.reputationScore ?? 50)
}

/**
 * Calculate overspending ratio (0-1)
 */
async function calculateOverspendingRatio(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      earnedPoints: true,
      invitePoints: true,
      bonusPoints: true,
      PointsTransaction: {
        where: {
          reason: 'transfer_sent',
        },
        select: {
          amount: true,
        },
      },
    },
  })

  if (!user) {
    return 0
  }

  const totalSent = Math.abs(
    user.PointsTransaction.reduce((sum, tx) => sum + Math.min(0, tx.amount), 0)
  )
  const totalEarned = user.earnedPoints + user.invitePoints + user.bonusPoints

  if (totalEarned === 0) {
    return totalSent > 0 ? 1 : 0 // If they sent anything without earning, ratio is 1
  }

  return Math.min(1, totalSent / totalEarned)
}

