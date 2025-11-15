#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * Setup Agent0 for Localnet Testing
 * 
 * Configures environment variables and ensures localnet is ready for Agent0 testing
 */

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { logger } from '../../src/lib/logger'
import { $ } from 'bun'

const ANVIL_RPC_URL = 'http://localhost:8545'
const ANVIL_CHAIN_ID = 31337
const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

async function main() {
  logger.info('Setting up Agent0 for localnet testing...', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')

  // 1. Check Anvil is running
  try {
    await $`cast block-number --rpc-url ${ANVIL_RPC_URL}`.quiet()
    logger.info('✅ Anvil is running', undefined, 'Script')
  } catch {
    logger.error('❌ Anvil is not running', undefined, 'Script')
    logger.info('Start Anvil with: docker-compose up -d anvil', undefined, 'Script')
    process.exit(1)
  }

  // 2. Update .env.test with Agent0 localnet configuration
  const envTestPath = join(process.cwd(), '.env.test')
  let envTestContent = existsSync(envTestPath) 
    ? readFileSync(envTestPath, 'utf-8')
    : ''

  const updates: Record<string, string> = {
    AGENT0_ENABLED: 'true',
    AGENT0_NETWORK: 'localnet',
    AGENT0_RPC_URL: ANVIL_RPC_URL,
    AGENT0_PRIVATE_KEY: ANVIL_PRIVATE_KEY,
    AGENT0_IPFS_PROVIDER: 'node',
  }

  logger.info('Updating .env.test with Agent0 localnet configuration...', undefined, 'Script')
  
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (envTestContent.match(regex)) {
      envTestContent = envTestContent.replace(regex, `${key}=${value}`)
      logger.info(`  Updated ${key}`, undefined, 'Script')
    } else {
      envTestContent += `\n${key}=${value}`
      logger.info(`  Added ${key}`, undefined, 'Script')
    }
  }

  writeFileSync(envTestPath, envTestContent)
  logger.info('✅ Updated .env.test', undefined, 'Script')

  // 3. Also update .env.local if it exists
  const envLocalPath = join(process.cwd(), '.env.local')
  if (existsSync(envLocalPath)) {
    let envLocalContent = readFileSync(envLocalPath, 'utf-8')
    
    for (const [key, value] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (envLocalContent.match(regex)) {
        envLocalContent = envLocalContent.replace(regex, `${key}=${value}`)
      } else {
        envLocalContent += `\n${key}=${value}`
      }
    }
    
    writeFileSync(envLocalPath, envLocalContent)
    logger.info('✅ Updated .env.local', undefined, 'Script')
  }

  // 4. Verify configuration
  logger.info('', undefined, 'Script')
  logger.info('Agent0 Localnet Configuration:', undefined, 'Script')
  logger.info(`  Network: localnet`, undefined, 'Script')
  logger.info(`  RPC URL: ${ANVIL_RPC_URL}`, undefined, 'Script')
  logger.info(`  Chain ID: ${ANVIL_CHAIN_ID}`, undefined, 'Script')
  logger.info(`  IPFS Provider: node`, undefined, 'Script')

  logger.info('', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')
  logger.info('✅ Agent0 localnet setup complete!', undefined, 'Script')
  logger.info('', undefined, 'Script')
  logger.info('Note: Agent0 contracts may not be deployed on localnet.', undefined, 'Script')
  logger.info('This is OK for testing - the SDK will work in read-only mode.', undefined, 'Script')
}

main().catch((error) => {
  logger.error('Setup failed', { error }, 'Script')
  process.exit(1)
})

