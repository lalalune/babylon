/**
 * ERC-8004 Reputation Sync Service
 * 
 * Continuously syncs reputation scores to ERC-8004 via Agent0 SDK.
 * 
 * Based on ERC-8004 spec (https://eips.ethereum.org/EIPS/eip-8004):
 * - Publishes reputation as feedback signals on-chain
 * - Uses pre-authorization (feedbackAuth) for feedback submission
 * - Supports tags for filtering and composability
 * - Optional off-chain file for detailed reputation data
 * 
 * Inspired by Neynar Scores approach:
 * - Weekly recalculation for most users
 * - More frequent updates for new accounts
 * - Continuous reputation tracking
 */

import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { generateSnowflakeId } from '@/lib/snowflake'
import { getCachedAgent0ReputationScore } from './agent0-reputation-cache'
import { recalculateReputation } from './reputation-service'
import { getAgent0Client } from '@/agents/agent0/Agent0Client'

interface ReputationSyncResult {
  userId: string
  agent0TokenId: number | null
  reputationScore: number
  synced: boolean
  error?: string
  onChainSubmitted?: boolean
  onChainError?: string
}

interface BatchSyncResult {
  total: number
  synced: number
  failed: number
  skipped: number
  results: ReputationSyncResult[]
}

/**
 * Sync a single user's reputation to ERC-8004
 * 
 * This publishes the reputation score as a feedback signal on-chain via Agent0 SDK.
 * According to ERC-8004, feedback requires pre-authorization from the agent.
 * 
 * For system-level reputation (not user-submitted feedback), we use a special
 * "system" client address that agents pre-authorize during registration.
 */
