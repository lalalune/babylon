/**
 * Vercel Cron Job: Reputation Sync to ERC-8004
 * 
 * Continuously syncs reputation scores to ERC-8004 via Agent0 SDK.
 * 
 * Configuration in vercel.json:
 * - Runs daily (or more frequently for new accounts)
 * - Publishes reputation as feedback signals on-chain
 * - Updates local metrics
 * 
 * Based on ERC-8004 spec and inspired by Neynar Scores approach:
 * - Weekly recalculation for most users
 * - More frequent updates for new accounts
 * - Continuous reputation tracking
 * 
 * Security: Uses Vercel Cron secret for authentication
 */

import type { NextRequest } from 'next/server'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { AuthorizationError } from '@/lib/errors'
import { logger } from '@/lib/logger'
import { syncAllReputationsToERC8004, batchSyncReputationsToERC8004 } from '@/lib/reputation/erc8004-reputation-sync'

// Vercel function configuration
export const maxDuration = 300 // 5 minutes max

// Verify this is a legitimate Vercel Cron request
function verifyVercelCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // In development, allow without secret for easy testing
  if (process.env.NODE_ENV === 'development') {
    if (!cronSecret) {
      logger.info('Development mode - allowing cron without CRON_SECRET', undefined, 'ReputationSyncCron')
      return true
    }
    if (authHeader === 'Bearer development' || authHeader === `Bearer ${cronSecret}`) {
      return true
    }
  }

  // If CRON_SECRET is not configured, allow but warn
  if (!cronSecret) {
    logger.warn(
      '⚠️  CRON_SECRET not configured! Cron endpoint is accessible without authentication.',
      { environment: process.env.NODE_ENV },
      'ReputationSyncCron'
    )
    return true
  }

  // Verify authorization header matches secret
  if (authHeader !== `Bearer ${cronSecret}`) {
    return false
  }

  return true
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Verify cron request
  if (!verifyVercelCronRequest(request)) {
    throw new AuthorizationError('Invalid cron secret', 'cron', 'reputation-sync')
  }

  const startTime = Date.now()
  logger.info('🔄 Starting reputation sync cron job', undefined, 'ReputationSyncCron')

  try {
    // Parse query parameters for batch processing
    const { searchParams } = new URL(request.url)
    const batchMode = searchParams.get('batch') === 'true'
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const forceRecalculate = searchParams.get('force') === 'true'

    let result

    if (batchMode) {
      // Process a specific batch (useful for large syncs)
      logger.info(`Processing batch: limit=${limit}, offset=${offset}`, undefined, 'ReputationSyncCron')
      result = await batchSyncReputationsToERC8004({
        limit,
        offset,
        forceRecalculate,
        prioritizeNew: offset === 0,
      })
    } else {
      // Full sync (processes all users)
      logger.info('Processing full reputation sync', undefined, 'ReputationSyncCron')
      result = await syncAllReputationsToERC8004()
    }

    const duration = Date.now() - startTime

    logger.info('✅ Reputation sync completed', {
      duration,
      total: result.total,
      synced: result.synced,
      failed: result.failed,
      skipped: result.skipped,
    }, 'ReputationSyncCron')

    return successResponse({
      success: true,
      duration,
      result: {
        total: result.total,
        synced: result.synced,
        failed: result.failed,
        skipped: result.skipped,
      },
      batchMode,
      limit: batchMode ? limit : undefined,
      offset: batchMode ? offset : undefined,
    })
  } catch (error) {
    logger.error('❌ Reputation sync cron failed', { error }, 'ReputationSyncCron')
    throw error
  }
})

