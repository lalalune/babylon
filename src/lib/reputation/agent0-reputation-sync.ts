/**
 * Agent0 Reputation Synchronization Service
 *
 * Integrates local reputation system with Agent0 network's on-chain reputation (ERC-8004).
 * Provides bidirectional sync between local database and blockchain.
 */

import { prisma } from '@/lib/database-service'
import { getOnChainReputation, syncOnChainReputation } from './blockchain-reputation'
import { getAgent0Client } from '@/agents/agent0/Agent0Client'
import { recalculateReputation, getReputationBreakdown } from './reputation-service'
import { logger } from '@/lib/logger'

/**
 * Sync Agent0 on-chain reputation to local database after registration
 *
 * Called automatically after successful Agent0 registration to initialize
 * local reputation metrics with on-chain data.
 *
 * @param userId - User ID
 * @param agent0TokenId - Agent0 network token ID
 * @returns Updated performance metrics
 */
export async function syncAfterAgent0Registration(userId: string, agent0TokenId: number) {
  try {
    logger.info('Syncing reputation after Agent0 registration', { userId, agent0TokenId })

    // Get on-chain reputation data
    const onChainRep = await getOnChainReputation(agent0TokenId)

    if (!onChainRep) {
      logger.warn('No on-chain reputation data found', { agent0TokenId })
      // Initialize with default metrics
      return await prisma.agentPerformanceMetrics.upsert({
        where: { userId },
        create: {
          userId,
          onChainReputationSync: true,
          lastSyncedAt: new Date(),
        },
        update: {
          onChainReputationSync: true,
          lastSyncedAt: new Date(),
        },
      })
    }

    // Get or create performance metrics
    let metrics = await prisma.agentPerformanceMetrics.findUnique({
      where: { userId },
    })

    if (!metrics) {
      metrics = await prisma.agentPerformanceMetrics.create({
        data: {
          userId,
        },
      })
    }

    // Sync on-chain data to local database
    const updated = await syncOnChainReputation(userId, agent0TokenId)

    // Recalculate local reputation with synced data
    await recalculateReputation(userId)

    logger.info('Agent0 reputation sync completed', {
      userId,
      agent0TokenId,
      trustScore: onChainRep.trustScore.toString(),
      accuracyScore: onChainRep.accuracyScore.toString(),
    })

    return updated
  } catch (error) {
    logger.error('Failed to sync reputation after Agent0 registration', {
      userId,
      agent0TokenId,
      error,
    })
    throw error
  }
}

/**
 * Submit local feedback to Agent0 network
 *
 * When users rate agents locally, optionally propagate feedback to Agent0's
 * on-chain reputation system for network-wide visibility.
 *
 * @param feedbackId - Local feedback record ID
 * @param submitToBlockchain - Whether to also submit to ERC-8004 (requires gas)
 * @returns Agent0 submission result
 */
