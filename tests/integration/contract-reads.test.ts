// @ts-nocheck - Test file

/**
 * Contract Reads Integration Test
 * 
 * Tests smart contract reads from deployed contracts
 */

import { describe, test, expect, beforeAll } from 'bun:test'
import { createPublicClient, http, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'

const CONTRACTS = {
  identityRegistry: (process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_BASE_SEPOLIA || '') as Address,
  reputationSystem: (process.env.NEXT_PUBLIC_REPUTATION_SYSTEM_BASE_SEPOLIA || '') as Address,
  diamond: (process.env.NEXT_PUBLIC_DIAMOND_BASE_SEPOLIA || '') as Address,
}

const DIAMOND_LOUPE_ABI = [
  {
    type: 'function',
    name: 'facets',
    inputs: [],
    outputs: [
      {
        name: 'facets_',
        type: 'tuple[]',
        components: [
          { name: 'facetAddress', type: 'address' },
          { name: 'functionSelectors', type: 'bytes4[]' },
        ],
      },
    ],
    stateMutability: 'view',
  },
] as const

const IDENTITY_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'isRegistered',
    inputs: [{ name: '_address', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'name',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
  },
] as const

const REPUTATION_SYSTEM_ABI = [
  {
    type: 'function',
    name: 'identityRegistry',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
] as const

describe('Contract Reads', () => {
  let publicClient: ReturnType<typeof createPublicClient>

  beforeAll(() => {
    if (!CONTRACTS.diamond) {
      console.warn('⚠️  Contracts not deployed to testnet - skipping tests')
      return
    }

    publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'),
    }) as typeof publicClient
  })

  test('Diamond contract - read facets', async () => {
    if (!CONTRACTS.diamond) return

    const facets = await publicClient.readContract({
      address: CONTRACTS.diamond,
      abi: DIAMOND_LOUPE_ABI,
      functionName: 'facets',
    })

    expect(facets).toBeDefined()
    expect(facets.length).toBeGreaterThan(0)
  })

  test('Identity Registry - read name', async () => {
    if (!CONTRACTS.identityRegistry) return

    const name = await publicClient.readContract({
      address: CONTRACTS.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'name',
    })

    expect(name).toBeDefined()
    expect(typeof name).toBe('string')
  })

  test('Reputation System - verify registry link', async () => {
    if (!CONTRACTS.reputationSystem || !CONTRACTS.identityRegistry) return

    const registryAddress = await publicClient.readContract({
      address: CONTRACTS.reputationSystem,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'identityRegistry',
    })

    expect(registryAddress.toLowerCase()).toBe(CONTRACTS.identityRegistry.toLowerCase())
  })

  test('Contracts have deployed code', async () => {
    if (!CONTRACTS.diamond) return

    const diamondCode = await publicClient.getCode({ address: CONTRACTS.diamond })
    expect(diamondCode).toBeDefined()
    expect(diamondCode).not.toBe('0x')
  })
})

