#!/usr/bin/env bun
/**
 * Mainnet Contract Deployment Script
 * 
 * Deploys all Babylon contracts to Base mainnet
 * - Requires USE_MAINNET=true (safety check)
 * - Requires DEPLOYER_PRIVATE_KEY
 * - Performs dry-run simulation
 * - Verifies contracts on BaseScan
 * - Saves deployment addresses
 */

import { $ } from 'bun'
import { logger } from '../../src/lib/logger'
import type { DeploymentInfo, ContractAddresses } from '../../src/lib/deployment/validation'
import { saveDeployment, updateEnvFile, validateDeployment } from '../../src/lib/deployment/validation'
import { ethers } from 'ethers'

const BASE_MAINNET_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const BASE_MAINNET_CHAIN_ID = 8453

async function main() {
  logger.info('='.repeat(60), undefined, 'Script')
  logger.warn('⚠️  MAINNET DEPLOYMENT', undefined, 'Script')
  logger.info('='.repeat(60), undefined, 'Script')

  // 1. Safety check - require explicit opt-in
  if (process.env.USE_MAINNET !== 'true') {
    logger.error('❌ USE_MAINNET must be set to "true" to deploy to mainnet', undefined, 'Script')
    logger.info('This is a safety check to prevent accidental mainnet deployments.', undefined, 'Script')
    logger.info('', undefined, 'Script')
    logger.info('To deploy to mainnet:', undefined, 'Script')
    logger.info('  export USE_MAINNET=true', undefined, 'Script')
    logger.info('  bun run contracts:deploy:mainnet', undefined, 'Script')
    process.exit(1)
  }

  // 2. Validate environment
  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    logger.error('❌ DEPLOYER_PRIVATE_KEY is required', undefined, 'Script')
    logger.info('Set your deployer private key:', undefined, 'Script')
    logger.info('  export DEPLOYER_PRIVATE_KEY=0x...', undefined, 'Script')
    process.exit(1)
  }

  if (!process.env.ETHERSCAN_API_KEY) {
    logger.error('❌ ETHERSCAN_API_KEY is required for mainnet deployment', undefined, 'Script')
    logger.info('Get API key from: https://basescan.org/myapikey', undefined, 'Script')
    process.exit(1)
  }

  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY)
  const deployerAddress = wallet.address

  logger.info(`Deployer: ${deployerAddress}`, undefined, 'Script')

  // Check deployer balance
  const provider = new ethers.JsonRpcProvider(BASE_MAINNET_RPC_URL)
  const balance = await provider.getBalance(deployerAddress)
  const balanceEth = ethers.formatEther(balance)

  logger.info(`Balance: ${balanceEth} ETH`, undefined, 'Script')

  if (balance < ethers.parseEther('0.5')) {
    logger.error('❌ Insufficient balance for mainnet deployment', undefined, 'Script')
    logger.info(`Current: ${balanceEth} ETH`, undefined, 'Script')
    logger.info('Recommended: At least 0.5 ETH', undefined, 'Script')
    process.exit(1)
  }

  // 3. Estimate gas costs
  logger.info('', undefined, 'Script')
  logger.info('Estimating deployment costs...', undefined, 'Script')

  const gasPrice = await provider.getFeeData()
  const estimatedGas = 15_000_000n // Rough estimate for all contracts
  const estimatedCost = estimatedGas * (gasPrice.gasPrice || 0n)
  const estimatedCostEth = ethers.formatEther(estimatedCost)

  logger.info(`Estimated gas: ${estimatedGas.toLocaleString()}`, undefined, 'Script')
  logger.info(`Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0n, 'gwei')} gwei`, undefined, 'Script')
  logger.info(`Estimated cost: ${estimatedCostEth} ETH`, undefined, 'Script')

  // 4. Compile contracts
  logger.info('', undefined, 'Script')
  logger.info('Compiling contracts...', undefined, 'Script')
  await $`forge build`.quiet().catch((error: Error) => {
    logger.error('❌ Compilation failed', error, 'Script')
    process.exit(1)
  })
  logger.info('✅ Contracts compiled', undefined, 'Script')

  // 5. Dry run simulation
  logger.info('', undefined, 'Script')
  logger.info('Running deployment simulation...', undefined, 'Script')

  const scriptPath = 'scripts/DeployBabylon.s.sol:DeployBabylon'

  await $`forge script ${scriptPath} \
    --rpc-url ${BASE_MAINNET_RPC_URL} \
    -vvv`.quiet().catch((error) => {
    logger.error('❌ Simulation failed', undefined, 'Script')
    logger.error('   Fix issues before deploying to mainnet', error, 'Script')
    process.exit(1)
  })

  logger.info('✅ Simulation successful', undefined, 'Script')

  // 6. Final confirmation
  logger.info('', undefined, 'Script')
  logger.warn('⚠️  YOU ARE ABOUT TO DEPLOY TO BASE MAINNET', undefined, 'Script')
  logger.warn('   This will cost REAL ETH.', undefined, 'Script')
  logger.warn(`   Estimated cost: ${estimatedCostEth} ETH`, undefined, 'Script')
  logger.warn('   Deployer: ' + deployerAddress, undefined, 'Script')
  logger.info('', undefined, 'Script')

  // Require explicit confirmation
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const confirmed = await new Promise<boolean>((resolve) => {
    rl.question('Type "DEPLOY TO MAINNET" to confirm: ', (answer: string) => {
      rl.close()
      resolve(answer === 'DEPLOY TO MAINNET')
    })
  })

  if (!confirmed) {
    logger.info('Deployment cancelled', undefined, 'Script')
    process.exit(0)
  }

  // 7. Deploy
  logger.info('', undefined, 'Script')
  logger.info('Deploying contracts to Base mainnet...', undefined, 'Script')

  const output = await $`forge script ${scriptPath} \
    --rpc-url ${BASE_MAINNET_RPC_URL} \
    --broadcast \
    --verify \
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

    // 8. Wait for confirmations
    logger.info('Waiting for confirmations...', undefined, 'Script')
    await new Promise(resolve => setTimeout(resolve, 30000))

    // 9. Validate deployment
    logger.info('Validating deployment...', undefined, 'Script')
    const validation = await validateDeployment('mainnet', BASE_MAINNET_RPC_URL, addresses)

    if (!validation.valid) {
      logger.error('❌ Deployment validation failed', undefined, 'Script')
      validation.errors.forEach(error => logger.error(`   ${error}`, undefined, 'Script'))
      process.exit(1)
    }

    logger.info('✅ Deployment validated', undefined, 'Script')

    // 10. Save deployment info
    const blockNumber = await provider.getBlockNumber()

    const deploymentInfo: DeploymentInfo = {
      network: 'base-mainnet',
      chainId: BASE_MAINNET_CHAIN_ID,
      contracts: addresses,
      deployer: deployerAddress,
      timestamp: new Date().toISOString(),
      blockNumber
    }

    await saveDeployment('mainnet', deploymentInfo)

    // 11. Update .env.production
    await updateEnvFile('mainnet', addresses)

    logger.info('', undefined, 'Script')
    logger.info('='.repeat(60), undefined, 'Script')
    logger.info('✅ MAINNET DEPLOYMENT COMPLETE!', undefined, 'Script')
    logger.info('='.repeat(60), undefined, 'Script')
    logger.info(`Deployment saved to: deployments/base/latest.json`, undefined, 'Script')
    logger.info('', undefined, 'Script')
    logger.info('View contracts on BaseScan:', undefined, 'Script')
    logger.info(`  Diamond: https://basescan.org/address/${addresses.diamond}`, undefined, 'Script')
    logger.info(`  Identity Registry: https://basescan.org/address/${addresses.identityRegistry}`, undefined, 'Script')
    logger.info('', undefined, 'Script')
    logger.info('Next steps:', undefined, 'Script')
    logger.info('  1. Verify contracts (if not auto-verified): bun run scripts/verify-contracts.sh', undefined, 'Script')
    logger.info('  2. Register with Agent0: bun run agent0:register', undefined, 'Script')
    logger.info('  3. Set up monitoring and alerts', undefined, 'Script')
    logger.info('  4. Update frontend deployment', undefined, 'Script')
    logger.info('  5. Announce deployment', undefined, 'Script')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('❌ Deployment failed:', errorMessage, 'Script')
    process.exit(1)
  }
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
    reputationSystem: /ReputationSystem:\s*(0x[a-fA-F0-9]{40})/
  }

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = output.match(pattern)
    if (match) {
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

