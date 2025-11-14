/**
 * Deployment Validation Utilities
 * 
 * Validate that contracts are deployed and working correctly.
 */

import { logger } from '@/lib/logger'
import { ethers } from 'ethers'
import type { DeploymentEnv } from './env-detection'

export interface ContractAddresses {
  // Diamond system
  diamond: string
  diamondCutFacet: string
  diamondLoupeFacet: string
  predictionMarketFacet: string
  oracleFacet: string
  liquidityPoolFacet: string
  perpetualMarketFacet: string
  referralSystemFacet: string
  // Identity system
  identityRegistry: string
  reputationSystem: string
  // Oracle system
  babylonOracle?: string
  predimarket?: string
  marketFactory?: string
  contestOracle?: string
  // Moderation system
  banManager?: string
  reportingSystem?: string
  labelManager?: string
  // Test infrastructure
  chainlinkOracle?: string
  umaOracle?: string
  testToken?: string
}

export interface DeploymentInfo {
  network: string
  chainId: number
  contracts: ContractAddresses
  deployer: string
  timestamp: string
  blockNumber: number
}

export interface ValidationResult {
  valid: boolean
  deployed: boolean
  errors: string[]
  warnings: string[]
  contracts: Partial<ContractAddresses>
}

/**
 * Load deployment info from JSON file
 */
export async function loadDeployment(env: DeploymentEnv): Promise<DeploymentInfo | null> {
  const fs = await import('fs')
  const path = await import('path')

  const deploymentPaths = {
    localnet: 'deployments/local/latest.json',
    testnet: 'deployments/base-sepolia/latest.json',
    mainnet: 'deployments/base/latest.json'
  }

  const filepath = path.join(process.cwd(), deploymentPaths[env])

  if (!fs.existsSync(filepath)) {
    return null
  }

  const data = fs.readFileSync(filepath, 'utf-8')
  return JSON.parse(data) as DeploymentInfo
}

/**
 * Save deployment info to JSON file
 */
export async function saveDeployment(env: DeploymentEnv, deployment: DeploymentInfo): Promise<void> {
  const fs = await import('fs')
  const path = await import('path')

  const deploymentPaths = {
    localnet: 'deployments/local',
    testnet: 'deployments/base-sepolia',
    mainnet: 'deployments/base'
  }

  const dirpath = path.join(process.cwd(), deploymentPaths[env])
  const filepath = path.join(dirpath, 'latest.json')

  // Create directory if it doesn't exist
  if (!fs.existsSync(dirpath)) {
    fs.mkdirSync(dirpath, { recursive: true })
  }

  fs.writeFileSync(filepath, JSON.stringify(deployment, null, 2))
  logger.info(`Deployment saved to ${filepath}`, undefined, 'DeploymentValidation')
}

/**
 * Validate contract deployment
 */
