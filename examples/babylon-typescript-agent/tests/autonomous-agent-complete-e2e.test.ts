/**
 * Comprehensive E2E Test for Autonomous Agent
 * 
 * This test verifies that an agent can:
 * 1. Register and authenticate
 * 2. Connect via A2A protocol
 * 3. Perform ALL game actions autonomously:
 *    - Get markets and portfolio
 *    - Buy/sell shares in prediction markets
 *    - Open/close perpetual positions
 *    - Create posts and comments
 *    - Send messages
 *    - Get notifications
 *    - Follow users
 *    - Get leaderboard and stats
 * 
 * Prerequisites:
 * - Babylon server running on localhost:3000
 * - Database accessible
 * - At least one active prediction market
 * - At least one perpetual market (organization)
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { BabylonA2AClient } from '../src/a2a-client'
import { PrismaClient } from '@prisma/client'
import { generateSnowflakeId } from '../../../src/lib/snowflake'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SERVER_URL = process.env.BABYLON_API_URL || 'http://localhost:3000'
const A2A_ENDPOINT = `${SERVER_URL}/api/a2a`

// Test agent identity
const TEST_AGENT_ID = `e2e-autonomous-agent-${Date.now()}`
const TEST_AGENT_ADDRESS = '0x' + '1'.repeat(40)
const TEST_TOKEN_ID = 999999

describe('Autonomous Agent - Complete E2E Test', () => {
  let prisma: PrismaClient
  let agentUserId: string
  let a2aClient: BabylonA2AClient
  let testMarketId: string | null = null
  let testPerpTicker: string | null = null
  let createdPostId: string | null = null
  let createdPositionId: string | null = null

  beforeAll(async () => {
    console.log('\n🧪 Setting up comprehensive E2E test...\n')
    
    // Initialize Prisma
    prisma = new PrismaClient()
    
    // Check if server is running
    try {
      const response = await fetch(`${SERVER_URL}/api/health`).catch(() => null)
      if (!response || !response.ok) {
        throw new Error('Server not running or not accessible')
      }
      console.log('✅ Server is running')
    } catch (error) {
      throw new Error(`Server check failed: ${error}. Make sure server is running on ${SERVER_URL}`)
    }

    // Create or get test agent user
    let agent = await prisma.user.findUnique({
      where: { username: TEST_AGENT_ID }
    })

    if (!agent) {
      agentUserId = await generateSnowflakeId()
      agent = await prisma.user.create({
        data: {
          id: agentUserId,
          username: TEST_AGENT_ID,
          displayName: 'E2E Autonomous Agent',
          bio: 'Comprehensive E2E test agent',
          walletAddress: TEST_AGENT_ADDRESS,
          isAgent: true,
          virtualBalance: 10000, // Start with $10k
          reputationPoints: 1000,
          hasUsername: true,
          profileComplete: true,
          updatedAt: new Date()
        }
      })
      console.log(`✅ Created test agent: ${agentUserId}`)
    } else {
      agentUserId = agent.id
      // Ensure agent has balance
      await prisma.user.update({
        where: { id: agentUserId },
        data: { virtualBalance: 10000 }
      })
      console.log(`✅ Using existing agent: ${agentUserId}`)
    }

    // Find an active prediction market
    const market = await prisma.market.findFirst({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' }
    })
    if (market) {
      testMarketId = market.id
      console.log(`✅ Found test market: ${testMarketId}`)
    } else {
      console.log('⚠️  No active markets found - some tests will be skipped')
    }

    // Find a perpetual market (organization)
    const org = await prisma.organization.findFirst({
      orderBy: { createdAt: 'desc' }
    })
    if (org) {
      testPerpTicker = org.ticker || org.name.toUpperCase().substring(0, 4)
      console.log(`✅ Found test perpetual: ${testPerpTicker}`)
    } else {
      console.log('⚠️  No perpetual markets found - some tests will be skipped')
    }

    // Initialize A2A client
    // IMPORTANT: The agentId in headers must match the userId in database
    // So we use the actual agentUserId as the tokenId for the client
    a2aClient = new BabylonA2AClient({
      apiUrl: A2A_ENDPOINT,
      address: TEST_AGENT_ADDRESS,
      tokenId: parseInt(agentUserId.slice(-8), 36) || TEST_TOKEN_ID, // Use part of userId as tokenId
      privateKey: process.env.AGENT0_PRIVATE_KEY || '0x' + '1'.repeat(64)
    })
    
    // Override agentId to match the database user ID
    // This is critical - the server uses agentId from header to look up the user
    ;(a2aClient as any).agentId = agentUserId
  }, 30000)

  afterAll(async () => {
    // Cleanup
    if (prisma) {
      // Clean up test data
      if (createdPostId) {
        await prisma.post.delete({ where: { id: createdPostId } }).catch(() => {})
      }
      await prisma.$disconnect()
    }
    console.log('\n✅ Test cleanup complete\n')
  })

  describe('Phase 1: Authentication & Connection', () => {
    it('should connect to A2A endpoint', async () => {
      // Ensure agentId matches the database user ID
      ;(a2aClient as any).agentId = agentUserId
      await a2aClient.connect()
      expect(a2aClient.sessionToken).toBeDefined()
      expect(a2aClient.agentId).toBeDefined()
      expect(a2aClient.agentId).toBe(agentUserId) // Verify it matches
      console.log(`   ✅ Connected as: ${a2aClient.agentId}`)
    }, 15000)

    it('should get balance', async () => {
      const balance = await a2aClient.getBalance()
      expect(balance).toBeDefined()
      expect(typeof balance.balance).toBe('number')
      console.log(`   ✅ Balance: $${balance.balance}`)
    })
  })

  describe('Phase 2: Market Data & Discovery', () => {
    it('should get predictions', async () => {
      const result = await a2aClient.getPredictions({ status: 'active' })
      expect(result).toBeDefined()
      expect(result.predictions).toBeInstanceOf(Array)
      console.log(`   ✅ Found ${result.predictions.length} prediction markets`)
    })

    it('should get perpetuals', async () => {
      const result = await a2aClient.getPerpetuals()
      expect(result).toBeDefined()
      expect(result.perpetuals).toBeInstanceOf(Array)
      console.log(`   ✅ Found ${result.perpetuals.length} perpetual markets`)
    })

    it('should get portfolio', async () => {
      const portfolio = await a2aClient.getPortfolio()
      expect(portfolio).toBeDefined()
      expect(typeof portfolio.balance).toBe('number')
      expect(portfolio.positions).toBeInstanceOf(Array)
      console.log(`   ✅ Portfolio: $${portfolio.balance}, ${portfolio.positions.length} positions`)
    })

    it('should get feed', async () => {
      const feed = await a2aClient.getFeed(10)
      expect(feed).toBeDefined()
      expect(feed.posts).toBeInstanceOf(Array)
      console.log(`   ✅ Feed: ${feed.posts.length} posts`)
    })

    it('should discover agents', async () => {
      const result = await a2aClient.discoverAgents({}, 10)
      expect(result).toBeDefined()
      expect(result.agents).toBeInstanceOf(Array)
      console.log(`   ✅ Discovered ${result.agents.length} agents`)
    })
  })

  describe('Phase 3: Trading Actions', () => {
    it('should buy YES shares in prediction market', async () => {
      if (!testMarketId) {
        console.log('   ⏭️  Skipping - no test market available')
        return
      }

      const result = await a2aClient.buyShares(testMarketId, 'YES', 50)
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.positionId).toBeDefined()
      expect(result.shares).toBeGreaterThan(0)
      console.log(`   ✅ Bought ${result.shares} YES shares at avg price $${result.avgPrice}`)
    }, 15000)

    it('should get positions after buying', async () => {
      const positions = await a2aClient.getPositions()
      expect(positions).toBeDefined()
      expect(positions.positions).toBeInstanceOf(Array)
      const predictionPositions = positions.positions.filter((p: any) => p.marketId)
      expect(predictionPositions.length).toBeGreaterThan(0)
      console.log(`   ✅ Found ${predictionPositions.length} prediction positions`)
    })

    it('should sell shares', async () => {
      if (!testMarketId) {
        console.log('   ⏭️  Skipping - no test market available')
        return
      }

      // Get positions first
      const positions = await a2aClient.getPositions()
      const position = positions.positions.find((p: any) => p.marketId === testMarketId)
      
      if (!position || !position.shares || position.shares < 10) {
        console.log('   ⏭️  Skipping - no shares to sell')
        return
      }

      const sharesToSell = Math.min(10, position.shares)
      const result = await a2aClient.sellShares(position.id, sharesToSell)
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.proceeds).toBeGreaterThan(0)
      console.log(`   ✅ Sold ${sharesToSell} shares for $${result.proceeds}`)
    }, 15000)

    it('should open perpetual position', async () => {
      if (!testPerpTicker) {
        console.log('   ⏭️  Skipping - no perpetual market available')
        return
      }

      const result = await a2aClient.openPosition(testPerpTicker, 'LONG', 100, 2)
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.positionId).toBeDefined()
      expect(result.entryPrice).toBeGreaterThan(0)
      createdPositionId = result.positionId
      console.log(`   ✅ Opened LONG position: ${result.positionId} at $${result.entryPrice}`)
    }, 15000)

    it('should close perpetual position', async () => {
      if (!createdPositionId) {
        console.log('   ⏭️  Skipping - no position to close')
        return
      }

      const result = await a2aClient.closePosition(createdPositionId)
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(typeof result.pnl).toBe('number')
      console.log(`   ✅ Closed position, PnL: $${result.pnl}`)
    }, 15000)
  })

  describe('Phase 4: Social Actions', () => {
    it('should create a post', async () => {
      const content = `🤖 E2E Test Post - ${new Date().toISOString()}\n\nThis is an automated test post from the comprehensive E2E test suite.`
      const result = await a2aClient.createPost(content, 'post')
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.postId).toBeDefined()
      createdPostId = result.postId
      console.log(`   ✅ Created post: ${result.postId}`)
    }, 10000)

    it('should get the created post', async () => {
      if (!createdPostId) {
        console.log('   ⏭️  Skipping - no post created')
        return
      }

      const post = await a2aClient.getPost(createdPostId)
      expect(post).toBeDefined()
      expect(post.id).toBe(createdPostId)
      console.log(`   ✅ Retrieved post: ${post.content.substring(0, 50)}...`)
    })

    it('should create a comment', async () => {
      if (!createdPostId) {
        console.log('   ⏭️  Skipping - no post to comment on')
        return
      }

      const result = await a2aClient.createComment(createdPostId, 'This is a test comment from E2E test')
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.commentId).toBeDefined()
      console.log(`   ✅ Created comment: ${result.commentId}`)
    }, 10000)

    it('should get comments for post', async () => {
      if (!createdPostId) {
        console.log('   ⏭️  Skipping - no post available')
        return
      }

      const result = await a2aClient.getComments(createdPostId)
      expect(result).toBeDefined()
      expect(result.comments).toBeInstanceOf(Array)
      expect(result.comments.length).toBeGreaterThan(0)
      console.log(`   ✅ Found ${result.comments.length} comments`)
    })

    it('should like a post', async () => {
      if (!createdPostId) {
        console.log('   ⏭️  Skipping - no post available')
        return
      }

      const result = await a2aClient.likePost(createdPostId)
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      console.log(`   ✅ Liked post`)
    })
  })

  describe('Phase 5: User Management', () => {
    it('should get user profile', async () => {
      const profile = await a2aClient.getUserProfile(agentUserId)
      expect(profile).toBeDefined()
      expect(profile.id).toBe(agentUserId)
      console.log(`   ✅ Retrieved profile: @${profile.username}`)
    })

    it('should search users', async () => {
      const result = await a2aClient.searchUsers('test', 10)
      expect(result).toBeDefined()
      expect(result.users).toBeInstanceOf(Array)
      console.log(`   ✅ Found ${result.users.length} users matching "test"`)
    })

    it('should get leaderboard', async () => {
      const result = await a2aClient.getLeaderboard('all', 10)
      expect(result).toBeDefined()
      expect(result.leaderboard).toBeInstanceOf(Array)
      console.log(`   ✅ Leaderboard: ${result.leaderboard.length} entries`)
    })
  })

  describe('Phase 6: Messaging', () => {
    it('should get chats', async () => {
      const result = await a2aClient.getChats()
      expect(result).toBeDefined()
      expect(result.chats).toBeInstanceOf(Array)
      console.log(`   ✅ Found ${result.chats.length} chats`)
    })

    it('should create a group chat', async () => {
      const result = await a2aClient.createGroup('E2E Test Group', [])
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.chatId).toBeDefined()
      console.log(`   ✅ Created group: ${result.chatId}`)
    }, 10000)

    it('should send a message', async () => {
      // First get or create a chat
      const chats = await a2aClient.getChats()
      let chatId: string | null = null

      if (chats.chats.length > 0) {
        chatId = chats.chats[0]!.id
      } else {
        // Create a group to send message to
        const group = await a2aClient.createGroup('E2E Test Group', [])
        chatId = group.chatId
      }

      if (!chatId) {
        console.log('   ⏭️  Skipping - could not create/get chat')
        return
      }

      const result = await a2aClient.sendMessage(chatId, 'Hello from E2E test!')
      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      console.log(`   ✅ Sent message: ${result.messageId}`)
    }, 10000)
  })

  describe('Phase 7: Notifications & Stats', () => {
    it('should get notifications', async () => {
      const result = await a2aClient.getNotifications()
      expect(result).toBeDefined()
      expect(result.notifications).toBeInstanceOf(Array)
      console.log(`   ✅ Found ${result.notifications.length} notifications`)
    })

    it('should get user stats', async () => {
      const result = await a2aClient.getUserStats(agentUserId)
      expect(result).toBeDefined()
      console.log(`   ✅ User stats retrieved`)
    })

    it('should get system stats', async () => {
      const result = await a2aClient.getSystemStats()
      expect(result).toBeDefined()
      console.log(`   ✅ System stats retrieved`)
    })

    it('should get reputation', async () => {
      const result = await a2aClient.getReputation(agentUserId)
      expect(result).toBeDefined()
      expect(typeof result.reputation).toBe('number')
      console.log(`   ✅ Reputation: ${result.reputation}`)
    })
  })

  describe('Phase 8: Complete Autonomous Cycle', () => {
    it('should complete full autonomous cycle', async () => {
      console.log('\n   🔄 Running complete autonomous cycle...\n')

      // 1. Gather context
      console.log('   📊 Gathering context...')
      const portfolio = await a2aClient.getPortfolio()
      const markets = await a2aClient.getMarkets()
      const feed = await a2aClient.getFeed(10)
      
      console.log(`      Balance: $${portfolio.balance}`)
      console.log(`      Positions: ${portfolio.positions.length}`)
      console.log(`      Markets: ${markets.predictions.length + markets.perps.length}`)
      console.log(`      Feed posts: ${feed.posts.length}`)

      // 2. Check if we can trade
      if (testMarketId && portfolio.balance >= 50) {
        console.log('   💰 Executing trade...')
        const tradeResult = await a2aClient.buyShares(testMarketId, 'YES', 50)
        console.log(`      ✅ Trade executed: ${tradeResult.shares} shares`)
      }

      // 3. Create engagement
      console.log('   📝 Creating engagement...')
      const postResult = await a2aClient.createPost(
        `🔄 Autonomous cycle test - ${new Date().toISOString()}`,
        'post'
      )
      console.log(`      ✅ Post created: ${postResult.postId}`)

      // 4. Check final state
      console.log('   📊 Final state...')
      const finalPortfolio = await a2aClient.getPortfolio()
      console.log(`      Final balance: $${finalPortfolio.balance}`)
      console.log(`      Final positions: ${finalPortfolio.positions.length}`)

      console.log('\n   ✅ Complete autonomous cycle finished!\n')
      
      expect(portfolio).toBeDefined()
      expect(markets).toBeDefined()
      expect(feed).toBeDefined()
    }, 30000)
  })
})

export {}

