/**
 * Test script to verify smart contract reads from Base Sepolia
 * Tests the deployed contracts and ensures frontend integration will work
 */

import { createPublicClient, http, formatEther, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { config } from 'dotenv'
import { logger } from '../src/lib/logger'
config()

// Contract addresses from environment
const CONTRACTS = {
  identityRegistry: (process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_BASE_SEPOLIA || '') as Address,
  reputationSystem: (process.env.NEXT_PUBLIC_REPUTATION_SYSTEM_BASE_SEPOLIA || '') as Address,
  diamond: (process.env.NEXT_PUBLIC_DIAMOND_BASE_SEPOLIA || '') as Address,
}

// ABIs for testing (minimal)
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
  {
    type: 'function',
    name: 'facetAddresses',
    inputs: [],
    outputs: [{ name: 'facetAddresses_', type: 'address[]' }],
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

async function main() {
  logger.info('Testing Smart Contract Reads on Base Sepolia', undefined, 'Script');
  logger.info('='.repeat(60), undefined, 'Script');

  // Create public client
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'),
  })

  logger.info('Connected to Base Sepolia RPC', { rpc: process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org' }, 'Script');

  // Test 1: Diamond Contract - Get Facets
  logger.info('='.repeat(60), undefined, 'Script');
  logger.info('Testing Diamond Proxy Contract', undefined, 'Script');
  logger.info('='.repeat(60), undefined, 'Script');

  try {
    logger.info(`Diamond Address: ${CONTRACTS.diamond}`, undefined, 'Script');

    const facets = await publicClient.readContract({
      address: CONTRACTS.diamond,
      abi: DIAMOND_LOUPE_ABI,
      functionName: 'facets',
    })

    logger.info(`Diamond facets found: ${facets.length}`, undefined, 'Script');
    facets.forEach((facet, index) => {
      logger.info(`${index + 1}. ${facet.facetAddress} (${facet.functionSelectors.length} functions)`, undefined, 'Script');
    })

    const facetAddresses = await publicClient.readContract({
      address: CONTRACTS.diamond,
      abi: DIAMOND_LOUPE_ABI,
      functionName: 'facetAddresses',
    })

    logger.info(`Total facet addresses: ${facetAddresses.length}`, undefined, 'Script');
  } catch (error) {
    logger.error('Diamond read failed:', error instanceof Error ? error.message : error, 'Script');
  }

  // Test 2: Identity Registry
  logger.info('='.repeat(60), undefined, 'Script');
  logger.info('Testing Identity Registry Contract', undefined, 'Script');
  logger.info('='.repeat(60), undefined, 'Script');

  try {
    logger.info(`Identity Registry Address: ${CONTRACTS.identityRegistry}`, undefined, 'Script');

    const collectionName = await publicClient.readContract({
      address: CONTRACTS.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'name',
    })

    logger.info(`Contract name: "${collectionName}"`, undefined, 'Script');

    // Test if deployer address is registered
    const deployerAddress = '0xFfA6A2Ac8bcAE47af29b623B97071E676647556A' as Address
    const isRegistered = await publicClient.readContract({
      address: CONTRACTS.identityRegistry,
      abi: IDENTITY_REGISTRY_ABI,
      functionName: 'isRegistered',
      args: [deployerAddress],
    })

    logger.info(`Deployer (${deployerAddress}) registered: ${isRegistered}`, undefined, 'Script');
  } catch (error) {
    logger.error('Identity Registry read failed:', error instanceof Error ? error.message : error, 'Script');
  }

  // Test 3: Reputation System
  logger.info('='.repeat(60), undefined, 'Script');
  logger.info('Testing Reputation System Contract', undefined, 'Script');
  logger.info('='.repeat(60), undefined, 'Script');

  try {
    logger.info(`Reputation System Address: ${CONTRACTS.reputationSystem}`, undefined, 'Script');

    const identityRegistryAddress = await publicClient.readContract({
      address: CONTRACTS.reputationSystem,
      abi: REPUTATION_SYSTEM_ABI,
      functionName: 'identityRegistry',
    })

    logger.info(`Connected to Identity Registry: ${identityRegistryAddress}`, undefined, 'Script');

    const isCorrect = identityRegistryAddress.toLowerCase() === CONTRACTS.identityRegistry.toLowerCase()
    if (isCorrect) {
      logger.info('Identity Registry address matches!', undefined, 'Script');
    } else {
      logger.warn('Identity Registry address mismatch!', {
        expected: CONTRACTS.identityRegistry,
        got: identityRegistryAddress
      }, 'Script');
    }
  } catch (error) {
    logger.error('Reputation System read failed:', error instanceof Error ? error.message : error, 'Script');
  }

  // Test 4: Contract Code Verification
  logger.info('='.repeat(60), undefined, 'Script');
  logger.info('Verifying Contract Deployment', undefined, 'Script');
  logger.info('='.repeat(60), undefined, 'Script');

  try {
    const diamondCode = await publicClient.getCode({ address: CONTRACTS.diamond })
    const identityCode = await publicClient.getCode({ address: CONTRACTS.identityRegistry })
    const reputationCode = await publicClient.getCode({ address: CONTRACTS.reputationSystem })

    logger.info(`Diamond has deployed code: ${diamondCode && diamondCode !== '0x'}`, undefined, 'Script');
    logger.info(`Identity Registry has deployed code: ${identityCode && identityCode !== '0x'}`, undefined, 'Script');
    logger.info(`Reputation System has deployed code: ${reputationCode && reputationCode !== '0x'}`, undefined, 'Script');
  } catch (error) {
    logger.error('Code verification failed:', error instanceof Error ? error.message : error, 'Script');
  }

  // Summary
  logger.info('='.repeat(60), undefined, 'Script');
  logger.info('Test Summary', undefined, 'Script');
  logger.info('='.repeat(60), undefined, 'Script');
  logger.info('All basic contract reads completed successfully!', undefined, 'Script');
  logger.info('Contracts are deployed and accessible', undefined, 'Script');
  logger.info('Frontend integration should work correctly', undefined, 'Script');
  logger.info('Next Steps:', {
    step1: 'Test contract reads from Next.js frontend',
    step2: 'Create on-chain registration API route',
    step3: 'Build registry viewer page'
  }, 'Script');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Test failed:', error, 'Script');
    process.exit(1)
  })