export async function validateDeployment(
  env: DeploymentEnv,
  rpcUrl: string,
  expectedContracts?: Partial<ContractAddresses>
): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const contracts: Partial<ContractAddresses> = {}

  try {
    // Load deployment info
    const deployment = await loadDeployment(env)

    if (!deployment) {
      return {
        valid: false,
        deployed: false,
        errors: [
          `No deployment found for ${env}`,
          'Run the deployment script to deploy contracts'
        ],
        warnings: [],
        contracts: {}
      }
    }

    // Create provider
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Check network
    const network = await provider.getNetwork()
    const deploymentChainId = BigInt(deployment.chainId)
    if (network.chainId !== deploymentChainId) {
      errors.push(
        `Chain ID mismatch: provider is ${network.chainId}, deployment is ${deploymentChainId}`
      )
    }

    // Validate each contract
    const contractsToValidate = expectedContracts || deployment.contracts

    // Diamond (main proxy)
    if (contractsToValidate.diamond) {
      const code = await provider.getCode(contractsToValidate.diamond)
      if (code === '0x' || code === '0x0') {
        errors.push(`Diamond not deployed at ${contractsToValidate.diamond}`)
      } else {
        contracts.diamond = contractsToValidate.diamond
        logger.info(`✅ Diamond verified at ${contractsToValidate.diamond}`, undefined, 'DeploymentValidation')
      }
    }

    // Identity Registry
    if (contractsToValidate.identityRegistry) {
      const code = await provider.getCode(contractsToValidate.identityRegistry)
      if (code === '0x' || code === '0x0') {
        errors.push(`Identity Registry not deployed at ${contractsToValidate.identityRegistry}`)
      } else {
        contracts.identityRegistry = contractsToValidate.identityRegistry
        logger.info(`✅ Identity Registry verified at ${contractsToValidate.identityRegistry}`, undefined, 'DeploymentValidation')
      }
    }

    // Reputation System
    if (contractsToValidate.reputationSystem) {
      const code = await provider.getCode(contractsToValidate.reputationSystem)
      if (code === '0x' || code === '0x0') {
        errors.push(`Reputation System not deployed at ${contractsToValidate.reputationSystem}`)
      } else {
        contracts.reputationSystem = contractsToValidate.reputationSystem
        logger.info(`✅ Reputation System verified at ${contractsToValidate.reputationSystem}`, undefined, 'DeploymentValidation')
      }
    }

    // Test a simple contract call to ensure it's working
    if (contracts.diamond) {
      try {
        // Try to call a read function (getBalance is safe)
        const diamondContract = new ethers.Contract(
          contracts.diamond,
          ['function getBalance(address) view returns (uint256)'],
          provider
        )

        if (diamondContract.getBalance) {
          await diamondContract.getBalance(ethers.ZeroAddress)
        }
        logger.info('✅ Diamond contract is functional', undefined, 'DeploymentValidation')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        warnings.push(`Diamond contract may not be fully functional: ${errorMessage}`)
      }
    }

    return {
      valid: errors.length === 0,
      deployed: Object.keys(contracts).length > 0,
      errors,
      warnings,
      contracts
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      valid: false,
      deployed: false,
      errors: [`Validation failed: ${errorMessage}`],
      warnings,
      contracts
    }
  }
}

/**
 * Check if a contract is deployed at an address
 */
export async function isContractDeployed(rpcUrl: string, address: string): Promise<boolean> {
  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const code = await provider.getCode(address)
  return code !== '0x' && code !== '0x0'
}

/**
 * Get contract addresses from environment variables
 */
export function getContractAddressesFromEnv(): Partial<ContractAddresses> {
  return {
    diamond: process.env.NEXT_PUBLIC_DIAMOND_ADDRESS,
    identityRegistry: process.env.NEXT_PUBLIC_IDENTITY_REGISTRY,
    reputationSystem: process.env.NEXT_PUBLIC_REPUTATION_SYSTEM,
    babylonOracle: process.env.NEXT_PUBLIC_BABYLON_ORACLE,
    predimarket: process.env.NEXT_PUBLIC_PREDIMARKET,
    marketFactory: process.env.NEXT_PUBLIC_MARKET_FACTORY,
    contestOracle: process.env.NEXT_PUBLIC_CONTEST_ORACLE,
    banManager: process.env.NEXT_PUBLIC_BAN_MANAGER,
    reportingSystem: process.env.NEXT_PUBLIC_REPORTING_SYSTEM,
    labelManager: process.env.NEXT_PUBLIC_LABEL_MANAGER,
    chainlinkOracle: process.env.NEXT_PUBLIC_CHAINLINK_ORACLE,
    umaOracle: process.env.NEXT_PUBLIC_UMA_ORACLE,
    testToken: process.env.NEXT_PUBLIC_TEST_TOKEN
  }
}

/**
 * Update environment file with contract addresses
 */
