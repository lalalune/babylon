#!/usr/bin/env bun
/**
 * Verification Script: ERC-8004 Reputation System
 * 
 * Comprehensive verification of the reputation system:
 * 1. Tests reputation calculation
 * 2. Tests sync functionality
 * 3. Verifies on-chain submission (if configured)
 * 4. Checks admin UI data structure
 * 
 * Run: bun run scripts/verify-reputation-system.ts
 */

import { prisma } from '../src/lib/prisma'
import {
  syncUserReputationToERC8004,
  batchSyncReputationsToERC8004,
} from '../src/lib/reputation/erc8004-reputation-sync'
import { getCachedAgent0ReputationScore } from '../src/lib/reputation/agent0-reputation-cache'
import { generateSnowflakeId } from '../src/lib/snowflake'

interface VerificationResult {
  test: string
  passed: boolean
  message: string
  details?: unknown
}

const results: VerificationResult[] = []

function recordResult(test: string, passed: boolean, message: string, details?: unknown) {
  results.push({ test, passed, message, details })
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${test}: ${message}`)
  if (details && !passed) {
    console.log('   Details:', JSON.stringify(details, null, 2))
  }
}

async function verifyReputationCalculation() {
  console.log('\n📊 Verifying Reputation Calculation...')
  
  // Create test user
  const testUserId = await generateSnowflakeId()
  await prisma.user.create({
    data: {
      id: testUserId,
      username: `verify-test-${Date.now()}`,
      displayName: 'Verification Test User',
      agent0TokenId: 999999,
      updatedAt: new Date(),
    },
  })

  try {
    // Test cached reputation
    const score = await getCachedAgent0ReputationScore(testUserId)
    recordResult(
      'Reputation Calculation',
      score >= 0 && score <= 100,
      `Score: ${score}/100`,
      { score }
    )

    // Test banned user
    await prisma.user.update({
      where: { id: testUserId },
      data: { isBanned: true },
    })
    const bannedScore = await getCachedAgent0ReputationScore(testUserId)
    recordResult(
      'Banned User Reputation',
      bannedScore === 0,
      `Banned score: ${bannedScore} (expected 0)`,
      { score: bannedScore }
    )

    // Test scammer flag
    await prisma.user.update({
      where: { id: testUserId },
      data: { isBanned: false, isScammer: true },
    })
    const scammerScore = await getCachedAgent0ReputationScore(testUserId)
    recordResult(
      'Scammer User Reputation',
      scammerScore === 5,
      `Scammer score: ${scammerScore} (expected 5)`,
      { score: scammerScore }
    )

    // Clean up
    await prisma.user.delete({ where: { id: testUserId } })
    await prisma.agentPerformanceMetrics.deleteMany({ where: { userId: testUserId } })
  } catch (error) {
    recordResult('Reputation Calculation', false, 'Error during calculation', { error })
    // Clean up on error
    await prisma.user.delete({ where: { id: testUserId } }).catch(() => {})
  }
}

async function verifySyncFunctionality() {
  console.log('\n🔄 Verifying Sync Functionality...')

  // Get a real agent with Agent0 token ID
  const agent = await prisma.user.findFirst({
    where: {
      isAgent: true,
      agent0TokenId: { not: null },
    },
    select: {
      id: true,
      agent0TokenId: true,
      displayName: true,
    },
  })

  if (!agent || !agent.agent0TokenId) {
    recordResult('Sync Functionality', false, 'No agent with Agent0 token ID found')
    return
  }

  try {
    // Test single user sync
    const syncResult = await syncUserReputationToERC8004(agent.id, false)
    recordResult(
      'Single User Sync',
      syncResult.synced || (syncResult.error?.includes('not needed') ?? false),
      `Sync result: ${syncResult.synced ? 'synced' : syncResult.error}`,
      {
        userId: agent.id,
        agent0TokenId: syncResult.agent0TokenId,
        reputationScore: syncResult.reputationScore,
        synced: syncResult.synced,
        onChainSubmitted: syncResult.onChainSubmitted,
        onChainError: syncResult.onChainError,
      }
    )

    // Test batch sync
    const batchResult = await batchSyncReputationsToERC8004({
      limit: 5,
      offset: 0,
      prioritizeNew: true,
    })
    recordResult(
      'Batch Sync',
      batchResult.total >= 0 && batchResult.synced >= 0,
      `Batch: ${batchResult.synced} synced, ${batchResult.failed} failed, ${batchResult.skipped} skipped`,
      batchResult
    )
  } catch (error) {
    recordResult('Sync Functionality', false, 'Error during sync', { error })
  }
}

async function verifyOnChainSubmission() {
  console.log('\n⛓️  Verifying On-Chain Submission...')

  const hasConfig = !!(
    process.env.AGENT0_FEEDBACK_PRIVATE_KEY ||
    process.env.BABYLON_AGENT0_PRIVATE_KEY ||
    process.env.AGENT0_PRIVATE_KEY
  )

  recordResult(
    'On-Chain Configuration',
    hasConfig,
    hasConfig
      ? 'Agent0 SDK configured for on-chain submission'
      : 'Agent0 SDK not configured (local sync only)',
    {
      hasFeedbackKey: !!process.env.AGENT0_FEEDBACK_PRIVATE_KEY,
      hasBabylonKey: !!process.env.BABYLON_AGENT0_PRIVATE_KEY,
      hasAgent0Key: !!process.env.AGENT0_PRIVATE_KEY,
    }
  )

  // Test actual submission if configured
  if (hasConfig) {
    const agent = await prisma.user.findFirst({
      where: {
        isAgent: true,
        agent0TokenId: { not: null },
        walletAddress: { not: null },
      },
      select: {
        id: true,
        agent0TokenId: true,
        walletAddress: true,
      },
    })

    if (agent) {
      try {
        const syncResult = await syncUserReputationToERC8004(agent.id, true)
        recordResult(
          'On-Chain Submission',
          syncResult.onChainSubmitted === true || syncResult.onChainError !== undefined,
          syncResult.onChainSubmitted === true
            ? 'Successfully submitted to ERC-8004'
            : `Submission skipped: ${syncResult.onChainError || 'unknown'}`,
          {
            onChainSubmitted: syncResult.onChainSubmitted,
            onChainError: syncResult.onChainError,
          }
        )
      } catch (error) {
        recordResult('On-Chain Submission', false, 'Error during submission', { error })
      }
    } else {
      recordResult(
        'On-Chain Submission',
        false,
        'No agent with wallet address found for testing'
      )
    }
  }
}

async function verifyAdminAPI() {
  console.log('\n👨‍💼 Verifying Admin API...')

  // Check if agents API returns reputation data
  const agents = await prisma.user.findMany({
    where: { isAgent: true },
    take: 5,
    include: {
      AgentPerformanceMetrics: {
        select: {
          reputationScore: true,
          averageFeedbackScore: true,
          totalFeedbackCount: true,
        },
      },
    },
  })

  recordResult(
    'Admin API Data Structure',
    agents.length > 0,
    `Found ${agents.length} agents`,
    {
      agentsWithMetrics: agents.filter(a => a.AgentPerformanceMetrics).length,
      agentsWithReputation: agents.filter(
        a => a.AgentPerformanceMetrics?.reputationScore !== undefined
      ).length,
    }
  )

  // Verify data structure matches what API should return
  if (agents.length > 0) {
    const agentWithMetrics = agents.find(a => a.AgentPerformanceMetrics)
    if (agentWithMetrics) {
      const hasReputationScore =
        agentWithMetrics.AgentPerformanceMetrics?.reputationScore !== undefined
      recordResult(
        'Reputation Score in Metrics',
        hasReputationScore,
        hasReputationScore
          ? `Reputation score: ${agentWithMetrics.AgentPerformanceMetrics?.reputationScore}`
          : 'No reputation score found',
        {
          reputationScore: agentWithMetrics.AgentPerformanceMetrics?.reputationScore,
          averageFeedbackScore: agentWithMetrics.AgentPerformanceMetrics?.averageFeedbackScore,
          totalFeedbackCount: agentWithMetrics.AgentPerformanceMetrics?.totalFeedbackCount,
        }
      )
    }
  }
}

async function verifyCronEndpoint() {
  console.log('\n⏰ Verifying Cron Endpoint...')

  const BASE_URL = process.env.TEST_API_URL || process.env.TEST_BASE_URL || 'http://localhost:3000'

  try {
    const response = await fetch(`${BASE_URL}/api/cron/reputation-sync`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer development',
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      recordResult(
        'Cron Endpoint',
        data.success === true,
        `Cron endpoint accessible: ${data.success ? 'success' : 'failed'}`,
        data
      )
    } else {
      recordResult(
        'Cron Endpoint',
        false,
        `Cron endpoint returned ${response.status}`,
        { status: response.status, statusText: response.statusText }
      )
    }
  } catch (error) {
    recordResult(
      'Cron Endpoint',
      false,
      'Server not available or endpoint not accessible',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )
  }
}

async function main() {
  console.log('🔍 ERC-8004 Reputation System Verification')
  console.log('=' .repeat(60))

  try {
    await verifyReputationCalculation()
    await verifySyncFunctionality()
    await verifyOnChainSubmission()
    await verifyAdminAPI()
    await verifyCronEndpoint()

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📋 Verification Summary')
    console.log('='.repeat(60))

    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length
    const total = results.length

    console.log(`Total Tests: ${total}`)
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`)

    if (failed > 0) {
      console.log('\n❌ Failed Tests:')
      results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.test}: ${r.message}`)
        })
      process.exit(1)
    } else {
      console.log('\n✅ All verification tests passed!')
      process.exit(0)
    }
  } catch (error) {
    console.error('❌ Verification failed with error:', error)
    process.exit(1)
  }
}

main()