export async function submitFeedbackToAgent0(feedbackId: string, submitToBlockchain = false) {
  try {
    // Get feedback record with agent info
    const feedback = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      include: {
        toUser: {
          select: {
            id: true,
            agent0TokenId: true,
            nftTokenId: true,
          },
        },
      },
    })

    if (!feedback) {
      throw new Error(`Feedback ${feedbackId} not found`)
    }

    if (!feedback.toUser) {
      throw new Error('Feedback has no recipient user')
    }

    const agent0TokenId = feedback.toUser.agent0TokenId

    if (!agent0TokenId) {
      logger.warn('Agent has no Agent0 token ID, skipping submission', {
        feedbackId,
        userId: feedback.toUser.id,
      })
      return null
    }

    // Get Agent0 client
    const agent0Client = getAgent0Client()

    // Convert 0-100 score to -5 to +5 scale for Agent0
    // 0-100 → -5 to +5 (0 = -5, 50 = 0, 100 = +5)
    const agent0Rating = Math.round((feedback.score / 100) * 10 - 5)

    // Submit to Agent0 network
    await agent0Client.submitFeedback({
      targetAgentId: agent0TokenId,
      rating: agent0Rating,
      comment: feedback.comment || 'Feedback from Babylon platform',
      transactionId: feedback.id,
    })

    // Update feedback record to mark as submitted to Agent0
    await prisma.feedback.update({
      where: { id: feedbackId },
      data: {
        agent0TokenId: agent0TokenId,
        metadata: {
          ...(typeof feedback.metadata === 'object' && feedback.metadata !== null
            ? feedback.metadata
            : {}),
          agent0Submitted: true,
          agent0SubmittedAt: new Date().toISOString(),
        },
      },
    })

    logger.info('Feedback submitted to Agent0', {
      feedbackId,
      agent0TokenId,
      score: feedback.score,
      agent0Rating,
    })

    // If requested, also submit to blockchain (ERC-8004)
    if (submitToBlockchain && feedback.toUser.nftTokenId) {
      logger.info('Submitting feedback to blockchain would require wallet client', {
        feedbackId,
        nftTokenId: feedback.toUser.nftTokenId,
      })
      // Note: Blockchain submission requires wallet client and gas
      // This would be called from a user-facing endpoint with wallet connection
    }

    return {
      agent0TokenId,
      agent0Rating,
      submitted: true,
    }
  } catch (error) {
    logger.error('Failed to submit feedback to Agent0', { feedbackId, error })
    throw error
  }
}

/**
 * Periodic sync of on-chain reputation to local database
 *
 * Should be called periodically (e.g., daily cron job) to keep local
 * reputation metrics in sync with blockchain state.
 *
 * @param userId - Optional user ID to sync (if not provided, syncs all agents)
 * @returns Sync results
 */
export async function periodicReputationSync(userId?: string) {
  try {
    logger.info('Starting periodic reputation sync', { userId })

    // Get users with Agent0 registration
    const users = await prisma.user.findMany({
      where: {
        agent0TokenId: { not: null },
        ...(userId ? { id: userId } : {}),
      },
      select: {
        id: true,
        agent0TokenId: true,
        nftTokenId: true,
        performanceMetrics: {
          select: {
            lastSyncedAt: true,
          },
        },
      },
    })

    logger.info(`Found ${users.length} agents to sync`, { userId })

    const results = []

    for (const user of users) {
      try {
        if (!user.agent0TokenId) continue

        // Skip if synced recently (within last hour)
        const lastSync = user.performanceMetrics?.lastSyncedAt
        if (lastSync && Date.now() - lastSync.getTime() < 3600000) {
          logger.debug('Skipping recently synced user', {
            userId: user.id,
            lastSync,
          })
          continue
        }

        // Sync on-chain reputation
        await syncOnChainReputation(user.id, user.agent0TokenId)

        // Recalculate local reputation
        await recalculateReputation(user.id)

        results.push({
          userId: user.id,
          agent0TokenId: user.agent0TokenId,
          success: true,
          syncedAt: new Date(),
        })

        logger.info('User reputation synced', {
          userId: user.id,
          agent0TokenId: user.agent0TokenId,
        })
      } catch (error) {
        logger.error('Failed to sync user reputation', {
          userId: user.id,
          error,
        })

        results.push({
          userId: user.id,
          agent0TokenId: user.agent0TokenId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('Periodic reputation sync completed', {
      total: users.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
    })

    return {
      total: users.length,
      results,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Failed to run periodic reputation sync', { 
      error: errorMessage,
      stack: errorStack 
    }, 'PeriodicReputationSync')
    throw error
  }
}

/**
 * Enhance Agent0 registration metadata with reputation data
 *
 * Includes current reputation score and trust level in Agent0 metadata
 * when registering or updating agent profile.
 *
 * @param userId - User ID
 * @returns Enhanced metadata object
 */
export async function getReputationForAgent0Metadata(userId: string) {
  try {
    // Get reputation breakdown
    const reputation = await getReputationBreakdown(userId)

    if (!reputation) {
      return {
        reputation: {
          score: 50,
          trustLevel: 'UNRATED',
          confidence: 0,
          gamesPlayed: 0,
          winRate: 0,
        },
      }
    }

    return {
      reputation: {
        score: Math.round(reputation.reputationScore),
        trustLevel: reputation.trustLevel,
        confidence: Math.round(reputation.confidenceScore * 100) / 100,
        gamesPlayed: reputation.metrics.gamesPlayed,
        winRate: Math.round(reputation.metrics.winRate * 100) / 100,
        normalizedPnL: Math.round(reputation.metrics.normalizedPnL * 100) / 100,
        averageFeedbackScore: Math.round(reputation.metrics.averageFeedbackScore),
        totalFeedback: reputation.metrics.totalFeedbackCount,
      },
    }
  } catch (error) {
    logger.error('Failed to get reputation for Agent0 metadata', { userId, error })
    return {
      reputation: {
        score: 50,
        trustLevel: 'UNRATED',
        confidence: 0,
      },
    }
  }
}

/**
 * Sync specific user's reputation on demand
 *
 * Useful for immediate sync after important events (e.g., game completion, large trade).
 *
 * @param userId - User ID
 * @returns Updated metrics
 */
export async function syncUserReputationNow(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        agent0TokenId: true,
        nftTokenId: true,
      },
    })

    if (!user) {
      throw new Error(`User ${userId} not found`)
    }

    if (!user.agent0TokenId) {
      throw new Error(`User ${userId} has no Agent0 token ID`)
    }

    // Sync on-chain reputation
    const metrics = await syncOnChainReputation(userId, user.agent0TokenId)

    // Recalculate local reputation
    await recalculateReputation(userId)

    logger.info('On-demand reputation sync completed', {
      userId,
      agent0TokenId: user.agent0TokenId,
    })

    return metrics
  } catch (error) {
    logger.error('Failed to sync user reputation on demand', { userId, error })
    throw error
  }
}

