/**
 * Reputation Calculation Service
 *
 * Aggregates performance metrics and feedback to calculate composite reputation scores.
 * Integrates PNL normalization, game scores, and user feedback into reputation.
 */

import { prisma } from '@/lib/prisma'
import {
  normalizePnL,
  calculateWinRate,
  getTrustLevel,
  calculateConfidenceScore,
} from './pnl-normalizer'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'

export interface ReputationScoreBreakdown {
  reputationScore: number
  trustLevel: string
  confidenceScore: number
  breakdown: {
    pnlComponent: number
    feedbackComponent: number
    activityComponent: number
  }
  metrics: {
    normalizedPnL: number
    averageFeedbackScore: number
    gamesPlayed: number
    totalFeedbackCount: number
    winRate: number
  }
}

/**
 * Game performance metrics for auto-feedback generation
 */
export interface GameMetrics {
  won: boolean
  pnl: number
  positionsClosed: number
  finalBalance: number
  startingBalance: number
  decisionsCorrect: number
  decisionsTotal: number
  timeToComplete?: number
  riskManagement?: number
}

/**
 * Trade performance metrics for auto-feedback generation
 */
export interface TradeMetrics {
  profitable: boolean
  roi: number
  holdingPeriod: number
  timingScore: number
  riskScore: number
}

/**
 * Calculate composite reputation score for a user/agent
 *
 * Weighted composite formula:
 * Reputation = (PNL * 0.4) + (Feedback * 0.4) + (Activity * 0.2)
 *
 * Components:
 * - PNL (40%): Normalized profit/loss performance (0-100)
 * - Feedback (40%): Average feedback score from others (0-100)
 * - Activity (20%): Games/interactions played (0-100, capped at 50 games)
 *
 * @param normalizedPnL - PNL normalized to 0-1 scale
 * @param averageFeedbackScore - Average feedback score (0-100)
 * @param gamesPlayed - Number of games played
 * @returns Composite reputation score (0-100)
 */
export function calculateReputationScore(
  normalizedPnL: number,
  averageFeedbackScore: number,
  gamesPlayed: number
): number {
  // Weight distribution
  const pnlWeight = 0.4
  const feedbackWeight = 0.4
  const activityWeight = 0.2

  // Convert normalized PNL (0-1) to 0-100 scale
  const pnlComponent = normalizedPnL * 100

  // Feedback is already on 0-100 scale
  const feedbackComponent = averageFeedbackScore

  // Activity bonus: linear scaling, caps at 50 games = 100 points
  // 0 games = 0 points, 25 games = 50 points, 50+ games = 100 points
  const activityComponent = Math.min(100, gamesPlayed * 2)

  // Weighted sum
  const score =
    pnlComponent * pnlWeight + feedbackComponent * feedbackWeight + activityComponent * activityWeight

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, score))
}

/**
 * Update agent performance metrics based on completed game
 *
 * @param userId - User/agent ID
 * @param gameScore - Game performance score (0-100)
 * @param won - Whether the game was won
 * @returns Updated metrics
 */
export async function updateGameMetrics(userId: string, gameScore: number, won: boolean) {
  logger.info('Updating game metrics', { userId, gameScore, won }, 'ReputationService')

  // Get or create metrics
  let metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId },
  })

  if (!metrics) {
    metrics = await prisma.agentPerformanceMetrics.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        gamesPlayed: 0,
        gamesWon: 0,
        averageGameScore: 0,
        updatedAt: new Date(),
      },
    })
  }

  // Calculate new average game score
  const totalGames = metrics.gamesPlayed + 1
  const newAverageScore =
    (metrics.averageGameScore * metrics.gamesPlayed + gameScore) / totalGames

  // Update metrics
  const updated = await prisma.agentPerformanceMetrics.update({
    where: { userId },
    data: {
      gamesPlayed: totalGames,
      gamesWon: won ? metrics.gamesWon + 1 : metrics.gamesWon,
      averageGameScore: newAverageScore,
      lastGameScore: gameScore,
      lastGamePlayedAt: new Date(),
      lastActivityAt: new Date(),
      firstActivityAt: metrics.firstActivityAt || new Date(),
    },
  })

  // Recalculate reputation
  await recalculateReputation(userId)

  return updated
}

/**
 * Update trading performance metrics
 *
 * @param userId - User/agent ID
 * @param pnl - Profit/loss from trade
 * @param invested - Amount invested
 * @param profitable - Whether trade was profitable
 */
