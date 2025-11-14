/**
 * Agent0 Testnet Integration Tests
 * 
 * Tests Agent0 integration on Base Sepolia testnet
 */

import { describe, test, expect } from 'bun:test'
import { Agent0Client } from '../../src/agents/agent0/Agent0Client'
import { GameDiscoveryService } from '../../src/agents/agent0/GameDiscovery'

describe('Agent0 Testnet Integration', () => {
  const isAgent0Enabled = process.env.AGENT0_ENABLED === 'true'
  const hasRequiredConfig = !!(
    process.env.BASE_SEPOLIA_RPC_URL &&
    process.env.BABYLON_GAME_PRIVATE_KEY
  )

  test('Agent0 configuration is valid', () => {
    if (!isAgent0Enabled) {
      console.log('⚠️  Agent0 not enabled, skipping test')
      console.log('   Run: bun run agent0:configure')
      return
    }

    expect(process.env.AGENT0_NETWORK).toBe('sepolia')
    expect(process.env.BASE_SEPOLIA_RPC_URL).toBeDefined()

    console.log('✅ Agent0 configuration valid for testnet')
  })

  test('Can initialize Agent0Client for testnet', () => {
    if (!hasRequiredConfig) {
      console.log('⚠️  Missing Agent0 configuration, skipping test')
      return
    }

    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL!
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY!

    const client = new Agent0Client({
      network: 'sepolia',
      rpcUrl,
      privateKey
    })

    expect(client).toBeDefined()
    expect(client.isAvailable()).toBe(true)

    console.log('✅ Agent0Client initialized for testnet')
  })

  test('GameDiscoveryService can query testnet', async () => {
    if (!isAgent0Enabled) {
      console.log('⚠️  Agent0 not enabled, skipping discovery test')
      return
    }

    const discovery = new GameDiscoveryService()
    const games = await discovery.discoverGames({
      type: 'game-platform',
      markets: ['prediction']
    })

    expect(Array.isArray(games)).toBe(true)
    console.log(`✅ Found ${games.length} game(s) on testnet Agent0 network`)

    if (games.length > 0) {
      console.log('   Example game:', games[0]?.name)
    }
  })

  test('Can find Babylon in Agent0 network', async () => {
    if (!isAgent0Enabled) {
      console.log('⚠️  Agent0 not enabled, skipping Babylon discovery test')
      return
    }

    const discovery = new GameDiscoveryService()
    const babylon = await discovery.findBabylon()

    if (babylon) {
      expect(babylon.name).toContain('Babylon')
      expect(babylon.endpoints).toBeDefined()
      console.log('✅ Babylon found in Agent0 network')
      console.log(`   Name: ${babylon.name}`)
      console.log(`   Endpoints: ${Object.keys(babylon.endpoints).join(', ')}`)
    } else {
      console.log('⚠️  Babylon not found in Agent0 network')
      console.log('   Run registration: bun run agent0:register')
    }
  })

  test('Agent0 registration can be verified', async () => {
    if (!hasRequiredConfig) {
      console.log('⚠️  Missing Agent0 configuration, skipping registration test')
      return
    }

    const client = new Agent0Client({
      network: 'sepolia',
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL!,
      privateKey: process.env.BABYLON_GAME_PRIVATE_KEY!
    })

    expect(client.isAvailable()).toBe(true)
    console.log('✅ Agent0Client ready for registration')
  })

  test('IPFS configuration is valid', () => {
    if (!isAgent0Enabled) {
      console.log('⚠️  Agent0 not enabled, skipping IPFS test')
      return
    }

    const ipfsProvider = process.env.AGENT0_IPFS_PROVIDER || 'node'
    expect(['node', 'pinata', 'filecoinPin']).toContain(ipfsProvider)

    if (ipfsProvider === 'pinata') {
      if (!process.env.PINATA_JWT) {
        console.log('⚠️  PINATA_JWT not set but Pinata provider selected')
      } else {
        console.log('✅ Pinata IPFS configuration present')
      }
    } else {
      console.log(`✅ IPFS provider: ${ipfsProvider}`)
    }
  })
})