// Reputation sync interval (3 hours in milliseconds)
const REPUTATION_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000

/**
 * Check if we should run periodic reputation sync
 * Uses the most recent lastSyncedAt timestamp from any user's performance metrics
 */
async function shouldSyncReputation(): Promise<boolean> {
  const lastSync = await prisma.agentPerformanceMetrics.findFirst({
    where: {
      lastSyncedAt: { not: null },
    },
    orderBy: { lastSyncedAt: 'desc' },
    select: { lastSyncedAt: true },
  })

  if (!lastSync || !lastSync.lastSyncedAt) {
    return true // Never synced before
  }

  const timeSinceLastSync = Date.now() - lastSync.lastSyncedAt.getTime()
  return timeSinceLastSync >= REPUTATION_SYNC_INTERVAL_MS
}

/**
 * Periodic reputation sync if needed (called from game tick)
 * Only syncs if it's been 3+ hours since the last sync
 * 
 * @returns Object with synced status and optional results
 */
export async function periodicReputationSyncIfNeeded() {
  try {
    const shouldSync = await shouldSyncReputation()

    if (!shouldSync) {
      logger.debug('Reputation sync not needed yet', undefined, 'ReputationSync')
      return { synced: false }
    }

    logger.info('Starting periodic reputation sync from game tick', undefined, 'ReputationSync')
    const results = await periodicReputationSync()

    logger.info('Reputation sync completed', {
      total: results.total,
      successful: results.results.filter((r) => r.success).length,
      failed: results.results.filter((r) => !r.success).length,
    }, 'ReputationSync')

    return {
      synced: true,
      total: results.total,
      successful: results.results.filter((r) => r.success).length,
      failed: results.results.filter((r) => !r.success).length,
    }
  } catch (error) {
    logger.error('Failed to run periodic reputation sync', { error }, 'ReputationSync')
    return {
      synced: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
