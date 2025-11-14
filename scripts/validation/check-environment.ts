#!/usr/bin/env bun
/**
 * Environment Validation Script
 * 
 * Validates environment configuration before starting production server
 */

import { logger } from '../../src/lib/logger'
import { validateEnvironment, printValidationResult, detectEnvironment } from '../../src/lib/deployment/env-detection'

async function main() {
  logger.info('Validating production environment...', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')

  const env = detectEnvironment()
  logger.info(`Detected environment: ${env}`, undefined, 'Script')

  if (env === 'localnet') {
    logger.warn('⚠️  Detected localnet environment', undefined, 'Script')
    logger.warn('   Production should use testnet or mainnet', undefined, 'Script')
    logger.info('', undefined, 'Script')
    logger.info('For production deployment:', undefined, 'Script')
    logger.info('  1. Set DEPLOYMENT_ENV=testnet or DEPLOYMENT_ENV=mainnet', undefined, 'Script')
    logger.info('  2. Set all required environment variables', undefined, 'Script')
    logger.info('  3. Deploy contracts if not already deployed', undefined, 'Script')
  }

  const result = validateEnvironment(env)
  printValidationResult(result)

  if (result.valid) {
    logger.info('', undefined, 'Script')
    logger.info('✅ Environment is valid for production', undefined, 'Script')
    process.exit(0)
  } else {
    process.exit(1)
  }
}

main().catch(error => {
  logger.error('Environment check failed:', error, 'Script')
  process.exit(1)
})

