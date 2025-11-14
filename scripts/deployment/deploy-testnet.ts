#!/usr/bin/env bun
/**
 * Testnet Contract Deployment Script
 * 
 * Deploys all Babylon contracts to Base Sepolia testnet
 * - Requires DEPLOYER_PRIVATE_KEY
 * - Verifies contracts on BaseScan
 * - Saves deployment addresses
 */

import { $ } from 'bun'
import { logger } from '../../src/lib/logger'
import type { DeploymentInfo, ContractAddresses } from '../../src/lib/deployment/validation'
import { saveDeployment, updateEnvFile, validateDeployment } from '../../src/lib/deployment/validation'
import { ethers } from 'ethers'

const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
const BASE_SEPOLIA_CHAIN_ID = 84532

async function main() {
  logger.info('Deploying Babylon contracts to Base Sepolia testnet...', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')

  // 1. Validate environment
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    logger.error('❌ DEPLOYER_PRIVATE_KEY is required', undefined, 'Script')
    logger.info('Set your deployer private key:', undefined, 'Script')
    logger.info('  export DEPLOYER_PRIVATE_KEY=0x...', undefined, 'Script')
    process.exit(1)
  }

  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY)
  const deployerAddress = wallet.address

  logger.info(`Deployer: ${deployerAddress}`, undefined, 'Script')

  // Check deployer balance
  const provider = new ethers.JsonRpcProvider(BASE_SEPOLIA_RPC_URL)
  const balance = await provider.getBalance(deployerAddress)
  const balanceEth = ethers.formatEther(balance)

  logger.info(`Balance: ${balanceEth} ETH`, undefined, 'Script')

  if (balance < ethers.parseEther('0.1')) {
    logger.warn('⚠️  Low balance. You may need more ETH for deployment.', undefined, 'Script')
    logger.info('Get testnet ETH from: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet', undefined, 'Script')
  }

  // Check for API key (for verification)
  if (!process.env.ETHERSCAN_API_KEY) {
    logger.warn('⚠️  ETHERSCAN_API_KEY not set. Contract verification will be skipped.', undefined, 'Script')
    logger.info('Get API key from: https://basescan.org/myapikey', undefined, 'Script')
  }

  // 2. Compile contracts
  logger.info('Compiling contracts...', undefined, 'Script')
  await $`forge build`.quiet()
  logger.info('✅ Contracts compiled', undefined, 'Script')

  // 3. Confirm deployment
  logger.info('', undefined, 'Script')
  logger.warn('⚠️  You are about to deploy to Base Sepolia TESTNET', undefined, 'Script')
  logger.warn('   This will cost real ETH (on testnet).', undefined, 'Script')
  logger.info('', undefined, 'Script')

  // Check if we're in CI or need confirmation
  if (process.env.CI !== 'true') {
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    await new Promise<void>((resolve) => {
      rl.question('Continue? (yes/no): ', (answer: string) => {
        rl.close()
        if (answer.toLowerCase() !== 'yes') {
          logger.info('Deployment cancelled', undefined, 'Script')
          process.exit(0)
        }
        resolve()
      })
    })
  }

  // 4. Deploy using forge script
  logger.info('Deploying contracts...', undefined, 'Script')

  const scriptPath = 'scripts/DeployBabylon.s.sol:DeployBabylon'
  const verifyFlag = process.env.ETHERSCAN_API_KEY ? '--verify' : ''

  const output = await $`forge script ${scriptPath} \
    --rpc-url ${BASE_SEPOLIA_RPC_URL} \
    --broadcast \
    ${verifyFlag} \
    -vvv`.text()

  logger.info('✅ Deployment transaction sent', undefined, 'Script')

  // Parse output for contract addresses
  const addresses = parseDeploymentOutput(output)

  if (!addresses.diamond) {
    throw new Error('Failed to parse deployment addresses from output')
  }

  try {
    logger.info('Contract addresses:', undefined, 'Script')
    logger.info(`  Diamond: ${addresses.diamond}`, undefined, 'Script')
    logger.info(`  DiamondCutFacet: ${addresses.diamondCutFacet}`, undefined, 'Script')
    logger.info(`  DiamondLoupeFacet: ${addresses.diamondLoupeFacet}`, undefined, 'Script')
    logger.info(`  PredictionMarketFacet: ${addresses.predictionMarketFacet}`, undefined, 'Script')
    logger.info(`  OracleFacet: ${addresses.oracleFacet}`, undefined, 'Script')
    logger.info(`  LiquidityPoolFacet: ${addresses.liquidityPoolFacet}`, undefined, 'Script')
    logger.info(`  PerpetualMarketFacet: ${addresses.perpetualMarketFacet}`, undefined, 'Script')
    logger.info(`  ReferralSystemFacet: ${addresses.referralSystemFacet}`, undefined, 'Script')
    logger.info(`  IdentityRegistry: ${addresses.identityRegistry}`, undefined, 'Script')
    logger.info(`  ReputationSystem: ${addresses.reputationSystem}`, undefined, 'Script')
    if (addresses.chainlinkOracle) {
      logger.info(`  ChainlinkOracle (Mock): ${addresses.chainlinkOracle}`, undefined, 'Script')
    }
    if (addresses.umaOracle) {
      logger.info(`  UMAOracle (Mock): ${addresses.umaOracle}`, undefined, 'Script')
    }

    // 5. Wait for confirmations
    logger.info('Waiting for confirmations...', undefined, 'Script')
    await new Promise(resolve => setTimeout(resolve, 10000))

    // 6. Validate deployment
    logger.info('Validating deployment...', undefined, 'Script')
    const validation = await validateDeployment('testnet', BASE_SEPOLIA_RPC_URL, addresses)

    if (!validation.valid) {
      logger.error('❌ Deployment validation failed', undefined, 'Script')
      validation.errors.forEach(error => logger.error(`   ${error}`, undefined, 'Script'))
      process.exit(1)
    }

    logger.info('✅ Deployment validated', undefined, 'Script')

    // 7. Save deployment info
    const blockNumber = await provider.getBlockNumber()

    const deploymentInfo: DeploymentInfo = {
      network: 'base-sepolia',
      chainId: BASE_SEPOLIA_CHAIN_ID,
      contracts: addresses,
      deployer: deployerAddress,
      timestamp: new Date().toISOString(),
      blockNumber
    }

    await saveDeployment('testnet', deploymentInfo)

    // 8. Update .env.testnet
    await updateEnvFile('testnet', addresses)

    logger.info('='.repeat(60), undefined, 'Script')
    logger.info('✅ Testnet deployment complete!', undefined, 'Script')
    logger.info(`Deployment saved to: deployments/base-sepolia/latest.json`, undefined, 'Script')
    logger.info('', undefined, 'Script')
    logger.info('View contracts on BaseScan:', undefined, 'Script')
    logger.info(`  Diamond: https://sepolia.basescan.org/address/${addresses.diamond}`, undefined, 'Script')
    logger.info(`  Identity Registry: https://sepolia.basescan.org/address/${addresses.identityRegistry}`, undefined, 'Script')
    logger.info('', undefined, 'Script')

    // 9. Attempt Agent0 registration (if configured)
    await attemptAgent0Registration()

    logger.info('Next steps:', undefined, 'Script')
    if (!process.env.AGENT0_ENABLED || process.env.AGENT0_ENABLED !== 'true') {
      logger.info('  1. Configure Agent0: bun run agent0:configure', undefined, 'Script')
      logger.info('  2. Register with Agent0: bun run agent0:register', undefined, 'Script')
      logger.info('  3. Start dev server: bun run dev:testnet', undefined, 'Script')
    } else {
      logger.info('  1. Verify contracts (if not auto-verified): bun run scripts/verify-contracts.sh', undefined, 'Script')
      logger.info('  2. Start dev server: bun run dev:testnet', undefined, 'Script')
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('❌ Deployment failed:', errorMessage, 'Script')
    process.exit(1)
  }
}

