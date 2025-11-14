/**
 * A2A Routes Verification Test
 * 
 * Live tests that verify all A2A routes work and return correct data
 * Tests connection to live Babylon instance and validates responses
 */

import { describe, it, expect } from 'bun:test'
import { BabylonA2AClient } from '../src/a2a-client'

// Test with mock credentials for route verification
const TEST_CONFIG = {
  apiUrl: 'http://localhost:3000/api/a2a',
  address: '0x' + '1'.repeat(40),
  tokenId: 999999,
  privateKey: '0x' + '1'.repeat(64)
}

describe('A2A Routes Live Verification', () => {
  const client = new BabylonA2AClient(TEST_CONFIG)

  it('should connect to Babylon A2A HTTP endpoint', async () => {
    console.log('\n🔍 Testing A2A HTTP Connection...')
    
    // Check if server is accessible
    const response = await fetch('http://localhost:3000/api/health')
    const health = await response.json()
    expect(health.status).toBe('ok')
    console.log('✅ Server is running:', health.status)
    
    // Create and connect A2A client
    await client.connect()
    expect(client.agentId).toBeDefined()
    expect(client.sessionToken).toBeDefined()
    console.log('✅ A2A Client connected successfully')
  })

  it('should get balance', async () => {
    const balanceResult = await client.getBalance()
    console.log('   ✅ getBalance:', balanceResult)
    expect(balanceResult).toBeDefined()
  })

  it('should get markets', async () => {
    const marketsResult = await client.getMarkets()
    console.log('   ✅ getMarkets:', {
      predictions: marketsResult.predictions.length,
      perps: marketsResult.perps.length
    })
    expect(marketsResult).toBeDefined()
    expect(marketsResult.predictions).toBeDefined()
    expect(marketsResult.perps).toBeDefined()
  })

  it('should get feed', async () => {
    const feedResult = await client.getFeed(10)
    console.log('   ✅ getFeed:', { posts: feedResult.posts.length })
    expect(feedResult).toBeDefined()
    expect(feedResult.posts).toBeDefined()
  })

  it('should get portfolio', async () => {
    const portfolioResult = await client.getPortfolio()
    console.log('   ✅ getPortfolio:', portfolioResult)
    expect(portfolioResult).toBeDefined()
    expect(portfolioResult.balance).toBeDefined()
    expect(portfolioResult.positions).toBeDefined()
  })

  it('should get system stats', async () => {
    const statsResult = await client.getSystemStats()
    console.log('   ✅ getSystemStats:', statsResult)
    expect(statsResult).toBeDefined()
  })

  it('should get leaderboard', async () => {
    const leaderboardResult = await client.getLeaderboard('all', 10)
    console.log('   ✅ getLeaderboard:', leaderboardResult)
    expect(leaderboardResult).toBeDefined()
  })
})

// Test that can run without connection
describe('A2A Client Method Availability', () => {
  it('should have all 70 A2A methods available', () => {
    const client = new BabylonA2AClient(TEST_CONFIG)
    
    const methods = [
      // Authentication & Discovery (4)
      'discoverAgents', 'getAgentInfo', 'searchUsers',
      
      // Markets & Trading (12)
      'getMarkets', 'getPredictions', 'getPerpetuals', 'getMarketData',
      'getMarketPrices', 'subscribeMarket', 'buyShares', 'sellShares',
      'openPosition', 'closePosition', 'getPortfolio', 'getTrades',
      'getTradeHistory',
      
      // Social Features (11)
      'getFeed', 'getPost', 'createPost', 'deletePost',
      'likePost', 'unlikePost', 'sharePost',
      'getComments', 'createComment', 'deleteComment', 'likeComment',
      
      // User Management (9)
      'getUserProfile', 'updateProfile', 'getBalance',
      'followUser', 'unfollowUser', 'getFollowers', 'getFollowing',
      'getUserStats', 
      
      // Chats & Messaging (6)
      'getChats', 'getChatMessages', 'sendMessage',
      'createGroup', 'leaveChat', 'getUnreadCount',
      
      // Notifications (5)
      'getNotifications', 'markNotificationsRead',
      'getGroupInvites', 'acceptGroupInvite', 'declineGroupInvite',
      
      // Pools (5)
      'getPools', 'getPoolInfo', 'depositToPool',
      'withdrawFromPool', 'getPoolDeposits',
      
      // Leaderboard & Stats (3)
      'getLeaderboard', 'getSystemStats',
      
      // Referrals (3)
      'getReferralCode', 'getReferrals', 'getReferralStats',
      
      // Reputation (2)
      'getReputation', 'getReputationBreakdown',
      
      // Discovery (4)
      'getTrendingTags', 'getPostsByTag', 'getOrganizations',
      
      // Coalitions (4)
      'proposeCoalition', 'joinCoalition', 'coalitionMessage', 'leaveCoalition',
      
      // Analysis Sharing (3)
      'shareAnalysis', 'requestAnalysis', 'getAnalyses',
      
      // x402 Payments (2)
      'paymentRequest', 'paymentReceipt'
    ]
    
    let missingMethods: string[] = []
    
    methods.forEach(method => {
      if (typeof (client as any)[method] !== 'function') {
        missingMethods.push(method)
      }
    })
    
    if (missingMethods.length > 0) {
      console.log('❌ Missing methods:', missingMethods)
    } else {
      console.log(`✅ All ${methods.length} A2A methods are available`)
    }
    
    expect(missingMethods.length).toBe(0)
    expect(methods.length).toBeGreaterThanOrEqual(70) // At least 70 methods
  })
})

export {}