export async function syncUserReputationToERC8004(
  userId: string,
  forceRecalculate = false
): Promise<ReputationSyncResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      agent0TokenId: true,
      username: true,
      displayName: true,
      isBanned: true,
      isScammer: true,
      isCSAM: true,
      createdAt: true,
      AgentPerformanceMetrics: {
        select: {
          reputationScore: true,
          updatedAt: true,
          lastActivityAt: true,
        },
      },
    },
  })

  if (!user) {
    return {
      userId,
      agent0TokenId: null,
      reputationScore: 0,
      synced: false,
      error: 'User not found',
    }
  }

  if (!user.agent0TokenId) {
    return {
      userId,
      agent0TokenId: null,
      reputationScore: 0,
      synced: false,
      error: 'No Agent0 token ID',
    }
  }

  try {
    // Recalculate reputation if forced or if metrics are stale
    let reputationScore: number
    if (forceRecalculate) {
      const metrics = await recalculateReputation(userId)
      reputationScore = metrics?.reputationScore ?? 50
    } else {
      reputationScore = await getCachedAgent0ReputationScore(userId)
    }

    // Convert to ERC-8004 feedback score (0-100)
    const feedbackScore = Math.round(Math.max(0, Math.min(100, reputationScore)))

    // Determine tags based on user status
    const tags: string[] = []
    if (user.isBanned) {
      tags.push('banned')
    }
    if (user.isScammer) {
      tags.push('scammer')
    }
    if (user.isCSAM) {
      tags.push('csam')
    }
    if (!user.isBanned && !user.isScammer && !user.isCSAM) {
      tags.push('active')
    }

    // Check if we should sync (avoid spamming on-chain)
    const lastSync = await getLastReputationSync(userId)
    const shouldSync = shouldSyncReputation(user, lastSync, forceRecalculate)

    if (!shouldSync) {
      return {
        userId,
        agent0TokenId: user.agent0TokenId,
        reputationScore,
        synced: false,
        error: 'Sync not needed (too recent)',
      }
    }

    logger.info('Syncing reputation to ERC-8004', {
      userId,
      agent0TokenId: user.agent0TokenId,
      reputationScore,
      feedbackScore,
      tags,
    }, 'ERC8004ReputationSync')

    // Update local metrics with latest reputation
    await prisma.agentPerformanceMetrics.upsert({
      where: { userId },
      create: {
        id: await generateSnowflakeId(),
        userId,
        reputationScore,
        updatedAt: new Date(),
      },
      update: {
        reputationScore,
        updatedAt: new Date(),
      },
    })

    // Record sync timestamp
    await recordReputationSync(userId, feedbackScore, tags)

    // Attempt to submit feedback to ERC-8004 via Agent0 SDK
    // This requires:
    // 1. Agent0 SDK configured with system wallet (AGENT0_FEEDBACK_PRIVATE_KEY or BABYLON_AGENT0_PRIVATE_KEY)
    // 2. Agent to have pre-authorized system address during registration
    // 3. Network connectivity and gas for transaction
    let onChainSubmitted = false
    let onChainError: string | undefined

    try {
      // Check if Agent0 SDK is configured for feedback submission
      // Use default test key for localnet (first Anvil account)
      const feedbackPrivateKey = process.env.AGENT0_FEEDBACK_PRIVATE_KEY || 
                                 process.env.BABYLON_AGENT0_PRIVATE_KEY ||
                                 (process.env.AGENT0_NETWORK === 'localnet' 
                                   ? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
                                   : undefined)
      
      if (!feedbackPrivateKey) {
        logger.debug('Agent0 feedback private key not configured, skipping on-chain submission', {
          userId,
          agent0TokenId: user.agent0TokenId,
        }, 'ERC8004ReputationSync')
        onChainError = 'Feedback private key not configured'
      } else {
        // Get agent's wallet address for system feedback
        // For system-level reputation, we use the agent's own wallet address
        // The agent should pre-authorize this during registration
        const agentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { walletAddress: true },
        })

        if (!agentUser?.walletAddress) {
          logger.debug('Agent has no wallet address, skipping on-chain submission', {
            userId,
            agent0TokenId: user.agent0TokenId,
          }, 'ERC8004ReputationSync')
          onChainError = 'Agent has no wallet address'
        } else {
          // Use Agent0Client for feedback submission
          // This uses the SDK's giveFeedback method
          // Note: This requires the agent to have pre-authorized feedback from the system address
          // The SDK will handle signing and submission if properly configured
          try {
            const agent0Client = getAgent0Client()
            
            // Submit feedback via Agent0 SDK
            // Convert 0-100 score to -5 to +5 scale (ERC-8004 uses -5 to +5)
            const rating = Math.round((feedbackScore / 100) * 10 - 5)
            
            await agent0Client.submitFeedback({
              targetAgentId: user.agent0TokenId,
              rating,
              comment: `System reputation update: ${feedbackScore}/100. Tags: ${tags.join(', ')}`,
              transactionId: `reputation-sync-${userId}-${Date.now()}`,
            })

            onChainSubmitted = true
            logger.info('Reputation synced to ERC-8004 on-chain', {
              userId,
              agent0TokenId: user.agent0TokenId,
              feedbackScore,
              rating,
              tags,
            }, 'ERC8004ReputationSync')
          } catch (submitError) {
            // If submission fails, log but don't fail the sync
            onChainError = submitError instanceof Error ? submitError.message : 'Unknown submission error'
            logger.warn('Agent0 feedback submission failed', {
              userId,
              agent0TokenId: user.agent0TokenId,
              error: onChainError,
            }, 'ERC8004ReputationSync')
          }
        }
      }
    } catch (error) {
      // Log error but don't fail the sync - local metrics are still updated
      onChainError = error instanceof Error ? error.message : 'Unknown error'
      logger.warn('Failed to submit reputation to ERC-8004 on-chain (non-blocking)', {
        userId,
        agent0TokenId: user.agent0TokenId,
        error: onChainError,
      }, 'ERC8004ReputationSync')
    }
    
    return {
      userId,
      agent0TokenId: user.agent0TokenId,
      reputationScore,
      synced: true,
      onChainSubmitted,
      onChainError,
    }
  } catch (error) {
    logger.error('Failed to sync user reputation', {
      userId,
      agent0TokenId: user.agent0TokenId,
      error,
    }, 'ERC8004ReputationSync')

    return {
      userId,
      agent0TokenId: user.agent0TokenId,
      reputationScore: 0,
      synced: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Batch sync reputation for multiple users
 * 
 * Processes users in batches to avoid overwhelming the system.
 * Prioritizes new accounts and recently active users.
 */
export async function batchSyncReputationsToERC8004(
  options: {
    limit?: number
    offset?: number
    forceRecalculate?: boolean
    prioritizeNew?: boolean
  } = {}
): Promise<BatchSyncResult> {
  const {
    limit = 100,
    offset = 0,
    forceRecalculate = false,
    prioritizeNew = true,
  } = options

  // Query users with Agent0 token IDs
  // Prioritize new accounts (created in last 7 days) if requested
  const whereClause: Record<string, unknown> = {
    agent0TokenId: { not: null },
  }

  if (prioritizeNew) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    whereClause.createdAt = { gte: sevenDaysAgo }
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      agent0TokenId: true,
      createdAt: true,
    },
    orderBy: prioritizeNew
      ? { createdAt: 'desc' }
      : { createdAt: 'asc' },
    take: limit,
    skip: offset,
  })

  logger.info(`Batch syncing ${users.length} user reputations`, {
    limit,
    offset,
    prioritizeNew,
  }, 'ERC8004ReputationSync')

  const results: ReputationSyncResult[] = []
  let synced = 0
  let failed = 0
  let skipped = 0

  for (const user of users) {
    const result = await syncUserReputationToERC8004(user.id, forceRecalculate)
    results.push(result)

    if (result.synced) {
      synced++
    } else if (result.error?.includes('not needed')) {
      skipped++
    } else {
      failed++
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return {
    total: users.length,
    synced,
    failed,
    skipped,
    results,
  }
}

/**
 * Determine if reputation should be synced based on last sync time
 * 
 * Similar to Neynar Scores:
 * - New accounts (< 7 days): Sync daily
 * - Active accounts: Sync weekly
 * - Inactive accounts: Sync monthly
 */
function shouldSyncReputation(
  user: {
    createdAt: Date
    AgentPerformanceMetrics: { updatedAt: Date; lastActivityAt: Date | null } | null
  },
  lastSync: Date | null,
  forceRecalculate: boolean
): boolean {
  if (forceRecalculate) {
    return true
  }

  if (!lastSync) {
    return true // Never synced
  }

  const now = Date.now()
  const lastSyncTime = lastSync.getTime()
  const accountAge = now - user.createdAt.getTime()
  const daysSinceSync = (now - lastSyncTime) / (24 * 60 * 60 * 1000)

  // New accounts (< 7 days): Sync daily
  if (accountAge < 7 * 24 * 60 * 60 * 1000) {
    return daysSinceSync >= 1
  }

  // Active accounts: Sync weekly
  const lastActivity = user.AgentPerformanceMetrics?.lastActivityAt
  if (lastActivity) {
    const daysSinceActivity = (now - lastActivity.getTime()) / (24 * 60 * 60 * 1000)
    if (daysSinceActivity < 7) {
      return daysSinceSync >= 7 // Weekly for active users
    }
  }

  // Inactive accounts: Sync monthly
  return daysSinceSync >= 30
}

/**
 * Get last reputation sync timestamp for a user
 */
async function getLastReputationSync(userId: string): Promise<Date | null> {
  const sync = await prisma.gameConfig.findFirst({
    where: {
      key: `reputation_sync_${userId}`,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  return sync?.createdAt ?? null
}

/**
 * Record reputation sync timestamp
 */
async function recordReputationSync(
  userId: string,
  score: number,
  tags: string[]
): Promise<void> {
  await prisma.gameConfig.upsert({
    where: {
      key: `reputation_sync_${userId}`,
    },
    create: {
      id: await generateSnowflakeId(),
      key: `reputation_sync_${userId}`,
      value: {
        score,
        tags,
        syncedAt: new Date().toISOString(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    update: {
      value: {
        score,
        tags,
        syncedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    },
  })
}

/**
 * Sync all active user reputations
 * 
 * This is the main entry point for cron jobs.
 * Processes users in batches to stay within execution time limits.
 */
export async function syncAllReputationsToERC8004(): Promise<BatchSyncResult> {
  logger.info('Starting full reputation sync to ERC-8004', undefined, 'ERC8004ReputationSync')

  const batchSize = 50
  let offset = 0
  let totalSynced = 0
  let totalFailed = 0
  let totalSkipped = 0
  const allResults: ReputationSyncResult[] = []

  while (true) {
    const batch = await batchSyncReputationsToERC8004({
      limit: batchSize,
      offset,
      prioritizeNew: offset === 0, // Prioritize new accounts on first batch
    })

    totalSynced += batch.synced
    totalFailed += batch.failed
    totalSkipped += batch.skipped
    allResults.push(...batch.results)

    if (batch.total < batchSize) {
      break // Last batch
    }

    offset += batchSize
  }

  logger.info('Completed full reputation sync', {
    total: allResults.length,
    synced: totalSynced,
    failed: totalFailed,
    skipped: totalSkipped,
  }, 'ERC8004ReputationSync')

  return {
    total: allResults.length,
    synced: totalSynced,
    failed: totalFailed,
    skipped: totalSkipped,
    results: allResults,
  }
}