export async function updateEnvFile(env: DeploymentEnv, contracts: ContractAddresses): Promise<void> {
  const fs = await import('fs')
  const path = await import('path')

  const envFiles = {
    localnet: '.env.local',
    testnet: '.env.testnet',
    mainnet: '.env.production'
  }

  const envFile = path.join(process.cwd(), envFiles[env])

  let envContent = ''
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf-8')
  }

  // Update or add contract addresses
  const updates = {
    NEXT_PUBLIC_DIAMOND_ADDRESS: contracts.diamond,
    NEXT_PUBLIC_IDENTITY_REGISTRY: contracts.identityRegistry,
    NEXT_PUBLIC_REPUTATION_SYSTEM: contracts.reputationSystem,
    NEXT_PUBLIC_PREDICTION_MARKET_FACET: contracts.predictionMarketFacet,
    NEXT_PUBLIC_ORACLE_FACET: contracts.oracleFacet,
    NEXT_PUBLIC_LIQUIDITY_POOL_FACET: contracts.liquidityPoolFacet,
    NEXT_PUBLIC_PERPETUAL_MARKET_FACET: contracts.perpetualMarketFacet,
    NEXT_PUBLIC_REFERRAL_SYSTEM_FACET: contracts.referralSystemFacet
  }

  if (contracts.chainlinkOracle) {
    Object.assign(updates, { NEXT_PUBLIC_CHAINLINK_ORACLE: contracts.chainlinkOracle })
  }

  if (contracts.umaOracle) {
    Object.assign(updates, { NEXT_PUBLIC_UMA_ORACLE: contracts.umaOracle })
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      const match = envContent.match(regex)
      if (match) {
        envContent = envContent.replace(regex, `${key}=${value}`)
      } else {
        envContent += `\n${key}=${value}`
      }
    }
  }

  fs.writeFileSync(envFile, envContent)
  logger.info(`Updated ${envFile} with contract addresses`, undefined, 'DeploymentValidation')
}

/**
 * Print validation result
 */
export function printValidationResult(result: ValidationResult, env: DeploymentEnv): void {
  if (!result.deployed) {
    logger.error(`❌ No contracts deployed for ${env}`, undefined, 'DeploymentValidation')
    result.errors.forEach(error => {
      logger.error(`   ${error}`, undefined, 'DeploymentValidation')
    })

    logger.info('\nTo deploy contracts, run:', undefined, 'DeploymentValidation')
    logger.info(`   bun run contracts:deploy:${env === 'testnet' ? 'testnet' : env === 'mainnet' ? 'mainnet' : 'local'}`, undefined, 'DeploymentValidation')
    return
  }

  if (result.warnings.length > 0) {
    logger.warn('Warnings:', undefined, 'DeploymentValidation')
    result.warnings.forEach(warning => {
      logger.warn(`  ⚠️  ${warning}`, undefined, 'DeploymentValidation')
    })
  }

  if (result.errors.length > 0) {
    logger.error('Validation errors:', undefined, 'DeploymentValidation')
    result.errors.forEach(error => {
      logger.error(`  ❌ ${error}`, undefined, 'DeploymentValidation')
    })
    throw new Error('Contract validation failed')
  }

  if (!result.valid) {
    throw new Error('Contract validation failed')
  }

  logger.info('✅ All contracts validated successfully', undefined, 'DeploymentValidation')
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  provider: ethers.Provider,
  txHash: string,
  confirmations: number = 1
): Promise<ethers.TransactionReceipt | null> {
  logger.info(`Waiting for transaction ${txHash}...`, undefined, 'DeploymentValidation')

  let attempts = 0
  const maxAttempts = 60 // 5 minutes with 5s intervals

  while (attempts < maxAttempts) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash)
      if (receipt && receipt.blockNumber) {
        const currentBlock = await provider.getBlockNumber()
        const confirmedBlocks = currentBlock - receipt.blockNumber

        if (confirmedBlocks >= confirmations) {
          logger.info(`✅ Transaction confirmed (${confirmedBlocks} blocks)`, undefined, 'DeploymentValidation')
          return receipt
        }

        logger.info(`Transaction has ${confirmedBlocks}/${confirmations} confirmations`, undefined, 'DeploymentValidation')
      }
    } catch (error) {
      logger.warn('Error checking transaction', { error }, 'DeploymentValidation')
    }

    await new Promise(resolve => setTimeout(resolve, 5000))
    attempts++
  }

  throw new Error('Transaction confirmation timeout')
}