export async function updateTradingMetrics(
  userId: string,
  pnl: number,
  invested: number,
  profitable: boolean
) {
  logger.info('Updating trading metrics', { userId, pnl, invested, profitable }, 'ReputationService')

  // Get user's lifetime PNL and total deposits
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lifetimePnL: true, totalDeposited: true },
  })

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  // Normalize PNL based on total deposits
  const totalInvested = user.totalDeposited.toNumber()
  const lifetimePnLNum = user.lifetimePnL.toNumber()
  const normalized = normalizePnL(lifetimePnLNum, totalInvested)

  // Get or create metrics
  let metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId },
  })

  if (!metrics) {
    metrics = await prisma.agentPerformanceMetrics.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        normalizedPnL: normalized,
        totalTrades: 0,
        profitableTrades: 0,
        updatedAt: new Date(),
      },
    })
  }

  // Update trade counts
  const newTotalTrades = metrics.totalTrades + 1
  const newProfitableTrades = profitable ? metrics.profitableTrades + 1 : metrics.profitableTrades

  // Calculate win rate
  const winRate = calculateWinRate(newProfitableTrades, newTotalTrades)

  // Calculate average ROI (simplified - would need full trade history for accuracy)
  const avgROI = lifetimePnLNum / totalInvested

  // Update metrics
  const updated = await prisma.agentPerformanceMetrics.update({
    where: { userId },
    data: {
      normalizedPnL: normalized,
      totalTrades: newTotalTrades,
      profitableTrades: newProfitableTrades,
      winRate,
      averageROI: avgROI,
      lastActivityAt: new Date(),
      firstActivityAt: metrics.firstActivityAt || new Date(),
    },
  })

  // Recalculate reputation
  await recalculateReputation(userId)

  return updated
}

/**
 * Update feedback metrics when new feedback is submitted
 *
 * @param userId - User/agent receiving feedback
 * @param score - Feedback score (0-100)
 */
export async function updateFeedbackMetrics(userId: string, score: number) {
  logger.info('Updating feedback metrics', { userId, score }, 'ReputationService')

  // Get or create metrics
  let metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId },
  })

  if (!metrics) {
    metrics = await prisma.agentPerformanceMetrics.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        totalFeedbackCount: 0,
        averageFeedbackScore: 50, // Start at neutral
        updatedAt: new Date(),
      },
    })
  }

  // Calculate new average
  const newCount = metrics.totalFeedbackCount + 1
  const newAverage = (metrics.averageFeedbackScore * metrics.totalFeedbackCount + score) / newCount

  // Classify feedback
  const isPositive = score >= 70
  const isNeutral = score >= 40 && score < 70
  const isNegative = score < 40

  // Update metrics
  const updated = await prisma.agentPerformanceMetrics.update({
    where: { userId },
    data: {
      totalFeedbackCount: newCount,
      averageFeedbackScore: newAverage,
      positiveCount: isPositive ? metrics.positiveCount + 1 : metrics.positiveCount,
      neutralCount: isNeutral ? metrics.neutralCount + 1 : metrics.neutralCount,
      negativeCount: isNegative ? metrics.negativeCount + 1 : metrics.negativeCount,
      totalInteractions: metrics.totalInteractions + 1,
      lastActivityAt: new Date(),
      firstActivityAt: metrics.firstActivityAt || new Date(),
    },
  })

  // Recalculate reputation
  await recalculateReputation(userId)

  return updated
}

/**
 * Recalculate composite reputation score for a user
 *
 * @param userId - User/agent ID
 * @returns Updated metrics with new reputation score
 */
export async function recalculateReputation(userId: string) {
  const metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId },
  })

  if (!metrics) {
    return null
  }

  // Calculate composite reputation
  const reputationScore = calculateReputationScore(
    metrics.normalizedPnL,
    metrics.averageFeedbackScore,
    metrics.gamesPlayed
  )

  // Determine trust level
  const trustLevel = getTrustLevel(reputationScore)

  // Calculate confidence based on sample size (games + feedback)
  const sampleSize = metrics.gamesPlayed + metrics.totalFeedbackCount
  const confidenceScore = calculateConfidenceScore(sampleSize)

  // Update metrics
  const updated = await prisma.agentPerformanceMetrics.update({
    where: { userId },
    data: {
      reputationScore,
      trustLevel,
      confidenceScore,
    },
  })

  logger.info(
    'Recalculated reputation',
    { userId, reputationScore, trustLevel, confidenceScore },
    'ReputationService'
  )

  return updated
}

/**
 * Get detailed reputation breakdown for a user
 *
 * @param userId - User/agent ID
 * @returns Reputation score with component breakdown
 */
