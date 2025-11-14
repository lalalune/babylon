/**
 * Environment Detection and Validation
 * 
 * Detects deployment environment (localnet, testnet, mainnet)
 * and validates required configuration.
 */

import { logger } from '@/lib/logger'

export type DeploymentEnv = 'localnet' | 'testnet' | 'mainnet'

export interface ChainConfig {
  chainId: number
  name: string
  rpcUrl: string
  explorerUrl: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
}

export const CHAIN_CONFIGS: Record<DeploymentEnv, ChainConfig> = {
  localnet: {
    chainId: 31337,
    name: 'Anvil (Local)',
    rpcUrl: 'http://localhost:8545',
    explorerUrl: '',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  testnet: {
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    explorerUrl: 'https://sepolia.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  },
  mainnet: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    }
  }
}

export interface EnvValidationResult {
  valid: boolean
  environment: DeploymentEnv
  errors: string[]
  warnings: string[]
  config: ChainConfig
}

/**
 * Detect deployment environment from environment variables
 */
export function detectEnvironment(): DeploymentEnv {
  // Explicit environment variable
  const explicitEnv = process.env.DEPLOYMENT_ENV
  if (explicitEnv === 'localnet' || explicitEnv === 'testnet' || explicitEnv === 'mainnet') {
    return explicitEnv
  }

  // Check for mainnet flag
  if (process.env.USE_MAINNET === 'true') {
    return 'mainnet'
  }

  // Check NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    // Default to testnet in production unless USE_MAINNET is set
    return 'testnet'
  }

  // Check chain ID
  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID
  if (chainId) {
    switch (parseInt(chainId)) {
      case 31337:
        return 'localnet'
      case 84532:
        return 'testnet'
      case 8453:
        return 'mainnet'
    }
  }

  // Check RPC URL patterns
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL
  if (rpcUrl) {
    if (rpcUrl.includes('localhost') || rpcUrl.includes('127.0.0.1')) {
      return 'localnet'
    }
    if (rpcUrl.includes('sepolia')) {
      return 'testnet'
    }
    if (rpcUrl.includes('mainnet.base.org')) {
      return 'mainnet'
    }
  }

  // Default to localnet for development
  return 'localnet'
}

/**
 * Validate environment configuration
 */
export function validateEnvironment(env?: DeploymentEnv): EnvValidationResult {
  const environment = env || detectEnvironment()
  const config = CHAIN_CONFIGS[environment]
  const errors: string[] = []
  const warnings: string[] = []

  // Common validation
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required')
  }

  // Network-specific validation
  switch (environment) {
    case 'localnet':
      validateLocalnet(errors, warnings)
      break
    case 'testnet':
      validateTestnet(errors, warnings)
      break
    case 'mainnet':
      validateMainnet(errors, warnings)
      break
  }

  return {
    valid: errors.length === 0,
    environment,
    errors,
    warnings,
    config
  }
}

function validateLocalnet(_errors: string[], warnings: string[]): void {
  // Localnet should have everything auto-configured
  // Just check that we're not accidentally using production keys
  if (process.env.DEPLOYER_PRIVATE_KEY && !process.env.DEPLOYER_PRIVATE_KEY.startsWith('0xac0974')) {
    warnings.push('Using non-default private key for localnet (this is OK if intentional)')
  }

  // Check Redis (optional but recommended)
  if (!process.env.REDIS_URL) {
    warnings.push('REDIS_URL not set (SSE will use polling fallback)')
  }
}

function validateTestnet(errors: string[], warnings: string[]): void {
  // Testnet requires contracts to be deployed
  if (!process.env.NEXT_PUBLIC_DIAMOND_ADDRESS) {
    errors.push('NEXT_PUBLIC_DIAMOND_ADDRESS is required for testnet')
    errors.push('Deploy contracts with: bun run contracts:deploy:testnet')
  }

  if (!process.env.NEXT_PUBLIC_IDENTITY_REGISTRY) {
    errors.push('NEXT_PUBLIC_IDENTITY_REGISTRY is required for testnet')
  }

  // Check for deployment keys (warning only for dev server)
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    warnings.push('DEPLOYER_PRIVATE_KEY not set (required for contract deployment)')
  }

  // Check Agent0 configuration
  if (process.env.AGENT0_ENABLED === 'true') {
    if (!process.env.BASE_SEPOLIA_RPC_URL) {
      errors.push('BASE_SEPOLIA_RPC_URL is required when AGENT0_ENABLED=true')
    }
    if (!process.env.BABYLON_GAME_PRIVATE_KEY) {
      errors.push('BABYLON_GAME_PRIVATE_KEY is required when AGENT0_ENABLED=true')
    }
    if (!process.env.AGENT0_SUBGRAPH_URL) {
      warnings.push('AGENT0_SUBGRAPH_URL not set (Agent0 discovery may not work)')
    }
  }

  // Check for verification key
  if (!process.env.ETHERSCAN_API_KEY) {
    warnings.push('ETHERSCAN_API_KEY not set (contract verification will fail)')
  }
}

