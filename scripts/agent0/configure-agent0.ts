#!/usr/bin/env bun
/**
 * Agent0 Configuration Helper
 * 
 * Helps configure Agent0 integration with interactive prompts
 */

import { logger } from '../../src/lib/logger'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

async function main() {
  logger.info('Agent0 Configuration Helper', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')

  const envPath = join(process.cwd(), '.env.testnet')
  let envContent = ''

  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf-8')
  }

  // Check current configuration
  logger.info('Checking current Agent0 configuration...', undefined, 'Script')

  const currentConfig = {
    enabled: getEnvValue(envContent, 'AGENT0_ENABLED'),
    network: getEnvValue(envContent, 'AGENT0_NETWORK'),
    rpcUrl: getEnvValue(envContent, 'BASE_SEPOLIA_RPC_URL'),
    privateKey: getEnvValue(envContent, 'BABYLON_GAME_PRIVATE_KEY'),
    subgraphUrl: getEnvValue(envContent, 'AGENT0_SUBGRAPH_URL'),
    ipfsProvider: getEnvValue(envContent, 'AGENT0_IPFS_PROVIDER'),
    pinataJwt: getEnvValue(envContent, 'PINATA_JWT')
  }

  logger.info('Current configuration:', undefined, 'Script')
  logger.info(`  AGENT0_ENABLED: ${currentConfig.enabled || 'not set'}`, undefined, 'Script')
  logger.info(`  AGENT0_NETWORK: ${currentConfig.network || 'not set'}`, undefined, 'Script')
  logger.info(`  BASE_SEPOLIA_RPC_URL: ${currentConfig.rpcUrl ? '✅ set' : '❌ not set'}`, undefined, 'Script')
  logger.info(`  BABYLON_GAME_PRIVATE_KEY: ${currentConfig.privateKey ? '✅ set' : '❌ not set'}`, undefined, 'Script')
  logger.info(`  AGENT0_SUBGRAPH_URL: ${currentConfig.subgraphUrl || 'not set'}`, undefined, 'Script')
  logger.info(`  AGENT0_IPFS_PROVIDER: ${currentConfig.ipfsProvider || 'node'}`, undefined, 'Script')

  logger.info('', undefined, 'Script')

  // Update configuration
  const updates: Record<string, string> = {}

  if (!currentConfig.enabled || currentConfig.enabled !== 'true') {
    logger.info('Enabling Agent0...', undefined, 'Script')
    updates['AGENT0_ENABLED'] = 'true'
  }

  if (!currentConfig.network || currentConfig.network !== 'sepolia') {
    logger.info('Setting network to sepolia...', undefined, 'Script')
    updates['AGENT0_NETWORK'] = 'sepolia'
  }

  if (!currentConfig.rpcUrl) {
    logger.info('Setting Base Sepolia RPC URL...', undefined, 'Script')
    updates['BASE_SEPOLIA_RPC_URL'] = 'https://sepolia.base.org'
  }

  if (!currentConfig.subgraphUrl) {
    logger.info('Setting Agent0 subgraph URL...', undefined, 'Script')
    // Default subgraph URL (should be updated with actual URL)
    updates['AGENT0_SUBGRAPH_URL'] = 'https://api.studio.thegraph.com/query/your-subgraph-id/agent0/version/latest'
    logger.warn('⚠️  Using placeholder subgraph URL', undefined, 'Script')
    logger.info('   Update AGENT0_SUBGRAPH_URL in .env.testnet with your actual subgraph URL', undefined, 'Script')
  }

  if (!currentConfig.ipfsProvider) {
    logger.info('Setting IPFS provider to node...', undefined, 'Script')
    updates['AGENT0_IPFS_PROVIDER'] = 'node'
  }

  // Apply updates
  if (Object.keys(updates).length > 0) {
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (envContent.match(regex)) {
        envContent = envContent.replace(regex, `${key}=${value}`)
      } else {
        envContent += `\n${key}=${value}`
      }
    }

    writeFileSync(envPath, envContent)
    logger.info('', undefined, 'Script')
    logger.info('✅ Configuration updated in .env.testnet', undefined, 'Script')
  }

  // Show next steps
  logger.info('', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')
  logger.info('Next steps:', undefined, 'Script')
  logger.info('', undefined, 'Script')

  if (!currentConfig.privateKey) {
    logger.info('1. Set BABYLON_GAME_PRIVATE_KEY in .env.testnet', undefined, 'Script')
    logger.info('   This is the private key for your game agent (needs ETH for registration)', undefined, 'Script')
    logger.info('', undefined, 'Script')
  }

  if (!currentConfig.subgraphUrl || currentConfig.subgraphUrl.includes('your-subgraph-id')) {
    logger.info('2. Update AGENT0_SUBGRAPH_URL in .env.testnet', undefined, 'Script')
    logger.info('   Get the subgraph URL from The Graph Studio', undefined, 'Script')
    logger.info('', undefined, 'Script')
  }

  if (!currentConfig.pinataJwt) {
    logger.info('3. (Optional) Set PINATA_JWT for Pinata IPFS hosting', undefined, 'Script')
    logger.info('   Get JWT from https://pinata.cloud', undefined, 'Script')
    logger.info('   Or use default IPFS node provider', undefined, 'Script')
    logger.info('', undefined, 'Script')
  }

  logger.info('4. Verify configuration:', undefined, 'Script')
  logger.info('   bun run agent0:verify', undefined, 'Script')
  logger.info('', undefined, 'Script')

  logger.info('5. Register Babylon with Agent0:', undefined, 'Script')
  logger.info('   bun run agent0:register', undefined, 'Script')
  logger.info('', undefined, 'Script')

  logger.info('6. Start testnet development:', undefined, 'Script')
  logger.info('   bun run dev:testnet', undefined, 'Script')
}

function getEnvValue(envContent: string, key: string): string | null {
  const regex = new RegExp(`^${key}=(.*)$`, 'm')
  const match = envContent.match(regex)
  return match && match[1] ? match[1].trim().replace(/['"]/g, '') : null
}

main().catch(error => {
  logger.error('Configuration failed:', error, 'Script')
  process.exit(1)
})

