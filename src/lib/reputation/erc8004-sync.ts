/**
 * ERC-8004 Reputation Sync Service
 * 
 * Syncs reputation scores and ban status to ERC-8004 via Agent0
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
// Note: Agent0 client import will be used when implementing Agent0 feedback submission

interface ReputationSyncData {
  reputationScore: number
  isBanned: boolean
  isScammer: boolean
  isCSAM: boolean
}

/**
 * Sync SYSTEM-LEVEL reputation to local metrics
 * 
 * This syncs system-calculated reputation (bans, flags, activity scores) to local database.
 * This is different from USER-SUBMITTED feedback, which is handled by:
 * - submitFeedbackToAgent0() in agent0-reputation-sync.ts - Submits user ratings to Agent0
 * - Agent0FeedbackService.submitFeedback() - Full Agent0 SDK integration with signatures
 * 
 * This function is called when:
 * - User is banned/unbanned
 * - User is flagged as scammer/CSAM
 * - Reputation score is recalculated
 * 
 * It updates local AgentPerformanceMetrics but does NOT submit feedback to Agent0 network.
 * User feedback submission is handled separately via the feedback endpoints.
 */
export async function syncReputationToERC8004(
  userId: string,
  data: ReputationSyncData
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      agent0TokenId: true,
      username: true,
      displayName: true,
    },
  })

  if (!user || !user.agent0TokenId) {
    logger.debug('User has no Agent0 token ID, skipping ERC-8004 sync', { userId }, 'ERC8004Sync')
    return
  }

  try {
    // Calculate reputation score based on status
    let reputationScore = data.reputationScore

    // Banned users get 0
    if (data.isBanned) {
      reputationScore = 0
    }
    // Scammers/CSAM get very low score (but not 0 to distinguish from banned)
    else if (data.isScammer || data.isCSAM) {
      reputationScore = 5
    }

    // Convert reputation score (0-100) to Agent0 feedback score (0-100)
    // Agent0 uses 0-100 scale, same as our reputation score
    const agent0Score = Math.round(Math.max(0, Math.min(100, reputationScore)))
    
    logger.info('Syncing system reputation to local metrics', {
      userId,
      agent0TokenId: user.agent0TokenId,
      reputationScore,
      agent0Score,
      isBanned: data.isBanned,
      isScammer: data.isScammer,
      isCSAM: data.isCSAM,
    }, 'ERC8004Sync')

    // Update local AgentPerformanceMetrics with system-calculated reputation
    // Note: This does NOT submit feedback to Agent0 network (that's handled separately)
    await prisma.agentPerformanceMetrics.upsert({
      where: { userId },
      create: {
        id: await import('@/lib/snowflake').then(m => m.generateSnowflakeId()),
        userId,
        reputationScore,
        updatedAt: new Date(),
      },
      update: {
        reputationScore,
        updatedAt: new Date(),
      },
    })

    logger.info('✅ Reputation synced to ERC-8004', {
      userId,
      agent0TokenId: user.agent0TokenId,
      reputationScore,
    }, 'ERC8004Sync')
  } catch (error) {
    logger.error('Failed to sync reputation to ERC-8004', {
      userId,
      agent0TokenId: user.agent0TokenId,
      error,
    }, 'ERC8004Sync')
    throw error
  }
}

/**
 * Sync all user reputations to ERC-8004
 * Useful for batch operations or migrations
 */
export async function syncAllReputationsToERC8004(): Promise<void> {
  const users = await prisma.user.findMany({
    where: {
      agent0TokenId: { not: null },
      isBanned: false, // Only sync active users
    },
    select: {
      id: true,
      agent0TokenId: true,
      isBanned: true,
      isScammer: true,
      isCSAM: true,
      AgentPerformanceMetrics: {
        select: {
          reputationScore: true,
        },
      },
    },
    take: 100, // Process in batches
  })

  logger.info(`Syncing ${users.length} user reputations to ERC-8004`, undefined, 'ERC8004Sync')

  for (const user of users) {
    try {
      await syncReputationToERC8004(user.id, {
        reputationScore: user.AgentPerformanceMetrics?.reputationScore ?? 50,
        isBanned: user.isBanned,
        isScammer: user.isScammer,
        isCSAM: user.isCSAM,
      })
    } catch (error) {
      logger.error('Failed to sync user reputation', {
        userId: user.id,
        agent0TokenId: user.agent0TokenId,
        error,
      }, 'ERC8004Sync')
      // Continue with next user
    }
  }
}