export async function getReputationBreakdown(userId: string): Promise<ReputationScoreBreakdown | null> {
  const metrics = await prisma.agentPerformanceMetrics.findUnique({
    where: { userId },
  })

  if (!metrics) {
    return null
  }

  // Calculate components
  const pnlComponent = metrics.normalizedPnL * 100
  const feedbackComponent = metrics.averageFeedbackScore
  const activityComponent = Math.min(100, metrics.gamesPlayed * 2)

  return {
    reputationScore: metrics.reputationScore,
    trustLevel: metrics.trustLevel,
    confidenceScore: metrics.confidenceScore,
    breakdown: {
      pnlComponent,
      feedbackComponent,
      activityComponent,
    },
    metrics: {
      normalizedPnL: metrics.normalizedPnL,
      averageFeedbackScore: metrics.averageFeedbackScore,
      gamesPlayed: metrics.gamesPlayed,
      totalFeedbackCount: metrics.totalFeedbackCount,
      winRate: metrics.winRate,
    },
  }
}

/**
 * Get leaderboard of top-rated agents
 *
 * @param limit - Number of agents to return
 * @param minGames - Minimum games played to qualify
 * @returns Array of agents sorted by reputation score
 */
export async function getReputationLeaderboard(limit = 100, minGames = 5) {
  const topAgents = await prisma.agentPerformanceMetrics.findMany({
    where: {
      gamesPlayed: {
        gte: minGames,
      },
    },
    orderBy: {
      reputationScore: 'desc',
    },
    take: limit,
    include: {
      User: {
        select: {
          id: true,
          username: true,
          displayName: true,
          profileImageUrl: true,
          isActor: true,
        },
      },
    },
  })

  return topAgents.map((agent, index) => ({
    rank: index + 1,
    userId: agent.userId,
    username: agent.User.username,
    displayName: agent.User.displayName,
    profileImageUrl: agent.User.profileImageUrl,
    isActor: agent.User.isActor,
    reputationScore: agent.reputationScore,
    trustLevel: agent.trustLevel,
    confidenceScore: agent.confidenceScore,
    gamesPlayed: agent.gamesPlayed,
    winRate: agent.winRate,
    normalizedPnL: agent.normalizedPnL,
  }))
}

// ============================================================================
// AUTO-FEEDBACK GENERATION FUNCTIONS
// ============================================================================

/**
 * Calculate feedback score from game performance metrics
 *
 * Score components (0-100):
 * - PNL performance: 40% (normalized return on starting balance)
 * - Decision quality: 30% (correct decisions / total decisions)
 * - Risk management: 20% (positions managed effectively)
 * - Game outcome: 10% (win/loss bonus)
 *
 * @param metrics - Game performance metrics
 * @returns Feedback score (0-100)
 */
export function calculateGameScore(metrics: GameMetrics): number {
  // PNL component (40%)
  const normalizedRoi = normalizePnL(metrics.pnl, metrics.startingBalance)
  const pnlScore = normalizedRoi * 100 * 0.4

  // Decision quality component (30%)
  const decisionAccuracy = metrics.decisionsTotal > 0
    ? metrics.decisionsCorrect / metrics.decisionsTotal
    : 0.5
  const decisionScore = decisionAccuracy * 100 * 0.3

  // Risk management component (20%)
  const riskScore = (metrics.riskManagement ?? 0.5) * 100 * 0.2

  // Game outcome bonus (10%)
  const outcomeBonus = metrics.won ? 10 : 0

  // Composite score
  const totalScore = pnlScore + decisionScore + riskScore + outcomeBonus

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, totalScore))
}

/**
 * Calculate feedback score from trade performance metrics
 *
 * Score components (0-100):
 * - ROI: 50% (return on investment)
 * - Timing: 25% (entry/exit timing quality)
 * - Risk management: 25% (position sizing, stop losses)
 *
 * @param metrics - Trade performance metrics
 * @returns Feedback score (0-100)
 */
export function calculateTradeScore(metrics: TradeMetrics): number {
  // ROI component (50%) - normalize ROI to 0-1 scale
  // Assume -50% to +100% ROI range maps to 0-100 score
  const normalizedRoi = Math.max(0, Math.min(1, (metrics.roi + 0.5) / 1.5))
  const roiScore = normalizedRoi * 100 * 0.5

  // Timing component (25%)
  const timingScore = metrics.timingScore * 100 * 0.25

  // Risk management component (25%)
  const riskScore = metrics.riskScore * 100 * 0.25

  // Composite score
  const totalScore = roiScore + timingScore + riskScore

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, totalScore))
}

