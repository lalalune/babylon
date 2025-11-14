#!/usr/bin/env bun
/**
 * Pre-Development Setup for Testnet
 * 
 * Validates testnet deployment before starting dev server:
 * - Checks environment variables
 * - Validates contract deployments
 * - Checks Agent0 configuration
 * - Starts local database services
 */

import { $ } from 'bun'
import { logger } from '../../src/lib/logger'
import { validateEnvironment, printValidationResult } from '../../src/lib/deployment/env-detection'
import { validateDeployment, printValidationResult as printDeploymentResult } from '../../src/lib/deployment/validation'

const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'

logger.info('Setting up testnet development environment...', undefined, 'Script')
logger.info('='.repeat(60), undefined, 'Script')

// Set environment for testnet
process.env.DEPLOYMENT_ENV = 'testnet'
process.env.NEXT_PUBLIC_CHAIN_ID = '84532'

// 1. Validate environment variables
logger.info('Validating environment...', undefined, 'Script')
const envValidation = validateEnvironment('testnet')

if (!envValidation.valid) {
  logger.error('❌ Environment validation failed', undefined, 'Script')
  envValidation.errors.forEach(error => {
    logger.error(`   ${error}`, undefined, 'Script')
  })
  logger.info('', undefined, 'Script')
  logger.info('To fix:', undefined, 'Script')
  logger.info('  1. Copy .env.testnet.example to .env.testnet', undefined, 'Script')
  logger.info('  2. Fill in required values', undefined, 'Script')
  logger.info('  3. Deploy contracts: bun run contracts:deploy:testnet', undefined, 'Script')
  process.exit(1)
}

printValidationResult(envValidation)

// 2. Validate contract deployment
logger.info('', undefined, 'Script')
logger.info('Validating contract deployment...', undefined, 'Script')

const contractValidation = await validateDeployment('testnet', BASE_SEPOLIA_RPC_URL)

if (!contractValidation.deployed) {
  logger.error('❌ Contracts not deployed to testnet', undefined, 'Script')
  logger.info('', undefined, 'Script')
  logger.info('Deploy contracts with:', undefined, 'Script')
  logger.info('  bun run contracts:deploy:testnet', undefined, 'Script')
  process.exit(1)
}

if (!contractValidation.valid) {
  logger.error('❌ Contract validation failed', undefined, 'Script')
  contractValidation.errors.forEach(error => {
    logger.error(`   ${error}`, undefined, 'Script')
  })
  process.exit(1)
}

printDeploymentResult(contractValidation, 'testnet')

// 3. Check Agent0 configuration (if enabled)
if (process.env.AGENT0_ENABLED === 'true') {
  logger.info('', undefined, 'Script')
  logger.info('Checking Agent0 configuration...', undefined, 'Script')

  if (!process.env.BASE_SEPOLIA_RPC_URL) {
    logger.warn('⚠️  BASE_SEPOLIA_RPC_URL not set', undefined, 'Script')
  }

  if (!process.env.BABYLON_GAME_PRIVATE_KEY) {
    logger.warn('⚠️  BABYLON_GAME_PRIVATE_KEY not set', undefined, 'Script')
    logger.info('   Agent0 integration may not work', undefined, 'Script')
  }

  if (!process.env.AGENT0_SUBGRAPH_URL) {
    logger.warn('⚠️  AGENT0_SUBGRAPH_URL not set', undefined, 'Script')
    logger.info('   Agent discovery may not work', undefined, 'Script')
  } else {
    logger.info('✅ Agent0 configured', undefined, 'Script')
  }
}

// 4. Start local database services
logger.info('', undefined, 'Script')
logger.info('Starting local database services...', undefined, 'Script')

await $`docker --version`.quiet().catch(() => {
  logger.warn('⚠️  Could not start local services', undefined, 'Script')
  logger.info('   Make sure Docker is running', undefined, 'Script')
  throw new Error('Docker not available')
})

await $`docker info`.quiet()

// Start PostgreSQL
const postgresRunning = await $`docker ps --filter name=babylon-postgres --format "{{.Names}}"`.quiet().text()

if (postgresRunning.trim() !== 'babylon-postgres') {
  logger.info('Starting PostgreSQL...', undefined, 'Script')
  await $`docker-compose up -d postgres`
  await new Promise(resolve => setTimeout(resolve, 3000))
  logger.info('✅ PostgreSQL started', undefined, 'Script')
} else {
  logger.info('✅ PostgreSQL is running', undefined, 'Script')
}

// Start Redis (optional)
const redisRunning = await $`docker ps --filter name=babylon-redis --format "{{.Names}}"`.quiet().text()

if (redisRunning.trim() !== 'babylon-redis') {
  await $`docker-compose up -d redis`.then(() => {
    logger.info('✅ Redis started', undefined, 'Script')
  }).catch(() => {
    logger.warn('⚠️  Redis start failed (optional)', undefined, 'Script')
  })
} else {
  logger.info('✅ Redis is running', undefined, 'Script')
}

// Run database migrations
const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()

await prisma.$connect()
logger.info('✅ Database connected', undefined, 'Script')

const actorCount = await prisma.actor.count().catch(async (error: Error) => {
  const errorMessage = error.message
  if (errorMessage.includes('does not exist') || errorMessage.includes('P2021')) {
    logger.info('Running database migrations...', undefined, 'Script')
    await $`bunx prisma migrate deploy`.quiet().catch(async () => {
      await $`bunx prisma db push --skip-generate`.quiet()
    })

    logger.info('Running database seed...', undefined, 'Script')
    await $`bun run db:seed`
    logger.info('✅ Database ready', undefined, 'Script')
    return 0
  }
  throw error
})

if (actorCount === 0) {
  logger.info('Running database seed...', undefined, 'Script')
  await $`bun run db:seed`
  logger.info('✅ Database seeded', undefined, 'Script')
} else if (actorCount > 0) {
  logger.info(`✅ Database has ${actorCount} actors`, undefined, 'Script')
}

await prisma.$disconnect()

logger.info('', undefined, 'Script')
logger.info('='.repeat(60), undefined, 'Script')
logger.info('✅ Testnet environment ready!', undefined, 'Script')
logger.info('', undefined, 'Script')
logger.info('Network:', undefined, 'Script')
logger.info('  Chain: Base Sepolia (84532)', undefined, 'Script')
logger.info('  RPC: ' + BASE_SEPOLIA_RPC_URL, undefined, 'Script')
logger.info('  Explorer: https://sepolia.basescan.org', undefined, 'Script')
logger.info('', undefined, 'Script')
if (contractValidation.contracts.diamond) {
  logger.info('Contracts:', undefined, 'Script')
  logger.info('  Diamond: ' + contractValidation.contracts.diamond, undefined, 'Script')
}
logger.info('', undefined, 'Script')
logger.info('Starting Next.js...', undefined, 'Script')
logger.info('='.repeat(60), undefined, 'Script')

