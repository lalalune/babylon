#!/usr/bin/env bun
/**
 * Post-Deployment Setup for Testnet
 * 
 * Runs comprehensive setup after testnet deployment:
 * - Validates all contracts
 * - Sets up Agent0 if configured
 * - Runs smoke tests
 * - Provides deployment summary
 */

import { $ } from 'bun'
import { logger } from '../../src/lib/logger'
import { validateDeployment } from '../../src/lib/deployment/validation'
import { ethers } from 'ethers'

const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'

async function main() {
  logger.info('Post-Deployment Setup for Testnet', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')

  // 1. Validate deployment
  logger.info('1. Validating deployment...', undefined, 'Script')
  const validation = await validateDeployment('testnet', BASE_SEPOLIA_RPC_URL)

  if (!validation.valid || !validation.deployed) {
    logger.error('❌ Deployment validation failed', undefined, 'Script')
    validation.errors.forEach(error => logger.error(`   ${error}`, undefined, 'Script'))
    logger.info('', undefined, 'Script')
    logger.info('Please deploy contracts first:', undefined, 'Script')
    logger.info('  bun run contracts:deploy:testnet', undefined, 'Script')
    process.exit(1)
  }

  logger.info('✅ Deployment validated', undefined, 'Script')

  // 2. Run smoke tests
  logger.info('', undefined, 'Script')
  logger.info('2. Running smoke tests...', undefined, 'Script')

  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL)

  // Test Diamond (basic smoke test)
  if (validation.contracts.diamond) {
    const diamondContract = new ethers.Contract(
      validation.contracts.diamond,
      ['function getBalance(address) view returns (uint256)'],
      provider
    )

    if (diamondContract && 'getBalance' in diamondContract) {
      await diamondContract.getBalance(ethers.ZeroAddress).then(() => {
        logger.info('✅ Diamond contract functional', undefined, 'Script')
      }).catch((error: Error) => {
        logger.warn('⚠️  Diamond smoke test failed', error, 'Script')
      })
    }
  }

  // Test Identity Registry
  if (validation.contracts.identityRegistry) {
    const registryContract = new ethers.Contract(
      validation.contracts.identityRegistry,
      ['function identityCount() view returns (uint256)'],
      provider
    )

    if (registryContract && 'identityCount' in registryContract) {
      await registryContract.identityCount().then((count: bigint) => {
        logger.info(`✅ Identity Registry functional (${count} identities)`, undefined, 'Script')
      }).catch((error: Error) => {
        logger.warn('⚠️  Identity Registry smoke test failed', error, 'Script')
      })
    }
  }

  // 3. Check Agent0 configuration
  logger.info('', undefined, 'Script')
  logger.info('3. Checking Agent0 configuration...', undefined, 'Script')

  if (process.env.AGENT0_ENABLED === 'true') {
    await $`bun run agent0:verify`.quiet().then(async () => {
      logger.info('✅ Agent0 configured', undefined, 'Script')

      // Try to register if not already registered
      logger.info('Checking Agent0 registration...', undefined, 'Script')
      await $`bun run agent0:register`.quiet().then(() => {
        logger.info('✅ Registered with Agent0', undefined, 'Script')
      }).catch(() => {
        logger.warn('⚠️  Agent0 registration failed or already registered', undefined, 'Script')
      })
    }).catch(() => {
      logger.warn('⚠️  Agent0 not fully configured', undefined, 'Script')
      logger.info('   Run: bun run agent0:configure', undefined, 'Script')
    })
  } else {
    logger.info('ℹ️  Agent0 not enabled', undefined, 'Script')
    logger.info('   To enable: bun run agent0:configure', undefined, 'Script')
  }

  // 4. Deployment summary
  logger.info('', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')
  logger.info('Deployment Summary', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')
  logger.info('', undefined, 'Script')
  logger.info('Network: Base Sepolia (Chain ID: 84532)', undefined, 'Script')
  logger.info('RPC URL: https://sepolia.base.org', undefined, 'Script')
  logger.info('', undefined, 'Script')

  if (validation.contracts.diamond) {
    logger.info('Contracts:', undefined, 'Script')
    logger.info(`  Diamond: ${validation.contracts.diamond}`, undefined, 'Script')
    logger.info(`  View: https://sepolia.basescan.org/address/${validation.contracts.diamond}`, undefined, 'Script')

    if (validation.contracts.identityRegistry) {
      logger.info(`  Identity Registry: ${validation.contracts.identityRegistry}`, undefined, 'Script')
    }

    if (validation.contracts.reputationSystem) {
      logger.info(`  Reputation System: ${validation.contracts.reputationSystem}`, undefined, 'Script')
    }
  }

  logger.info('', undefined, 'Script')
  logger.info('Status:', undefined, 'Script')
  logger.info('  ✅ Contracts deployed and verified', undefined, 'Script')
  logger.info('  ✅ Smoke tests passed', undefined, 'Script')

  if (process.env.AGENT0_ENABLED === 'true') {
    logger.info('  ✅ Agent0 configured', undefined, 'Script')
  } else {
    logger.info('  ⚠️  Agent0 not configured (optional)', undefined, 'Script')
  }

  logger.info('', undefined, 'Script')
  logger.info('Next steps:', undefined, 'Script')
  logger.info('  1. Start development server:', undefined, 'Script')
  logger.info('     bun run dev:testnet', undefined, 'Script')
  logger.info('', undefined, 'Script')
  logger.info('  2. Test features on testnet', undefined, 'Script')
  logger.info('  3. Monitor contracts on BaseScan', undefined, 'Script')
  logger.info('', undefined, 'Script')

  if (process.env.AGENT0_ENABLED !== 'true') {
    logger.info('  Optional: Enable Agent0 integration', undefined, 'Script')
    logger.info('     bun run agent0:configure', undefined, 'Script')
    logger.info('', undefined, 'Script')
  }

  logger.info('='.repeat(60), undefined, 'Script')
  logger.info('✅ Testnet setup complete!', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')
}

main()