function validateMainnet(errors: string[], warnings: string[]): void {
  // Mainnet requires explicit opt-in
  if (process.env.USE_MAINNET !== 'true') {
    errors.push('USE_MAINNET must be set to "true" to deploy to mainnet')
    errors.push('This is a safety check to prevent accidental mainnet deployments')
  }

  // Require all contract addresses
  if (!process.env.NEXT_PUBLIC_DIAMOND_ADDRESS) {
    errors.push('NEXT_PUBLIC_DIAMOND_ADDRESS is required for mainnet')
  }

  if (!process.env.NEXT_PUBLIC_IDENTITY_REGISTRY) {
    errors.push('NEXT_PUBLIC_IDENTITY_REGISTRY is required for mainnet')
  }

  if (!process.env.NEXT_PUBLIC_REPUTATION_SYSTEM) {
    errors.push('NEXT_PUBLIC_REPUTATION_SYSTEM is required for mainnet')
  }

  // Require deployment key
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    errors.push('DEPLOYER_PRIVATE_KEY is required for mainnet deployment')
  }

  // Require verification key
  if (!process.env.ETHERSCAN_API_KEY) {
    errors.push('ETHERSCAN_API_KEY is required for mainnet (contract verification)')
  }

  // Check Agent0 for mainnet
  if (process.env.AGENT0_ENABLED === 'true') {
    if (!process.env.BASE_RPC_URL) {
      errors.push('BASE_RPC_URL is required when AGENT0_ENABLED=true on mainnet')
    }
    if (!process.env.BABYLON_GAME_PRIVATE_KEY) {
      errors.push('BABYLON_GAME_PRIVATE_KEY is required when AGENT0_ENABLED=true')
    }
    if (!process.env.AGENT0_SUBGRAPH_URL) {
      errors.push('AGENT0_SUBGRAPH_URL is required for mainnet Agent0 integration')
    }
  }

  // Production checks
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
      errors.push('Privy credentials required for production')
    }

    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      warnings.push('PostHog analytics not configured')
    }
  }
}

/**
 * Get required environment variables for an environment
 */
export function getRequiredEnvVars(env: DeploymentEnv): string[] {
  const common = ['DATABASE_URL']

  switch (env) {
    case 'localnet':
      return [...common]

    case 'testnet':
      return [
        ...common,
        'NEXT_PUBLIC_CHAIN_ID',
        'NEXT_PUBLIC_RPC_URL',
        'NEXT_PUBLIC_DIAMOND_ADDRESS',
        'NEXT_PUBLIC_IDENTITY_REGISTRY'
      ]

    case 'mainnet':
      return [
        ...common,
        'USE_MAINNET',
        'NEXT_PUBLIC_CHAIN_ID',
        'NEXT_PUBLIC_RPC_URL',
        'NEXT_PUBLIC_DIAMOND_ADDRESS',
        'NEXT_PUBLIC_IDENTITY_REGISTRY',
        'NEXT_PUBLIC_REPUTATION_SYSTEM',
        'DEPLOYER_PRIVATE_KEY',
        'ETHERSCAN_API_KEY'
      ]
  }
}

/**
 * Print validation result
 */
export function printValidationResult(result: EnvValidationResult): void {
  logger.info(`Environment: ${result.environment} (${result.config.name})`, undefined, 'EnvDetection')
  logger.info(`Chain ID: ${result.config.chainId}`, undefined, 'EnvDetection')
  logger.info(`RPC URL: ${result.config.rpcUrl}`, undefined, 'EnvDetection')

  if (result.warnings.length > 0) {
    logger.warn('Warnings:', undefined, 'EnvDetection')
    result.warnings.forEach(warning => {
      logger.warn(`  ⚠️  ${warning}`, undefined, 'EnvDetection')
    })
  }

  if (result.errors.length > 0) {
    logger.error('Validation failed:', undefined, 'EnvDetection')
    result.errors.forEach(error => {
      logger.error(`  ❌ ${error}`, undefined, 'EnvDetection')
    })
    throw new Error('Environment validation failed')
  }

  if (result.warnings.length === 0 && result.errors.length === 0) {
    logger.info('✅ Environment validation passed', undefined, 'EnvDetection')
  }
}

/**
 * Load environment file for specific environment
 */
export function loadEnvFile(env: DeploymentEnv): void {
  const envFiles = {
    localnet: '.env.local',
    testnet: '.env.testnet',
    mainnet: '.env.production'
  }

  const envFile = envFiles[env]
  logger.info(`Loading environment from ${envFile}`, undefined, 'EnvDetection')

  // Note: In production, dotenv should be loaded before this
  // This is mainly for documentation
}

/**
 * Get deployment info for display
 */
export function getDeploymentInfo(): {
  environment: DeploymentEnv
  chain: string
  chainId: number
  rpcUrl: string
  explorerUrl: string
  contractsDeployed: boolean
  agent0Enabled: boolean
} {
  const environment = detectEnvironment()
  const config = CHAIN_CONFIGS[environment]

  return {
    environment,
    chain: config.name,
    chainId: config.chainId,
    rpcUrl: config.rpcUrl,
    explorerUrl: config.explorerUrl,
    contractsDeployed: !!(process.env.NEXT_PUBLIC_DIAMOND_ADDRESS),
    agent0Enabled: process.env.AGENT0_ENABLED === 'true'
  }
}