/**
 * Attempt to register with Agent0 after deployment
 */
async function attemptAgent0Registration(): Promise<void> {
  if (process.env.AGENT0_ENABLED !== 'true') {
    logger.info('⚠️  Agent0 not enabled', undefined, 'Script')
    logger.info('   To enable: bun run agent0:configure', undefined, 'Script')
    return
  }

  logger.info('', undefined, 'Script')
  logger.info('Checking Agent0 configuration...', undefined, 'Script')

  // Check required configuration
  const hasRpcUrl = !!(process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL)
  const hasPrivateKey = !!(process.env.BABYLON_GAME_PRIVATE_KEY || process.env.AGENT0_PRIVATE_KEY)
  const hasSubgraph = !!process.env.AGENT0_SUBGRAPH_URL

  if (!hasRpcUrl) {
    logger.warn('⚠️  BASE_SEPOLIA_RPC_URL not set', undefined, 'Script')
    logger.info('   Set in .env.testnet to enable Agent0 registration', undefined, 'Script')
    return
  }

  if (!hasPrivateKey) {
    logger.warn('⚠️  BABYLON_GAME_PRIVATE_KEY not set', undefined, 'Script')
    logger.info('   Set in .env.testnet to enable Agent0 registration', undefined, 'Script')
    return
  }

  if (!hasSubgraph) {
    logger.warn('⚠️  AGENT0_SUBGRAPH_URL not set', undefined, 'Script')
    logger.info('   Agent0 will work but discovery may be limited', undefined, 'Script')
  }

  // Try to register
  logger.info('Attempting Agent0 registration...', undefined, 'Script')

  await $`bun run agent0:register`.quiet().then(() => {
    logger.info('✅ Agent0 registration successful!', undefined, 'Script')
    logger.info('   Your game is now discoverable in the Agent0 network', undefined, 'Script')
  }).catch(() => {
    logger.warn('⚠️  Agent0 registration failed (you can register manually later)', undefined, 'Script')
    logger.info('   Run: bun run agent0:register', undefined, 'Script')
  })
}

