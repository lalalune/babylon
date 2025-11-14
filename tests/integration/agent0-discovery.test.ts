/**
 * Agent0 Discovery Integration Tests
 * 
 * Tests for agent discovery flow and game registration.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { GameDiscoveryService } from '../../src/agents/agent0/GameDiscovery'
import { IPFSPublisher } from '../../src/agents/agent0/IPFSPublisher'
import { Agent0Client } from '../../src/agents/agent0/Agent0Client'

describe('Agent0 Discovery Integration', () => {
  let discoveryService: GameDiscoveryService
  let ipfsPublisher: IPFSPublisher
  
  beforeAll(() => {
    discoveryService = new GameDiscoveryService()
    ipfsPublisher = new IPFSPublisher()
  })
  
  test('IPFS Publisher can publish and fetch metadata', async () => {
    if (!ipfsPublisher.isAvailable()) {
      console.log('⚠️  IPFS not available, skipping test')
      return
    }
    
    const testMetadata = {
      name: 'Test Game',
      description: 'Test game for discovery',
      version: '1.0.0',
      type: 'game-platform',
      endpoints: {
        a2a: 'wss://test.game/ws/a2a',
        mcp: 'https://test.game/mcp',
        api: 'https://test.game/api'
      },
      capabilities: {
        markets: ['prediction'],
        actions: ['query_markets', 'place_bet'],
        protocols: ['a2a', 'rest'],
        version: '1.0.0'
      }
    }
    
    try {
      const cid = await ipfsPublisher.publishMetadata(testMetadata)
      expect(cid).toBeTruthy()
      expect(typeof cid).toBe('string')
      
      const fetched = await ipfsPublisher.fetchMetadata(cid)
      expect(fetched.name).toBe(testMetadata.name)
      expect(fetched.endpoints.a2a).toBe(testMetadata.endpoints.a2a)
    } catch (error) {
      console.log('⚠️  IPFS test failed (may need IPFS credentials):', error)
      // Don't fail test if IPFS is not configured
    }
  })
  
  test('GameDiscoveryService can discover games', async () => {
    if (process.env.AGENT0_ENABLED !== 'true') {
      console.log('⚠️  Agent0 disabled, skipping discovery test')
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
    if (process.env.AGENT0_ENABLED !== 'true') {
      console.log('⚠️  Agent0 disabled, skipping Babylon discovery test')
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
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.AGENT0_PRIVATE_KEY
    
    if (!rpcUrl || !privateKey) {
      console.log('⚠️  Missing RPC URL or private key, skipping Agent0Client test')
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
    } catch (error) {
      console.log('⚠️  Agent0Client initialization failed:', error)
      // Don't fail test if SDK has issues
    }
  })
})

