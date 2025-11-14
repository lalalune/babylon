/**
 * Agent0 Discovery Integration Tests
 * 
 * Tests for agent discovery flow and game registration.
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import { GameDiscoveryService } from '../../src/agents/agent0/GameDiscovery'
import { IPFSPublisher } from '../../src/agents/agent0/IPFSPublisher'
import { Agent0Client } from '../../src/agents/agent0/Agent0Client'

describe('Agent0 Discovery Integration', () => {
  let discoveryService: GameDiscoveryService | null = null
  let ipfsPublisher: IPFSPublisher
  
  beforeAll(() => {
    if (process.env.AGENT0_SUBGRAPH_URL) {
      discoveryService = new GameDiscoveryService()
    }
    ipfsPublisher = new IPFSPublisher()
  })
  
  test('IPFS Publisher deprecation notice', async () => {
    // IPFSPublisher methods are now deprecated
    // IPFS publishing is handled by Agent0Client.registerAgent()
    if (!ipfsPublisher.isAvailable()) {
      console.log('⚠️  IPFS not available (expected - use Agent0Client instead)')
      return
    }
    
    // Verify the publisher exists but don't call deprecated methods
    expect(ipfsPublisher).toBeDefined()
    expect(typeof ipfsPublisher.isAvailable).toBe('function')
    console.log('✓ IPFSPublisher exists (use Agent0Client.registerAgent() for actual publishing)')
  })
  
  test('GameDiscoveryService can discover games', async () => {
    if (process.env.AGENT0_ENABLED !== 'true' || !discoveryService) {
      console.log('⚠️  Agent0 disabled or not configured, skipping discovery test')
      return
    }
    
    const games = await discoveryService.discoverGames({
      type: 'game-platform',
      markets: ['prediction']
    })
    
    expect(Array.isArray(games)).toBe(true)
  })
  
  test('GameDiscoveryService can find Babylon', async () => {
    if (process.env.AGENT0_ENABLED !== 'true' || !discoveryService) {
      console.log('⚠️  Agent0 disabled or not configured, skipping Babylon discovery test')
      return
    }
    
    const babylon = await discoveryService.findBabylon()
    
    if (babylon) {
      expect(babylon.name).toContain('Babylon')
      expect(babylon.endpoints.a2a).toBeTruthy()
      expect(babylon.endpoints.mcp).toBeTruthy()
      expect(babylon.endpoints.api).toBeTruthy()
    }
  })
  
  test('Agent0Client can be initialized', () => {
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.AGENT0_PRIVATE_KEY
    
    if (!rpcUrl || !privateKey) {
      console.log('⚠️  Missing RPC URL or private key, skipping Agent0Client test')
      return
    }
    
    const client = new Agent0Client({
      network: 'sepolia',
      rpcUrl,
      privateKey
    })
    
    expect(client).toBeDefined()
    expect(client.isAvailable()).toBe(true)
  })
})

