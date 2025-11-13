#!/usr/bin/env bun
/**
 * Agent0 Configuration Validation Script
 * 
 * Validates Agent0 integration is properly configured
 */

import { logger } from '../../src/lib/logger'
import { Agent0Client } from '../../src/agents/agent0/Agent0Client'

async function main() {
  logger.info('Validating Agent0 configuration...', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')

  // Check environment variables
  // IMPORTANT: Multi-chain setup
  // - Agent0 operations require Ethereum Sepolia RPC (not Base Sepolia)
  // - Base Sepolia RPC is for game operations only
  logger.info('Multi-chain setup:', undefined, 'Script')
  logger.info('  - Agent0 network: Ethereum Sepolia (for game/agent discovery)', undefined, 'Script')
  logger.info('  - Game network: Base Sepolia (for actual game operations)', undefined, 'Script')
  logger.info('', undefined, 'Script')

  const hasEthereumRpc = 
    !!process.env.AGENT0_RPC_URL || 
    !!process.env.SEPOLIA_RPC_URL

  const requiredVars = [
    'AGENT0_ENABLED',
    'BABYLON_GAME_PRIVATE_KEY'
  ]

  const missing = requiredVars.filter(v => !process.env[v])

  if (!hasEthereumRpc) {
    logger.error('❌ Missing Ethereum Sepolia RPC URL for Agent0 operations', undefined, 'Script')
    logger.error('   Required: AGENT0_RPC_URL or SEPOLIA_RPC_URL', undefined, 'Script')
    logger.error('   Agent0 operations happen on Ethereum Sepolia, not Base Sepolia', undefined, 'Script')
    missing.push('AGENT0_RPC_URL')
  }

  if (missing.length > 0) {
    logger.error('❌ Missing required environment variables:', undefined, 'Script')
    missing.forEach(v => logger.error(`   ${v}`, undefined, 'Script'))
    logger.info('', undefined, 'Script')
    logger.info('Agent0 integration will not work without these variables', undefined, 'Script')
    process.exit(1)
  }

  logger.info('✅ Required environment variables present', undefined, 'Script')
  
  // Warn if Base Sepolia RPC is missing (needed for game operations)
  if (!process.env.BASE_SEPOLIA_RPC_URL) {
    logger.warn('⚠️  BASE_SEPOLIA_RPC_URL not set (required for game operations on Base Sepolia)', undefined, 'Script')
  }

  // Check Agent0 client initialization
  if (process.env.AGENT0_ENABLED !== 'true') {
    logger.warn('⚠️  AGENT0_ENABLED is not set to "true"', undefined, 'Script')
    logger.info('Agent0 integration is disabled', undefined, 'Script')
    process.exit(0)
  }

  try {
    // Agent0 operations require Ethereum Sepolia RPC (not Base Sepolia)
    // Priority: AGENT0_RPC_URL > SEPOLIA_RPC_URL > fallback
    const rpcUrl = 
      process.env.AGENT0_RPC_URL || 
      process.env.SEPOLIA_RPC_URL ||
      'https://ethereum-sepolia-rpc.publicnode.com'
    
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.AGENT0_PRIVATE_KEY

    if (!privateKey) {
      throw new Error('Missing BABYLON_GAME_PRIVATE_KEY or AGENT0_PRIVATE_KEY')
    }
    
    if (!rpcUrl) {
      throw new Error('Missing Ethereum Sepolia RPC URL (AGENT0_RPC_URL or SEPOLIA_RPC_URL)')
    }

    const client = new Agent0Client({
      network: (process.env.AGENT0_NETWORK as 'sepolia' | 'mainnet') || 'sepolia',
      rpcUrl,
      privateKey,
      ipfsProvider: (process.env.AGENT0_IPFS_PROVIDER as 'node' | 'filecoinPin' | 'pinata') || 'node',
      ipfsNodeUrl: process.env.AGENT0_IPFS_API,
      pinataJwt: process.env.PINATA_JWT,
      filecoinPrivateKey: process.env.FILECOIN_PRIVATE_KEY,
      subgraphUrl: process.env.AGENT0_SUBGRAPH_URL
    })

    if (client.isAvailable()) {
      logger.info('✅ Agent0Client initialized successfully', undefined, 'Script')
    } else {
      logger.warn('⚠️  Agent0Client initialization failed', undefined, 'Script')
    }

    // Check subgraph
    if (!process.env.AGENT0_SUBGRAPH_URL) {
      logger.warn('⚠️  AGENT0_SUBGRAPH_URL not set', undefined, 'Script')
      logger.info('   Agent discovery may not work', undefined, 'Script')
    } else {
      logger.info(`✅ Subgraph URL configured: ${process.env.AGENT0_SUBGRAPH_URL}`, undefined, 'Script')
    }

    // Check IPFS configuration
    const ipfsProvider = process.env.AGENT0_IPFS_PROVIDER || 'node'
    logger.info(`IPFS Provider: ${ipfsProvider}`, undefined, 'Script')

    if (ipfsProvider === 'pinata' && !process.env.PINATA_JWT) {
      logger.warn('⚠️  PINATA_JWT not set (required for Pinata IPFS)', undefined, 'Script')
    }

    logger.info('', undefined, 'Script')
    logger.info('='.repeat(60), undefined, 'Script')
    logger.info('✅ Agent0 configuration is valid', undefined, 'Script')
    logger.info('', undefined, 'Script')
    logger.info('To register Babylon with Agent0:', undefined, 'Script')
    logger.info('  bun run agent0:register', undefined, 'Script')
  } catch (error) {
    logger.error('❌ Agent0 validation failed:', error, 'Script')
    process.exit(1)
  }
}

main().catch(error => {
  logger.error('Agent0 check failed:', error, 'Script')
  process.exit(1)
})

