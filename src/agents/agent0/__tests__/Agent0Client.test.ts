/**
 * Unit Tests for Agent0Client
 * 
 * IMPORTANT: Agent0 operations require Ethereum Sepolia RPC (not Base Sepolia)
 */

import { describe, test, expect } from 'bun:test'
import { Agent0Client } from '../Agent0Client'

describe('Agent0Client', () => {
  test('throws error without RPC URL and private key', () => {
    expect(() => {
      new Agent0Client({
        network: 'sepolia',
        rpcUrl: '',
        privateKey: '',
      });
    }).toThrow();
  });
  
  test('can be initialized with valid config', () => {
    const rpcUrl = process.env.AGENT0_RPC_URL || process.env.SEPOLIA_RPC_URL
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY ?? '0x0000000000000000000000000000000000000000000000000000000000000001';
    
    const client = new Agent0Client({
      network: 'sepolia',
      rpcUrl,
      privateKey
    })
    
    expect(client).toBeDefined()
    expect(typeof client.isAvailable).toBe('function')
  })
  
  test('searchAgents returns an array', async () => {
    const rpcUrl = process.env.AGENT0_RPC_URL || process.env.SEPOLIA_RPC_URL
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY ?? '0x0000000000000000000000000000000000000000000000000000000000000001';
    
    const client = new Agent0Client({
      network: 'sepolia',
      rpcUrl,
      privateKey
    })
    
    const results = await client.searchAgents({
      markets: ['prediction']
    })
    
    expect(Array.isArray(results)).toBe(true)
  })
  
  test('getAgentProfile returns a profile or null', async () => {
    const rpcUrl = process.env.AGENT0_RPC_URL || process.env.SEPOLIA_RPC_URL
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY ?? '0x0000000000000000000000000000000000000000000000000000000000000001';
    
    const client = new Agent0Client({
      network: 'sepolia',
      rpcUrl,
      privateKey
    })
    
    const profile = await client.getAgentProfile(1)
    
    expect(profile === null || typeof profile === 'object').toBe(true)
  })
})

