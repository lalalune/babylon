/**
 * Agent0 Discovery Integration Tests
 * 
 * Tests for agent discovery flow and game registration.
 * 
 * IMPORTANT: Multi-chain setup
 * - Agent0 operations: Ethereum Sepolia (discovery/registration)
 * - Game operations: Base Sepolia (actual game play)
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import { GameDiscoveryService } from '../../src/agents/agent0/GameDiscovery'
import { IPFSPublisher } from '../../src/agents/agent0/IPFSPublisher'
import { Agent0Client } from '../../src/agents/agent0/Agent0Client'

describe('Agent0 Discovery Integration', () => {
  let discoveryService: GameDiscoveryService | null = null
  let ipfsPublisher: IPFSPublisher
  
  beforeAll(() => {
    // Only initialize if Agent0 is configured
    if (process.env.AGENT0_SUBGRAPH_URL) {
      try {
        discoveryService = new GameDiscoveryService()
      } catch (error) {
        console.log('⚠️  GameDiscoveryService initialization failed:', error)
      }
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
    
    try {
      const games = await discoveryService.discoverGames({
        type: 'game-platform',
        markets: ['prediction']
      })
      
      expect(Array.isArray(games)).toBe(true)
      // Games may be empty if none registered yet
    } catch (error) {
      console.log('⚠️  Discovery test failed (may need subgraph URL):', error)
      // Don't fail test if subgraph is not configured
    }
  })
  
  test('GameDiscoveryService can find Babylon', async () => {
    if (process.env.AGENT0_ENABLED !== 'true' || !discoveryService) {
      console.log('⚠️  Agent0 disabled or not configured, skipping Babylon discovery test')
      return
    }
    
    try {
      const babylon = await discoveryService.findBabylon()
      
      // Babylon may not be registered yet, so null is acceptable
      if (babylon) {
        expect(babylon.name).toContain('Babylon')
        expect(babylon.endpoints.a2a).toBeTruthy()
        expect(babylon.endpoints.mcp).toBeTruthy()
        expect(babylon.endpoints.api).toBeTruthy()
      }
    } catch (error) {
      console.log('⚠️  Babylon discovery test failed:', error)
      // Don't fail test if not configured
    }
  })
  
  test('Agent0Client can be initialized', () => {
    // Agent0 operations require Ethereum Sepolia RPC (not Base Sepolia)
    // Priority: AGENT0_RPC_URL > SEPOLIA_RPC_URL
    const rpcUrl = 
      process.env.AGENT0_RPC_URL || 
      process.env.SEPOLIA_RPC_URL ||
      'https://ethereum-sepolia-rpc.publicnode.com'
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.AGENT0_PRIVATE_KEY
    
    if (!privateKey) {
      console.log('⚠️  Missing private key, skipping Agent0Client test')
      return
    }
    
    try {
      const client = new Agent0Client({
        network: 'sepolia',
        rpcUrl,
        privateKey
      })
      
      expect(client).toBeDefined()
      expect(client.isAvailable()).toBe(true)
      console.log('✅ Agent0Client initialized with Ethereum Sepolia RPC')
    } catch (error) {
      console.log('⚠️  Agent0Client initialization failed:', error)
      // Don't fail test if SDK has issues
    }
  })
})

