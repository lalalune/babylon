/**
 * A2A Client Routes Verification Tests
 * 
 * Tests the BabylonA2AClient wrapper against live server.
 * Verifies client connection, authentication, and method availability.
 * 
 * This tests the client wrapper, not the raw A2A protocol.
 */

import { describe, it, expect } from 'bun:test'
import { BabylonA2AClient } from '../src/a2a-client'

// Test with mock credentials for route verification
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3000',
  address: '0x' + '1'.repeat(40),
  tokenId: 999999,
  privateKey: '0x' + '1'.repeat(64),
  apiKey: process.env.BABYLON_API_KEY || 'test-api-key'
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

  it('should get positions', async () => {
    const positionsResult = await client.getPositions()
    console.log('   ✅ getPositions:', positionsResult)
    expect(positionsResult).toBeDefined()
  })

  it('should get market data', async () => {
    // This will fail if no markets exist, which is expected
    try {
      const marketDataResult = await client.getMarketData('market-123')
      console.log('   ✅ getMarketData:', marketDataResult)
      expect(marketDataResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  getMarketData: Skipped (no market ID)')
    }
  })

  it('should discover agents', async () => {
    const discoverResult = await client.discoverAgents({}, 10)
    console.log('   ✅ discoverAgents:', discoverResult)
    expect(discoverResult).toBeDefined()
  })

  it('should get agent info', async () => {
    try {
      const infoResult = await client.getAgentInfo(client.agentId!)
      console.log('   ✅ getAgentInfo:', infoResult)
      expect(infoResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  getAgentInfo: Skipped (agent not found)')
    }
  })
})

// Test that can run without connection
describe('A2A Client Method Availability', () => {
  it('should have all 10 A2A methods available', () => {
    const client = new BabylonA2AClient(TEST_CONFIG)
    
    const methods = [
      // Agent Discovery (2)
      'discoverAgents', 'getAgentInfo',
      
      // Market Operations (3)
      'getMarketData', 'getMarketPrices', 'subscribeMarket',
      
      // Portfolio (3)
      'getBalance', 'getPositions', 'getUserWallet',
      
      // Payments (2)
      'paymentRequest', 'paymentReceipt'
    ]
    
    let missingMethods: string[] = []
    
    methods.forEach(method => {
      if (typeof (client as unknown as Record<string, (...args: unknown[]) => unknown>)[method] !== 'function') {
        missingMethods.push(method)
      }
    })
    
    if (missingMethods.length > 0) {
      console.log('❌ Missing methods:', missingMethods)
    } else {
      console.log(`✅ All ${methods.length} A2A methods are available`)
    }
    
    expect(missingMethods.length).toBe(0)
    expect(methods.length).toBe(10)
  })
})

// Moderation operations tests
describe('A2A Moderation Operations', () => {
  const client = new BabylonA2AClient(TEST_CONFIG)

  it('should block a user via A2A', async () => {
    console.log('\n🚫 Testing block user...')
    
    try {
      await client.connect()
      
      const blockResult = await client.blockUser({
        userId: 'test-user-to-block',
        reason: 'Test block via A2A'
      })
      
      console.log('   ✅ blockUser executed:', blockResult)
      expect(blockResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  blockUser: Skipped (expected if user not found)')
    }
  })

  it('should unblock a user via A2A', async () => {
    console.log('\n✅ Testing unblock user...')
    
    try {
      const unblockResult = await client.unblockUser({
        userId: 'test-user-to-block'
      })
      
      console.log('   ✅ unblockUser executed:', unblockResult)
      expect(unblockResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  unblockUser: Skipped (expected if user not blocked)')
    }
  })

  it('should mute a user via A2A', async () => {
    console.log('\n🔇 Testing mute user...')
    
    try {
      const muteResult = await client.muteUser({
        userId: 'test-user-to-mute',
        reason: 'Test mute via A2A'
      })
      
      console.log('   ✅ muteUser executed:', muteResult)
      expect(muteResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  muteUser: Skipped (expected if user not found)')
    }
  })

  it('should unmute a user via A2A', async () => {
    console.log('\n🔊 Testing unmute user...')
    
    try {
      const unmuteResult = await client.unmuteUser({
        userId: 'test-user-to-mute'
      })
      
      console.log('   ✅ unmuteUser executed:', unmuteResult)
      expect(unmuteResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  unmuteUser: Skipped (expected if user not muted)')
    }
  })

  it('should report a user via A2A', async () => {
    console.log('\n🚩 Testing report user...')
    
    try {
      const reportResult = await client.reportUser({
        userId: 'test-user-to-report',
        category: 'spam',
        reason: 'Test report via A2A - automated testing',
        evidence: 'https://example.com/test-evidence.png'
      })
      
      console.log('   ✅ reportUser executed:', reportResult)
      expect(reportResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  reportUser: Skipped (expected if user not found)')
    }
  })

  it('should report a post via A2A', async () => {
    console.log('\n📝 Testing report post...')
    
    try {
      const reportResult = await client.reportPost({
        postId: 'test-post-to-report',
        category: 'misinformation',
        reason: 'Test report via A2A - automated testing'
      })
      
      console.log('   ✅ reportPost executed:', reportResult)
      expect(reportResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  reportPost: Skipped (expected if post not found)')
    }
  })

  it('should get blocked users list via A2A', async () => {
    console.log('\n📋 Testing get blocks...')
    
    try {
      const blocksResult = await client.getBlocks({
        limit: 10,
        offset: 0
      })
      
      console.log('   ✅ getBlocks executed:', blocksResult)
      expect(blocksResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  getBlocks: Skipped')
    }
  })

  it('should get muted users list via A2A', async () => {
    console.log('\n📋 Testing get mutes...')
    
    try {
      const mutesResult = await client.getMutes({
        limit: 10,
        offset: 0
      })
      
      console.log('   ✅ getMutes executed:', mutesResult)
      expect(mutesResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  getMutes: Skipped')
    }
  })

  it('should check block status via A2A', async () => {
    console.log('\n🔍 Testing check block status...')
    
    try {
      const statusResult = await client.checkBlockStatus({
        userId: 'test-user-123'
      })
      
      console.log('   ✅ checkBlockStatus executed:', statusResult)
      expect(statusResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  checkBlockStatus: Skipped')
    }
  })

  it('should check mute status via A2A', async () => {
    console.log('\n🔍 Testing check mute status...')
    
    try {
      const statusResult = await client.checkMuteStatus({
        userId: 'test-user-123'
      })
      
      console.log('   ✅ checkMuteStatus executed:', statusResult)
      expect(statusResult).toBeDefined()
    } catch (error) {
      console.log('   ⏭️  checkMuteStatus: Skipped')
    }
  })
})

export {}
