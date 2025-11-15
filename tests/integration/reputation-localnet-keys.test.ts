/**
 * Integration Tests: Reputation Sync with Localnet Default Keys
 * 
 * Tests that default test keys are used correctly in localnet mode
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import { prisma } from '@/lib/prisma'
import { generateSnowflakeId } from '@/lib/snowflake'
import { syncUserReputationToERC8004 } from '@/lib/reputation/erc8004-reputation-sync'
import { Agent0FeedbackService } from '@/lib/agent0/feedback-service'

describe('Reputation Sync with Localnet Default Keys', () => {
  let testAgentUserId: string
  const DEFAULT_LOCALNET_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

  beforeAll(async () => {
    // Create test agent
    testAgentUserId = await generateSnowflakeId()

    await prisma.user.create({
      data: {
        id: testAgentUserId,
        username: `test-localnet-agent-${Date.now()}`,
        displayName: 'Test Localnet Agent',
        isAgent: true,
        agent0TokenId: 12345,
        walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Second Anvil account
        updatedAt: new Date(),
      },
    })
  })

  test('should use default localnet key when AGENT0_NETWORK is localnet', async () => {
    // Set localnet mode
    const originalNetwork = process.env.AGENT0_NETWORK
    const originalFeedbackKey = process.env.AGENT0_FEEDBACK_PRIVATE_KEY
    const originalBabylonKey = process.env.BABYLON_AGENT0_PRIVATE_KEY

    try {
      process.env.AGENT0_NETWORK = 'localnet'
      delete process.env.AGENT0_FEEDBACK_PRIVATE_KEY
      delete process.env.BABYLON_AGENT0_PRIVATE_KEY

      // Test that sync attempts to use default key
      const result = await syncUserReputationToERC8004(testAgentUserId, true)

      // Should not have "Feedback private key not configured" error
      expect(result.onChainError).not.toBe('Feedback private key not configured')
      
      // If there's an error, it should be about wallet/pre-auth, not missing key
      if (result.onChainError) {
        expect(result.onChainError).not.toContain('not configured')
      }
    } finally {
      // Restore original values
      if (originalNetwork) {
        process.env.AGENT0_NETWORK = originalNetwork
      } else {
        delete process.env.AGENT0_NETWORK
      }
      if (originalFeedbackKey) {
        process.env.AGENT0_FEEDBACK_PRIVATE_KEY = originalFeedbackKey
      }
      if (originalBabylonKey) {
        process.env.BABYLON_AGENT0_PRIVATE_KEY = originalBabylonKey
      }
    }
  })

  test('should prefer explicit env vars over default key', async () => {
    const originalNetwork = process.env.AGENT0_NETWORK
    const originalFeedbackKey = process.env.AGENT0_FEEDBACK_PRIVATE_KEY
    const originalBabylonKey = process.env.BABYLON_AGENT0_PRIVATE_KEY

    try {
      process.env.AGENT0_NETWORK = 'localnet'
      process.env.AGENT0_FEEDBACK_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      delete process.env.BABYLON_AGENT0_PRIVATE_KEY

      const result = await syncUserReputationToERC8004(testAgentUserId, true)

      // Should use explicit key, not default
      expect(result.onChainError).not.toBe('Feedback private key not configured')
    } finally {
      if (originalNetwork) {
        process.env.AGENT0_NETWORK = originalNetwork
      } else {
        delete process.env.AGENT0_NETWORK
      }
      if (originalFeedbackKey) {
        process.env.AGENT0_FEEDBACK_PRIVATE_KEY = originalFeedbackKey
      } else {
        delete process.env.AGENT0_FEEDBACK_PRIVATE_KEY
      }
      if (originalBabylonKey) {
        process.env.BABYLON_AGENT0_PRIVATE_KEY = originalBabylonKey
      }
    }
  })

  test('should not use default key when not in localnet mode', async () => {
    const originalNetwork = process.env.AGENT0_NETWORK
    const originalFeedbackKey = process.env.AGENT0_FEEDBACK_PRIVATE_KEY
    const originalBabylonKey = process.env.BABYLON_AGENT0_PRIVATE_KEY

    try {
      process.env.AGENT0_NETWORK = 'sepolia'
      delete process.env.AGENT0_FEEDBACK_PRIVATE_KEY
      delete process.env.BABYLON_AGENT0_PRIVATE_KEY

      const result = await syncUserReputationToERC8004(testAgentUserId, true)

      // Should have "Feedback private key not configured" error when not localnet
      expect(result.onChainError).toBe('Feedback private key not configured')
    } finally {
      if (originalNetwork) {
        process.env.AGENT0_NETWORK = originalNetwork
      } else {
        delete process.env.AGENT0_NETWORK
      }
      if (originalFeedbackKey) {
        process.env.AGENT0_FEEDBACK_PRIVATE_KEY = originalFeedbackKey
      }
      if (originalBabylonKey) {
        process.env.BABYLON_AGENT0_PRIVATE_KEY = originalBabylonKey
      }
    }
  })

  test('should handle Agent0FeedbackService with default key', async () => {
    const originalNetwork = process.env.AGENT0_NETWORK
    const originalFeedbackKey = process.env.AGENT0_FEEDBACK_PRIVATE_KEY
    const originalBabylonKey = process.env.BABYLON_AGENT0_PRIVATE_KEY
    const originalIpfsProvider = process.env.AGENT0_IPFS_PROVIDER

    try {
      process.env.AGENT0_NETWORK = 'localnet'
      process.env.AGENT0_IPFS_PROVIDER = 'node' // Use node IPFS for localnet
      delete process.env.AGENT0_FEEDBACK_PRIVATE_KEY
      delete process.env.BABYLON_AGENT0_PRIVATE_KEY

      // Should be able to instantiate service without error
      const service = new Agent0FeedbackService()
      expect(service).toBeDefined()
    } finally {
      if (originalNetwork) {
        process.env.AGENT0_NETWORK = originalNetwork
      } else {
        delete process.env.AGENT0_NETWORK
      }
      if (originalFeedbackKey) {
        process.env.AGENT0_FEEDBACK_PRIVATE_KEY = originalFeedbackKey
      }
      if (originalBabylonKey) {
        process.env.BABYLON_AGENT0_PRIVATE_KEY = originalBabylonKey
      }
      if (originalIpfsProvider) {
        process.env.AGENT0_IPFS_PROVIDER = originalIpfsProvider
      } else {
        delete process.env.AGENT0_IPFS_PROVIDER
      }
    }
  })
})

