#!/usr/bin/env bun
/// <reference types="bun-types" />
/**
 * Local Contract Deployment Script
 * 
 * Deploys all Babylon contracts to local Anvil instance
 * - Uses default Anvil account for deployment
 * - Saves deployment addresses
 * - Updates .env.local
 */

import { $ } from 'bun'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { ContractAddresses, DeploymentInfo } from '../../src/lib/deployment/validation'
import { saveDeployment, updateEnvFile } from '../../src/lib/deployment/validation'
import { logger } from '../../src/lib/logger'

const ANVIL_RPC_URL = 'http://localhost:8545'
const ANVIL_CHAIN_ID = 31337

// Default Anvil account #0
const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const DEPLOYER_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

async function main() {
  logger.info('Deploying Babylon contracts to localnet...', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')

  // 1. Check Anvil is running
  await $`cast block-number --rpc-url ${ANVIL_RPC_URL}`.quiet().catch(() => {
    logger.error('❌ Anvil is not running', undefined, 'Script')
    logger.info('Start Anvil with: docker-compose up -d anvil', undefined, 'Script')
    process.exit(1)
  })
  logger.info('✅ Anvil is running', undefined, 'Script')

  // 2. Compile contracts
  logger.info('Compiling contracts...', undefined, 'Script')
  await $`forge build`.quiet()
  logger.info('✅ Contracts compiled', undefined, 'Script')

  // 3. Deploy using forge script
  logger.info('Deploying contracts...', undefined, 'Script')

  const scriptPath = 'scripts/DeployBabylon.s.sol:DeployBabylon'

  // Set environment variables for the forge script
  process.env.DEPLOYER_PRIVATE_KEY = ANVIL_PRIVATE_KEY
  process.env.ETHERSCAN_API_KEY = 'dummy' // Not used for local deployment
  
  const output = await $`forge script ${scriptPath} \
    --rpc-url ${ANVIL_RPC_URL} \
    --private-key ${ANVIL_PRIVATE_KEY} \
    --broadcast \
    --legacy`.text()

  logger.info('✅ Deployment transaction sent', undefined, 'Script')

  // Parse output for contract addresses
  const addresses = parseDeploymentOutput(output)

  if (!addresses.diamond) {
    throw new Error('Failed to parse deployment addresses from output')
  }

    logger.info('Contract addresses:', undefined, 'Script')
    logger.info('\n--- Diamond System ---', undefined, 'Script')
    logger.info(`  Diamond: ${addresses.diamond}`, undefined, 'Script')
    logger.info(`  DiamondCutFacet: ${addresses.diamondCutFacet}`, undefined, 'Script')
    logger.info(`  DiamondLoupeFacet: ${addresses.diamondLoupeFacet}`, undefined, 'Script')
    logger.info(`  PredictionMarketFacet: ${addresses.predictionMarketFacet}`, undefined, 'Script')
    logger.info(`  OracleFacet: ${addresses.oracleFacet}`, undefined, 'Script')
    logger.info(`  LiquidityPoolFacet: ${addresses.liquidityPoolFacet}`, undefined, 'Script')
    logger.info(`  PerpetualMarketFacet: ${addresses.perpetualMarketFacet}`, undefined, 'Script')
    logger.info(`  ReferralSystemFacet: ${addresses.referralSystemFacet}`, undefined, 'Script')
    
    logger.info('\n--- Identity System ---', undefined, 'Script')
    logger.info(`  IdentityRegistry: ${addresses.identityRegistry}`, undefined, 'Script')
    logger.info(`  ReputationSystem: ${addresses.reputationSystem}`, undefined, 'Script')
    
    logger.info('\n--- Oracle System ---', undefined, 'Script')
    logger.info(`  BabylonOracle: ${addresses.babylonOracle}`, undefined, 'Script')
    logger.info(`  Predimarket: ${addresses.predimarket}`, undefined, 'Script')
    logger.info(`  MarketFactory: ${addresses.marketFactory}`, undefined, 'Script')
    logger.info(`  ContestOracle: ${addresses.contestOracle}`, undefined, 'Script')
    
    logger.info('\n--- Moderation System ---', undefined, 'Script')
    logger.info(`  BanManager: ${addresses.banManager}`, undefined, 'Script')
    logger.info(`  ReportingSystem: ${addresses.reportingSystem}`, undefined, 'Script')
    logger.info(`  ReputationLabelManager: ${addresses.labelManager}`, undefined, 'Script')
    
    logger.info('\n--- Test Infrastructure ---', undefined, 'Script')
    if (addresses.chainlinkOracle) {
      logger.info(`  ChainlinkOracle: ${addresses.chainlinkOracle}`, undefined, 'Script')
    }
    if (addresses.umaOracle) {
      logger.info(`  UMAOracle: ${addresses.umaOracle}`, undefined, 'Script')
    }
    if (addresses.testToken) {
      logger.info(`  TestToken: ${addresses.testToken}`, undefined, 'Script')
    }

    // 4. Save deployment info
    const blockNumber = await $`cast block-number --rpc-url ${ANVIL_RPC_URL}`.text()

    const deploymentInfo: DeploymentInfo = {
      network: 'localnet',
      chainId: ANVIL_CHAIN_ID,
      contracts: addresses,
      deployer: DEPLOYER_ADDRESS,
      timestamp: new Date().toISOString(),
      blockNumber: parseInt(blockNumber.trim())
    }

    await saveDeployment('localnet', deploymentInfo)

    // 5. Update .env.local
    await updateEnvFile('localnet', addresses)

    // 6. Also update .env if it exists (for convenience)
    const envPath = join(process.cwd(), '.env')
    if (existsSync(envPath)) {
      let envContent = readFileSync(envPath, 'utf-8')

      const updates = {
        NEXT_PUBLIC_CHAIN_ID: ANVIL_CHAIN_ID.toString(),
        NEXT_PUBLIC_RPC_URL: ANVIL_RPC_URL,
        NEXT_PUBLIC_DIAMOND_ADDRESS: addresses.diamond,
        NEXT_PUBLIC_IDENTITY_REGISTRY: addresses.identityRegistry,
        NEXT_PUBLIC_REPUTATION_SYSTEM: addresses.reputationSystem,
        NEXT_PUBLIC_BABYLON_ORACLE: addresses.babylonOracle,
        NEXT_PUBLIC_PREDIMARKET: addresses.predimarket,
        NEXT_PUBLIC_MARKET_FACTORY: addresses.marketFactory,
        NEXT_PUBLIC_CONTEST_ORACLE: addresses.contestOracle,
        NEXT_PUBLIC_BAN_MANAGER: addresses.banManager,
        NEXT_PUBLIC_REPORTING_SYSTEM: addresses.reportingSystem,
        NEXT_PUBLIC_LABEL_MANAGER: addresses.labelManager,
        NEXT_PUBLIC_TEST_TOKEN: addresses.testToken || '',
      }

      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^${key}=.*$`, 'm')
        if (envContent.match(regex)) {
          envContent = envContent.replace(regex, `${key}=${value}`)
        } else {
          envContent += `\n${key}=${value}`
        }
      }

      writeFileSync(envPath, envContent)
      logger.info('✅ Updated .env with contract addresses', undefined, 'Script')
    }

    logger.info('='.repeat(60), undefined, 'Script')
    logger.info('✅ Local deployment complete!', undefined, 'Script')
    logger.info(`Deployment saved to: deployments/local/latest.json`, undefined, 'Script')
    logger.info('', undefined, 'Script')
    logger.info('You can now start the dev server:', undefined, 'Script')
    logger.info('  bun run dev', undefined, 'Script')
}

/**
 * Parse contract addresses from forge script output
 */
function parseDeploymentOutput(output: string): ContractAddresses {
  const addresses: Partial<ContractAddresses> = {}

  // Parse lines like "DiamondCutFacet: 0x..."
  const patterns = {
    // Diamond system
    diamondCutFacet: /DiamondCutFacet:\s*(0x[a-fA-F0-9]{40})/,
    diamondLoupeFacet: /DiamondLoupeFacet:\s*(0x[a-fA-F0-9]{40})/,
    predictionMarketFacet: /PredictionMarketFacet:\s*(0x[a-fA-F0-9]{40})/,
    oracleFacet: /OracleFacet:\s*(0x[a-fA-F0-9]{40})/,
    liquidityPoolFacet: /LiquidityPoolFacet:\s*(0x[a-fA-F0-9]{40})/,
    perpetualMarketFacet: /PerpetualMarketFacet:\s*(0x[a-fA-F0-9]{40})/,
    referralSystemFacet: /ReferralSystemFacet:\s*(0x[a-fA-F0-9]{40})/,
    diamond: /Diamond:\s*(0x[a-fA-F0-9]{40})/,
    // Identity system
    identityRegistry: /IdentityRegistry:\s*(0x[a-fA-F0-9]{40})/,
    reputationSystem: /ReputationSystem:\s*(0x[a-fA-F0-9]{40})/,
    // Oracle system
    babylonOracle: /BabylonGameOracle:\s*(0x[a-fA-F0-9]{40})/,
    predimarket: /Predimarket:\s*(0x[a-fA-F0-9]{40})/,
    marketFactory: /MarketFactory:\s*(0x[a-fA-F0-9]{40})/,
    contestOracle: /ContestOracle:\s*(0x[a-fA-F0-9]{40})/,
    // Moderation system
    banManager: /BanManager:\s*(0x[a-fA-F0-9]{40})/,
    reportingSystem: /ReportingSystem:\s*(0x[a-fA-F0-9]{40})/,
    labelManager: /ReputationLabelManager:\s*(0x[a-fA-F0-9]{40})/,
    // Test infrastructure
    chainlinkOracle: /ChainlinkOracle.*:\s*(0x[a-fA-F0-9]{40})/,
    umaOracle: /UMAOracle.*:\s*(0x[a-fA-F0-9]{40})/,
    testToken: /TestToken.*:\s*(0x[a-fA-F0-9]{40})/
  }

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = output.match(pattern)
    if (match) {
      addresses[key as keyof ContractAddresses] = match[1]
    }
  }

  return addresses as ContractAddresses
}

// Run deployment
main().catch((error) => {
  logger.error('Deployment script failed:', error, 'Script')
  process.exit(1)
})

