#!/usr/bin/env bun
/**
 * Contract Validation Script
 * 
 * Validates contract deployment for a given environment
 */

import { logger } from '../../src/lib/logger'
import { validateDeployment, printValidationResult } from '../../src/lib/deployment/validation'
import type { DeploymentEnv } from '../../src/lib/deployment/env-detection'
import { CHAIN_CONFIGS } from '../../src/lib/deployment/env-detection'

async function main() {
  const args = process.argv.slice(2)
  const envArg = args.find(arg => arg.startsWith('--env='))
  const env = (envArg?.split('=')[1] || 'localnet') as DeploymentEnv

  if (!['localnet', 'testnet', 'mainnet'].includes(env)) {
    logger.error('Invalid environment. Use: local, testnet, or mainnet', undefined, 'Script')
    process.exit(1)
  }

  const config = CHAIN_CONFIGS[env]
  logger.info(`Validating contracts on ${config.name}...`, undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')

  const result = await validateDeployment(env, config.rpcUrl)

  printValidationResult(result, env)

  if (result.valid && result.deployed) {
    logger.info('', undefined, 'Script')
    logger.info('Contract addresses:', undefined, 'Script')
    if (result.contracts.diamond) {
      logger.info(`  Diamond: ${result.contracts.diamond}`, undefined, 'Script')
      logger.info(`  Explorer: ${config.explorerUrl}/address/${result.contracts.diamond}`, undefined, 'Script')
    }
    if (result.contracts.identityRegistry) {
      logger.info(`  Identity Registry: ${result.contracts.identityRegistry}`, undefined, 'Script')
    }
    if (result.contracts.reputationSystem) {
      logger.info(`  Reputation System: ${result.contracts.reputationSystem}`, undefined, 'Script')
    }

    process.exit(0)
  } else {
    process.exit(1)
  }
}

main().catch(error => {
  logger.error('Validation failed:', error, 'Script')
  process.exit(1)
})

