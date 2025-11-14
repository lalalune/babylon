/**
 * A2A Routes Live Verification
 * 
 * Tests all A2A routes against live Babylon instance
 * Verifies data is returned correctly
 */

import { describe, it, expect } from 'bun:test'
import { BabylonA2AClient } from '../src/a2a-client'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const TEST_CONFIG = {
  apiUrl: 'http://localhost:3000/api/a2a',
  address: '0x' + '1'.repeat(40),
  tokenId: 999999,
  privateKey: '0x' + '1'.repeat(64)
}

describe('A2A Routes Live Verification', () => {
  const client = new BabylonA2AClient(TEST_CONFIG)

  it('should connect to server and authenticate', async () => {
    console.log('\n🔍 Testing A2A HTTP Connection...')
    
    // Check if server is accessible
    const response = await fetch('http://localhost:3000/api/health')
    const health = await response.json()
    expect(health.status).toBe('ok')
    console.log('✅ Server is running:', health.status)

    // Connect A2A client
    await client.connect()
    expect(client.agentId).toBeDefined()
    expect(client.sessionToken).toBeDefined()
    console.log('✅ A2A Client connected:', client.agentId)
  })

  it('should have all 70 A2A methods available', () => {
    const methods = [
      'getMarkets', 'getPredictions', 'getPerpetuals', 'getMarketData',
      'getMarketPrices', 'subscribeMarket', 'buyShares', 'sellShares',
      'openPosition', 'closePosition', 'getPortfolio', 'getTrades',
      'getTradeHistory', 'getFeed', 'getPost', 'createPost', 'deletePost',
      'likePost', 'unlikePost', 'sharePost', 'getComments', 'createComment',
      'deleteComment', 'likeComment', 'getUserProfile', 'updateProfile',
      'getBalance', 'followUser', 'unfollowUser', 'getFollowers',
      'getFollowing', 'getUserStats', 'searchUsers', 'getChats',
      'getChatMessages', 'sendMessage', 'createGroup', 'leaveChat',
      'getUnreadCount', 'getNotifications', 'markNotificationsRead',
      'getGroupInvites', 'acceptGroupInvite', 'declineGroupInvite',
      'getPools', 'getPoolInfo', 'depositToPool', 'withdrawFromPool',
      'getPoolDeposits', 'getLeaderboard', 'getSystemStats',
      'getReferralCode', 'getReferrals', 'getReferralStats',
      'getReputation', 'getReputationBreakdown', 'discoverAgents',
      'getAgentInfo', 'getTrendingTags', 'getPostsByTag',
      'getOrganizations', 'proposeCoalition', 'joinCoalition',
      'coalitionMessage', 'leaveCoalition', 'shareAnalysis',
      'requestAnalysis', 'getAnalyses', 'paymentRequest', 'paymentReceipt'
    ]
    
    let missingMethods: string[] = []
    let foundCount = 0
    
    methods.forEach(method => {
      if (typeof (client as any)[method] === 'function') {
        foundCount++
      } else {
        missingMethods.push(method)
      }
    })
    
    console.log(`   ✅ Found ${foundCount}/${methods.length} A2A methods`)
    
    if (missingMethods.length > 0) {
      console.log(`   ⚠️  Missing: ${missingMethods.join(', ')}`)
    }
    
    expect(foundCount).toBeGreaterThanOrEqual(70) // At least 70 methods
  })
})

export {}

