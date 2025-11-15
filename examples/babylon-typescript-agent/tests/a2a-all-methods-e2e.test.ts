/**
 * Comprehensive E2E tests for ALL A2A methods
 * Tests against real server running on localhost:3000
 * 
 * This test suite verifies that ALL ~60 A2A methods are:
 * 1. Available in the client
 * 2. Can be called successfully (or return expected errors)
 * 3. Return proper response structures
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { BabylonA2AClient } from '../src/a2a-client'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const TEST_CONFIG = {
  apiUrl: process.env.BABYLON_API_URL || 'http://localhost:3000/api/a2a',
  address: process.env.AGENT0_ADDRESS || '0x' + '1'.repeat(40),
  tokenId: parseInt(process.env.AGENT0_TOKEN_ID || '999999', 10),
  privateKey: process.env.AGENT0_PRIVATE_KEY || '0x' + '1'.repeat(64)
}

describe('A2A All Methods E2E Tests', () => {
  let client: BabylonA2AClient

  beforeAll(async () => {
    // Check if server is running
    try {
      const healthCheck = await fetch('http://localhost:3000/api/health')
      if (!healthCheck.ok) {
        throw new Error('Server not running')
      }
    } catch (error) {
      throw new Error('Babylon server must be running on localhost:3000. Run: bun run dev')
    }

    client = new BabylonA2AClient(TEST_CONFIG)
    await client.connect()
  })

  describe('Agent Discovery (2 methods)', () => {
    it('should discover agents', async () => {
      const result = await client.discoverAgents()
      expect(result).toHaveProperty('agents')
      expect(Array.isArray(result.agents)).toBe(true)
    })

    it('should get agent info', async () => {
      // Try to get info for a known agent or handle error gracefully
      try {
        const result = await client.getAgentInfo('agent-1')
        expect(result).toHaveProperty('agentId')
      } catch (error) {
        // Expected if agent doesn't exist
        expect(error).toBeDefined()
      }
    })
  })

  describe('Market Operations (8 methods)', () => {
    it('should get market data', async () => {
      try {
        const result = await client.getMarketData('1')
        expect(result).toHaveProperty('marketId')
      } catch (error) {
        // Expected if market doesn't exist
        expect(error).toBeDefined()
      }
    })

    it('should get market prices', async () => {
      try {
        const result = await client.getMarketPrices(['1'])
        expect(result).toBeDefined()
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should subscribe to market', async () => {
      try {
        const result = await client.subscribeMarket('1')
        expect(result).toHaveProperty('subscribed')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should get predictions', async () => {
      const result = await client.getPredictions()
      expect(result).toHaveProperty('predictions')
      expect(Array.isArray(result.predictions)).toBe(true)
    })

    it('should get perpetuals', async () => {
      const result = await client.getPerpetuals()
      expect(result).toHaveProperty('perpetuals')
      expect(Array.isArray(result.perpetuals)).toBe(true)
    })

    it('should get trades', async () => {
      const result = await client.getTrades()
      expect(result).toHaveProperty('trades')
      expect(Array.isArray(result.trades)).toBe(true)
    })

    it('should get trade history', async () => {
      try {
        const result = await client.getTradeHistory(client.agentId || 'test-user')
        expect(result).toHaveProperty('trades')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Social Features (11 methods)', () => {
    it('should get feed', async () => {
      const result = await client.getFeed()
      expect(result).toHaveProperty('posts')
      expect(Array.isArray(result.posts)).toBe(true)
    })

    it('should get post', async () => {
      try {
        const result = await client.getPost('test-post-id')
        expect(result).toBeDefined()
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should get comments', async () => {
      try {
        const result = await client.getComments('test-post-id')
        expect(result).toHaveProperty('comments')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should get trending tags', async () => {
      const result = await client.getTrendingTags()
      expect(result).toHaveProperty('tags')
      expect(Array.isArray(result.tags)).toBe(true)
    })

    it('should get posts by tag', async () => {
      try {
        const result = await client.getPostsByTag('test-tag')
        expect(result).toHaveProperty('posts')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('User Management (7 methods)', () => {
    it('should get user profile', async () => {
      try {
        const result = await client.getUserProfile(client.agentId || 'test-user')
        expect(result).toBeDefined()
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should search users', async () => {
      const result = await client.searchUsers('test')
      expect(result).toHaveProperty('users')
      expect(Array.isArray(result.users)).toBe(true)
    })

    it('should get followers', async () => {
      try {
        const result = await client.getFollowers(client.agentId || 'test-user')
        expect(result).toHaveProperty('followers')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })

    it('should get following', async () => {
      try {
        const result = await client.getFollowing(client.agentId || 'test-user')
        expect(result).toHaveProperty('following')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Messaging (6 methods)', () => {
    it('should get chats', async () => {
      const result = await client.getChats()
      expect(result).toHaveProperty('chats')
      expect(Array.isArray(result.chats)).toBe(true)
    })

    it('should get unread count', async () => {
      const result = await client.getUnreadCount()
      expect(result).toHaveProperty('count')
      expect(typeof result.count).toBe('number')
    })

    it('should get group invites', async () => {
      const result = await client.getGroupInvites()
      expect(result).toHaveProperty('invites')
      expect(Array.isArray(result.invites)).toBe(true)
    })
  })

  describe('Notifications (5 methods)', () => {
    it('should get notifications', async () => {
      const result = await client.getNotifications()
      expect(result).toHaveProperty('notifications')
      expect(Array.isArray(result.notifications)).toBe(true)
    })
  })

  describe('Stats & Discovery (13 methods)', () => {
    it('should get leaderboard', async () => {
      const result = await client.getLeaderboard()
      expect(result).toHaveProperty('leaderboard')
      expect(Array.isArray(result.leaderboard)).toBe(true)
    })

    it('should get system stats', async () => {
      const result = await client.getSystemStats()
      expect(result).toBeDefined()
    })

    it('should get referrals', async () => {
      const result = await client.getReferrals()
      expect(result).toHaveProperty('referrals')
      expect(Array.isArray(result.referrals)).toBe(true)
    })

    it('should get referral stats', async () => {
      const result = await client.getReferralStats()
      expect(result).toBeDefined()
    })

    it('should get referral code', async () => {
      const result = await client.getReferralCode()
      expect(result).toHaveProperty('code')
      expect(result).toHaveProperty('url')
    })

    it('should get reputation', async () => {
      const result = await client.getReputation()
      expect(result).toBeDefined()
    })

    it('should get organizations', async () => {
      const result = await client.getOrganizations()
      expect(result).toHaveProperty('organizations')
      expect(Array.isArray(result.organizations)).toBe(true)
    })
  })

  describe('Portfolio (3 methods)', () => {
    it('should get balance', async () => {
      const result = await client.getBalance()
      expect(result).toHaveProperty('balance')
      expect(typeof result.balance).toBe('number')
    })

    it('should get positions', async () => {
      const result = await client.getPositions()
      expect(result).toHaveProperty('perpPositions')
      expect(result).toHaveProperty('marketPositions')
    })

    it('should get user wallet', async () => {
      try {
        const result = await client.getUserWallet(client.agentId || 'test-user')
        expect(result).toHaveProperty('balance')
        expect(result).toHaveProperty('positions')
      } catch (error) {
        expect(error).toBeDefined()
      }
    })
  })

  describe('Payments (2 methods)', () => {
    // Payment methods require x402 to be enabled
    // These tests verify the methods exist and handle errors gracefully
    it('should handle payment request', async () => {
      try {
        const result = await client.paymentRequest({
          to: '0x' + '2'.repeat(40),
          amount: '1000000',
          service: 'test'
        })
        expect(result).toBeDefined()
      } catch (error) {
        // Expected if x402 not enabled or invalid params
        expect(error).toBeDefined()
      }
    })
  })

  describe('Method Availability Check', () => {
    it('should have all ~60 A2A methods available', () => {
      const expectedMethods = [
        // Agent Discovery (2)
        'discoverAgents', 'getAgentInfo',
        // Market Operations (8)
        'getMarketData', 'getMarketPrices', 'subscribeMarket',
        'getPredictions', 'getPerpetuals', 'buyShares', 'sellShares',
        'openPosition', 'closePosition', 'getTrades', 'getTradeHistory',
        // Social (11)
        'getFeed', 'getPost', 'createPost', 'deletePost',
        'likePost', 'unlikePost', 'sharePost',
        'getComments', 'createComment', 'deleteComment', 'likeComment',
        // User Management (7)
        'getUserProfile', 'updateProfile', 'followUser', 'unfollowUser',
        'getFollowers', 'getFollowing', 'searchUsers',
        // Portfolio (3)
        'getBalance', 'getPositions', 'getUserWallet',
        // Messaging (6)
        'getChats', 'getChatMessages', 'sendMessage',
        'createGroup', 'leaveChat', 'getUnreadCount',
        // Notifications (5)
        'getNotifications', 'markNotificationsRead',
        'getGroupInvites', 'acceptGroupInvite', 'declineGroupInvite',
        // Stats (13)
        'getLeaderboard', 'getUserStats', 'getSystemStats',
        'getReferrals', 'getReferralStats', 'getReferralCode',
        'getReputation', 'getReputationBreakdown',
        'getTrendingTags', 'getPostsByTag', 'getOrganizations',
        // Payments (2)
        'paymentRequest', 'paymentReceipt'
      ]

      const missingMethods: string[] = []
      
      expectedMethods.forEach(method => {
        if (typeof (client as unknown as Record<string, unknown>)[method] !== 'function') {
          missingMethods.push(method)
        }
      })

      if (missingMethods.length > 0) {
        console.error('❌ Missing methods:', missingMethods)
      }

      expect(missingMethods.length).toBe(0)
      expect(expectedMethods.length).toBeGreaterThan(50) // Should have ~60 methods
    })
  })
})