/**
 * Parse contract addresses from forge script output
 */
function parseDeploymentOutput(output: string): ContractAddresses {
  const addresses: Partial<ContractAddresses> = {}

  const patterns = {
    diamondCutFacet: /DiamondCutFacet:\s*(0x[a-fA-F0-9]{40})/,
    diamondLoupeFacet: /DiamondLoupeFacet:\s*(0x[a-fA-F0-9]{40})/,
    predictionMarketFacet: /PredictionMarketFacet:\s*(0x[a-fA-F0-9]{40})/,
    oracleFacet: /OracleFacet:\s*(0x[a-fA-F0-9]{40})/,
    liquidityPoolFacet: /LiquidityPoolFacet:\s*(0x[a-fA-F0-9]{40})/,
    perpetualMarketFacet: /PerpetualMarketFacet:\s*(0x[a-fA-F0-9]{40})/,
    referralSystemFacet: /ReferralSystemFacet:\s*(0x[a-fA-F0-9]{40})/,
    diamond: /Diamond.*Proxy.*:\s*(0x[a-fA-F0-9]{40})|^Diamond:\s*(0x[a-fA-F0-9]{40})/m,
    identityRegistry: /IdentityRegistry:\s*(0x[a-fA-F0-9]{40})/,
    reputationSystem: /ReputationSystem:\s*(0x[a-fA-F0-9]{40})/,
    chainlinkOracle: /ChainlinkOracle.*:\s*(0x[a-fA-F0-9]{40})/,
    umaOracle: /UMAOracle.*:\s*(0x[a-fA-F0-9]{40})/
  }

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = output.match(pattern)
    if (match) {
      // Take the first non-null capture group
      addresses[key as keyof ContractAddresses] = match[1] || match[2]
    }
  }

  return addresses as ContractAddresses
}

// Run deployment
main().catch((error) => {
  logger.error('Deployment script failed:', error, 'Script')
  process.exit(1)
})

