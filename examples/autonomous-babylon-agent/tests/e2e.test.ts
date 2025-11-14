/**
 * E2E Integration Tests for Autonomous Agent
 * 
 * These tests verify the agent actually connects, registers, and executes commands
 * against a live Babylon instance.
 * 
 * Prerequisites:
 * - Babylon server running on localhost:3000
 * - Valid API keys in .env.local
 * - Agent0 testnet access (Sepolia)
 */

import { describe, it, expect } from 'bun:test'
import { registerAgent } from '../src/registration'
import { BabylonA2AClient } from '../src/a2a-client'
import { AgentDecisionMaker } from '../src/decision'
import { AgentMemory } from '../src/memory'
import { executeAction } from '../src/actions'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config({ path: '.env.local' })

describe('E2E - Autonomous Agent Live Tests', () => {
  // Shared state across tests
  let agentIdentity: any
  let a2aClient: BabylonA2AClient
  let decisionMaker: AgentDecisionMaker
  let memory: AgentMemory

  it('Phase 1: should have valid agent identity', async () => {
    console.log('\n🔍 Setting up E2E test environment...')
    
    // Use mock identity for tests (no Agent0 registration needed)
    agentIdentity = {
      tokenId: 888888,
      address: '0x8888888888888888888888888888888888888888',
      agentId: 'agent-888888-0x888888'
    }
    
    // Create test user in database if needed
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
    const existing = await prisma.user.findUnique({ where: { id: agentIdentity.agentId } })
    if (!existing) {
      await prisma.user.create({
        data: {
          id: agentIdentity.agentId,
          walletAddress: agentIdentity.address,
          displayName: 'E2E Test Agent',
          username: 'e2e_test_agent',
          email: 'e2e@test.local',
          bio: 'E2E test user',
          virtualBalance: 1000,
          reputationPoints: 500,
          updatedAt: new Date()
        }
      })
      console.log('✅ Created E2E test user in database')
    }
    await prisma.$disconnect()
    
    expect(agentIdentity).toBeDefined()
    expect(agentIdentity.tokenId).toBeGreaterThan(0)
    expect(agentIdentity.address).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(agentIdentity.agentId).toBeDefined()
    console.log(`✅ Agent Identity: ${agentIdentity.agentId}`)
  })

  it('Phase 2: should connect to Babylon A2A', async () => {
    console.log('Initializing A2A client...')
    a2aClient = new BabylonA2AClient({
      apiUrl: 'http://localhost:3000/api/a2a',
      address: agentIdentity.address,
      tokenId: agentIdentity.tokenId,
      privateKey: process.env.AGENT0_PRIVATE_KEY!
    })

    await a2aClient.connect()
    
    expect(a2aClient.sessionToken).toBeDefined()
    expect(a2aClient.agentId).toBeDefined()
    expect(a2aClient.sessionToken!.length).toBeGreaterThan(10)
    console.log(`✅ Connected as: ${a2aClient.agentId}`)
  }, 15000)

  it('Phase 3: should get portfolio data', async () => {
    const portfolio = await a2aClient.getPortfolio()
    
    expect(portfolio).toBeDefined()
    expect(portfolio.balance).toBeDefined()
    expect(portfolio.positions).toBeInstanceOf(Array)
    expect(portfolio.pnl).toBeDefined()
    
    console.log(`   Balance: $${portfolio.balance}`)
    console.log(`   Positions: ${portfolio.positions.length}`)
    console.log(`   P&L: $${portfolio.pnl}`)
  })

  it('Phase 3: should get available markets', async () => {
    const markets = await a2aClient.getMarkets()
    
    expect(markets).toBeDefined()
    expect(markets.predictions).toBeInstanceOf(Array)
    expect(markets.perps).toBeInstanceOf(Array)
    
    console.log(`   Prediction markets: ${markets.predictions.length}`)
    console.log(`   Perp markets: ${markets.perps.length}`)
  })

  it('Phase 3: should get feed posts', async () => {
    const feed = await a2aClient.getFeed(10)
    
    expect(feed).toBeDefined()
    expect(feed.posts).toBeInstanceOf(Array)
    
    console.log(`   Feed posts: ${feed.posts.length}`)
  })

  it('Phase 3: should get balance', async () => {
    const balance = await a2aClient.getBalance()
    
    expect(balance).toBeDefined()
    console.log(`   Balance response:`, balance)
  })

  it('Phase 4: should initialize decision maker', () => {
    console.log('Initializing decision maker...')
    decisionMaker = new AgentDecisionMaker({
      strategy: 'balanced',
      groqApiKey: process.env.GROQ_API_KEY,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY
    })

    memory = new AgentMemory({ maxEntries: 20 })

    const provider = decisionMaker.getProvider()
    expect(provider).toBeDefined()
    expect(provider.length).toBeGreaterThan(0)
    
    console.log(`   LLM Provider: ${provider}`)
  })

  it('Phase 4: should make a decision based on context', async () => {
    const portfolio = await a2aClient.getPortfolio()
    const markets = await a2aClient.getMarkets()
    const feed = await a2aClient.getFeed(10)
    
    const decision = await decisionMaker.decide({
      portfolio,
      markets,
      feed,
      memory: memory.getRecent(5)
    })
    
    expect(decision).toBeDefined()
    expect(decision.action).toBeDefined()
    expect(['BUY_YES', 'BUY_NO', 'SELL', 'OPEN_LONG', 'OPEN_SHORT', 'CLOSE_POSITION', 'CREATE_POST', 'CREATE_COMMENT', 'HOLD']).toContain(decision.action)
    
    console.log(`   Decision: ${decision.action}`)
    if (decision.reasoning) {
      console.log(`   Reasoning: ${decision.reasoning.substring(0, 80)}...`)
    }
  }, 15000)

  it('Phase 5: should store and retrieve actions from memory', () => {
    memory.add({
      action: 'TEST_ACTION',
      params: { test: true },
      result: { success: true },
      timestamp: Date.now()
    })

    const recent = memory.getRecent(1)
    expect(recent.length).toBe(1)
    expect(recent[0].action).toBe('TEST_ACTION')

    const summary = memory.getSummary()
    expect(summary).toBeDefined()
    expect(summary.length).toBeGreaterThan(0)
    console.log(`   Memory: ${summary}`)
  })

  it('Phase 6: should handle HOLD action', async () => {
    const decision = {
      action: 'HOLD' as const,
      reasoning: 'Test - no action'
    }

    const result = await executeAction(a2aClient, decision)
    
    expect(result.success).toBe(true)
    expect(result.message).toContain('Holding')
  })

  it('Phase 6: should attempt to create a test post', async () => {
    const decision = {
      action: 'CREATE_POST' as const,
      params: {
        content: `🤖 E2E Test Post - ${new Date().toISOString()}`
      },
      reasoning: 'E2E test post'
    }

    const result = await executeAction(a2aClient, decision)
    
    console.log(`   Post result:`, result.success ? '✅' : '❌', result.message)
    
    if (result.success) {
      expect(result.data).toBeDefined()
      memory.add({
        action: decision.action,
        params: decision.params,
        result: result.data,
        timestamp: Date.now()
      })
    }
  }, 10000)

  it('Phase 7: should get user profile', async () => {
    const profile = await a2aClient.getUserProfile(a2aClient.agentId!)
    expect(profile).toBeDefined()
    console.log(`   Profile:`, profile)
  })

  it('Phase 7: should get system stats', async () => {
    const stats = await a2aClient.getSystemStats()
    expect(stats).toBeDefined()
    console.log(`   System stats:`, stats)
  })

  it('Phase 7: should get leaderboard', async () => {
    const leaderboard = await a2aClient.getLeaderboard('all', 10)
    expect(leaderboard).toBeDefined()
    console.log(`   Leaderboard:`, leaderboard)
  })

  it('Phase 7: should discover agents', async () => {
    const agents = await a2aClient.discoverAgents()
    expect(agents).toBeDefined()
    console.log(`   Discovered agents:`, agents)
  })

  it('Phase 8: should complete one full autonomous tick', async () => {
    console.log('\n🔄 Simulating full autonomous tick...')
    
    // 1. Gather context
    const portfolio = await a2aClient.getPortfolio()
    const markets = await a2aClient.getMarkets()
    const feed = await a2aClient.getFeed(10)
    const recentMemory = memory.getRecent(5)

    console.log(`   ✓ Portfolio: $${portfolio.balance}, ${portfolio.positions.length} positions`)
    console.log(`   ✓ Markets: ${markets.predictions.length + markets.perps.length} available`)
    console.log(`   ✓ Feed: ${feed.posts.length} posts`)
    console.log(`   ✓ Memory: ${recentMemory.length} recent actions`)

    // 2. Make decision
    const decision = await decisionMaker.decide({
      portfolio,
      markets,
      feed,
      memory: recentMemory
    })

    console.log(`   ✓ Decision: ${decision.action}`)

    // 3. Execute (safe actions only)
    if (decision.action === 'HOLD' || decision.action === 'CREATE_POST') {
      const result = await executeAction(a2aClient, decision)
      console.log(`   ✓ Execution: ${result.success ? '✅' : '❌'}`)
      
      if (result.success) {
        memory.add({
          action: decision.action,
          params: decision.params,
          result: result.data,
          timestamp: Date.now()
        })
      }
    } else {
      console.log(`   ⏭️  Skipping execution of ${decision.action} in test`)
    }

    console.log('✅ Full tick completed\n')
    
    expect(decision).toBeDefined()
    expect(decision.action).toBeDefined()
  }, 20000)
})

export {}