/**
 * Generate automatic feedback when agent completes a game
 *
 * Creates feedback record and updates agent metrics atomically.
 *
 * @param agentId - Agent user ID
 * @param gameId - Game identifier
 * @param performanceMetrics - Game performance data
 * @returns Created feedback record
 */
export async function generateGameCompletionFeedback(
  agentId: string,
  gameId: string,
  performanceMetrics: GameMetrics
) {
  logger.info('Generating game completion feedback', { agentId, gameId }, 'AutoFeedback')

  // Calculate feedback score from performance
  const score = calculateGameScore(performanceMetrics)

  // Determine comment based on performance
  let comment = ''
  if (score >= 80) {
    comment = 'Excellent game performance! Strong decision-making and risk management.'
  } else if (score >= 60) {
    comment = 'Good game performance with solid fundamentals.'
  } else if (score >= 40) {
    comment = 'Moderate performance. Room for improvement in decision-making.'
  } else {
    comment = 'Challenging game. Focus on improving risk management and decision quality.'
  }

  // Create feedback record
  const feedback = await prisma.feedback.create({
    data: {
      id: await generateSnowflakeId(),
      toUserId: agentId,
      score,
      comment,
      category: 'game_performance',
      interactionType: 'game_to_agent',
      metadata: {
        gameId,
        won: performanceMetrics.won,
        pnl: performanceMetrics.pnl,
        decisionsCorrect: performanceMetrics.decisionsCorrect,
        decisionsTotal: performanceMetrics.decisionsTotal,
        autoGenerated: true,
        timestamp: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  })

  // Update game metrics (this will trigger reputation recalculation)
  await updateGameMetrics(agentId, score, performanceMetrics.won)

  logger.info('Generated game feedback', { feedbackId: feedback.id, score }, 'AutoFeedback')

  return feedback
}

/**
 * Generate automatic feedback for trade execution
 *
 * @param agentId - Agent user ID
 * @param tradeId - Trade identifier
 * @param performanceMetrics - Trade performance data
 * @returns Created feedback record
 */
export async function CompletionFormat(
  agentId: string,
  tradeId: string,
  performanceMetrics: TradeMetrics
) {
  logger.info('Generating trade completion feedback', { agentId, tradeId }, 'AutoFeedback')

  // Calculate feedback score from trade performance
  const score = calculateTradeScore(performanceMetrics)

  // Determine comment
  let comment = ''
  if (score >= 80) {
    comment = 'Excellent trade execution with strong timing and risk management.'
  } else if (score >= 60) {
    comment = 'Good trade performance with solid fundamentals.'
  } else if (score >= 40) {
    comment = 'Moderate trade performance. Consider improving entry/exit timing.'
  } else {
    comment = 'Challenging trade. Focus on risk management and timing.'
  }

  // Create feedback record
  const feedback = await prisma.feedback.create({
    data: {
      id: await generateSnowflakeId(),
      toUserId: agentId,
      score,
      comment,
      category: 'trade_performance',
      interactionType: 'game_to_agent',
      metadata: {
        tradeId,
        profitable: performanceMetrics.profitable,
        roi: performanceMetrics.roi,
        holdingPeriod: performanceMetrics.holdingPeriod,
        autoGenerated: true,
        timestamp: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  })

  // Update feedback metrics
  await updateFeedbackMetrics(agentId, score)

  logger.info('Generated trade feedback', { feedbackId: feedback.id, score }, 'AutoFeedback')

  return feedback
}

/**
 * Generate batch feedback for multiple completed games
 *
 * Useful for processing game completions in bulk or during sync operations.
 *
 * @param completions - Array of game completion data
 * @returns Array of created feedback records
 */
export async function generateBatchGameFeedback(
  completions: Array<{
    agentId: string
    gameId: string
    metrics: GameMetrics
  }>
) {
  logger.info('Generating batch game feedback', { count: completions.length }, 'AutoFeedback')

  // Use batching to prevent connection pool exhaustion
  const { batchExecuteWithResults } = await import('@/lib/batch-operations')
  
  const results = await batchExecuteWithResults(
    completions,
    10, // Process 10 at a time
    (completion) => generateGameCompletionFeedback(completion.agentId, completion.gameId, completion.metrics)
  )

  const successful = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  logger.info('Batch feedback generation complete', { successful, failed }, 'AutoFeedback')

  return results
    .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof generateGameCompletionFeedback>>> =>
      r.status === 'fulfilled'
    )
    .map((r) => r.value)
}
