#!/usr/bin/env bun
/**
 * Smart Contract Deployment Script
 * Deploys ERC-8004 registries and prediction market contracts to Ethereum
 * Unified with Agent0 registry on the same chain
 */

import { execSync } from 'child_process'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { logger } from '../src/lib/logger'

interface DeploymentConfig {
  network: 'sepolia' | 'mainnet'
  rpcUrl: string
  privateKey?: string
  etherscanApiKey?: string
}

interface DeploymentResult {
  network: string
  chainId: number
  contracts: {
    identityRegistry: string
    reputationSystem: string
    diamond: string
    predictionMarketFacet: string
    oracleFacet: string
    diamondCutFacet: string
    diamondLoupeFacet: string
  }
  deployer: string
  timestamp: string
  blockNumber: number
}

class ContractDeployer {
  private config: DeploymentConfig

  constructor(config: DeploymentConfig) {
    this.config = config
  }

  /**
   * Deploy all contracts to Ethereum (Sepolia or Mainnet)
   */
  async deploy(): Promise<DeploymentResult> {
    logger.info(`Starting contract deployment to Ethereum ${this.config.network}`, undefined, 'Script');
    logger.info('='.repeat(60), undefined, 'Script');

    // 1. Compile contracts
    logger.info('Compiling contracts...', undefined, 'Script');
    this.compile()

    // 2. Deploy Identity Registry
    logger.info('Deploying ERC-8004 Identity Registry...', undefined, 'Script');
    const identityRegistry = await this.deployContract('ERC8004IdentityRegistry')
    logger.info(`Identity Registry: ${identityRegistry}`, undefined, 'Script');

    // 3. Deploy Reputation System
    logger.info('Deploying ERC-8004 Reputation System...', undefined, 'Script');
    const reputationSystem = await this.deployContract(
      'ERC8004ReputationSystem',
      [identityRegistry]
    )
    logger.info(`Reputation System: ${reputationSystem}`, undefined, 'Script');

    // 4. Deploy Diamond Facets
    logger.info('Deploying Diamond Facets...', undefined, 'Script');
    const diamondCutFacet = await this.deployContract('DiamondCutFacet')
    const diamondLoupeFacet = await this.deployContract('DiamondLoupeFacet')
    const predictionMarketFacet = await this.deployContract('PredictionMarketFacet')
    const oracleFacet = await this.deployContract('OracleFacet')

    logger.info(`DiamondCutFacet: ${diamondCutFacet}`, undefined, 'Script');
    logger.info(`DiamondLoupeFacet: ${diamondLoupeFacet}`, undefined, 'Script');
    logger.info(`PredictionMarketFacet: ${predictionMarketFacet}`, undefined, 'Script');
    logger.info(`OracleFacet: ${oracleFacet}`, undefined, 'Script');

    // 5. Deploy Diamond with initial facets
    logger.info('Deploying Diamond Proxy...', undefined, 'Script');
    const diamond = await this.deployDiamond(
      diamondCutFacet,
      diamondLoupeFacet,
      predictionMarketFacet,
      oracleFacet
    )
    logger.info(`Diamond Proxy: ${diamond}`, undefined, 'Script');

    // 6. Verify contracts (if on testnet/mainnet)
    if (this.config.etherscanApiKey) {
      logger.info('Verifying contracts on block explorer...', undefined, 'Script');
      await this.verifyContracts({
        identityRegistry,
        reputationSystem,
        diamond,
        predictionMarketFacet,
        oracleFacet,
        diamondCutFacet,
        diamondLoupeFacet
      })
    }

    // 7. Save deployment info
    const result: DeploymentResult = {
      network: this.config.network,
      chainId: this.config.network === 'sepolia' ? 11155111 : 1,
      contracts: {
        identityRegistry,
        reputationSystem,
        diamond,
        predictionMarketFacet,
        oracleFacet,
        diamondCutFacet,
        diamondLoupeFacet
      },
      deployer: await this.getDeployerAddress(),
      timestamp: new Date().toISOString(),
      blockNumber: await this.getCurrentBlockNumber()
    }

    this.saveDeployment(result)

    logger.info('Deployment complete!', undefined, 'Script');
    logger.info('='.repeat(60), undefined, 'Script');
    logger.info(`Deployment saved to: deployments/${this.config.network}.json`, undefined, 'Script');

    return result
  }

  /**
   * Compile contracts with forge
   */
  private compile(): void {
    try {
      execSync('forge build', { stdio: 'inherit' })
    } catch (error) {
      logger.error('Compilation failed:', error, 'Script');
      process.exit(1)
    }
  }

  /**
   * Deploy a single contract
   */
  private async deployContract(
    contractName: string,
    constructorArgs: string[] = []
  ): Promise<string> {
    try {
      const args = constructorArgs.join(' ')

      // Map contract names to their file paths
      const contractPaths: Record<string, string> = {
        'ERC8004IdentityRegistry': 'contracts/identity/ERC8004IdentityRegistry.sol',
        'ERC8004ReputationSystem': 'contracts/identity/ERC8004ReputationSystem.sol',
        'DiamondCutFacet': 'contracts/core/DiamondCutFacet.sol',
        'DiamondLoupeFacet': 'contracts/core/DiamondLoupeFacet.sol',
        'PredictionMarketFacet': 'contracts/core/PredictionMarketFacet.sol',
        'OracleFacet': 'contracts/core/OracleFacet.sol',
        'Diamond': 'contracts/core/Diamond.sol'
      }

      const contractPath = contractPaths[contractName] || `contracts/**/${contractName}.sol`

      // Build command without --json flag and with proper key handling
      const constructorArgsStr = args ? `--constructor-args ${args}` : ''

      logger.info(`Executing: forge create ${contractPath}:${contractName}`, undefined, 'Script');
      const output = execSync(
        `forge create --rpc-url ${this.config.rpcUrl} --private-key ${this.config.privateKey} --broadcast ${contractPath}:${contractName} ${constructorArgsStr}`,
        {
          encoding: 'utf-8',
          env: { ...process.env, DEPLOYER_PRIVATE_KEY: this.config.privateKey }
        }
      )

      // Parse output for deployment address
      // Look for "Deployed to: 0x..." pattern
      const deployedMatch = output.match(/Deployed to:\s+(0x[a-fA-F0-9]{40})/i)
      if (deployedMatch) {
        return deployedMatch[1]
      }

      // Also try "Contract Address:" pattern
      const addressMatch = output.match(/Contract Address:\s+(0x[a-fA-F0-9]{40})/i)
      if (addressMatch) {
        return addressMatch[1]
      }

      logger.error('Forge output:', output, 'Script');
      throw new Error('Could not find deployment address in output')
    } catch (error) {
      logger.error(`Failed to deploy ${contractName}:`, error, 'Script');
      throw error
    }
  }

  /**
   * Deploy Diamond proxy with initial facets
   */
  private async deployDiamond(
    cutFacet: string,
    loupeFacet: string,
    marketFacet: string,
    oracleFacet: string
  ): Promise<string> {
    // Diamond requires diamond cut initialization
    // This is a simplified version - you'll need to encode the facet cuts properly
    return await this.deployContract('Diamond', [cutFacet, loupeFacet])
  }

  /**
   * Verify contracts on block explorer
   */
  private async verifyContracts(contracts: Record<string, string>): Promise<void> {
    const contractPaths: Record<string, string> = {
      'identityRegistry': 'contracts/identity/ERC8004IdentityRegistry.sol:ERC8004IdentityRegistry',
      'reputationSystem': 'contracts/identity/ERC8004ReputationSystem.sol:ERC8004ReputationSystem',
      'diamondCutFacet': 'contracts/core/DiamondCutFacet.sol:DiamondCutFacet',
      'diamondLoupeFacet': 'contracts/core/DiamondLoupeFacet.sol:DiamondLoupeFacet',
      'predictionMarketFacet': 'contracts/core/PredictionMarketFacet.sol:PredictionMarketFacet',
      'oracleFacet': 'contracts/core/OracleFacet.sol:OracleFacet',
      'diamond': 'contracts/core/Diamond.sol:Diamond'
    }

    for (const [name, address] of Object.entries(contracts)) {
      try {
        const contractPath = contractPaths[name] || `contracts/**/*.sol:${name}`
        logger.info(`Verifying ${name}...`, undefined, 'Script');
        execSync(
          `forge verify-contract ${address} \
          ${contractPath} \
          --chain-id ${this.config.network === 'sepolia' ? '11155111' : '1'} \
          --etherscan-api-key ${this.config.etherscanApiKey} \
          --watch`,
          { stdio: 'inherit' }
        )
        logger.info(`${name} verified`, undefined, 'Script');
      } catch (error) {
        logger.warn(`${name} verification failed (may already be verified)`, undefined, 'Script');
      }
    }
  }

  /**
   * Get deployer address
   */
  private async getDeployerAddress(): Promise<string> {
    try {
      const cmd = `cast wallet address --private-key ${this.config.privateKey || '$DEPLOYER_PRIVATE_KEY'}`
      return execSync(cmd, { encoding: 'utf-8' }).trim()
    } catch {
      return 'unknown'
    }
  }

  /**
   * Get current block number
   */
  private async getCurrentBlockNumber(): Promise<number> {
    try {
      const cmd = `cast block-number --rpc-url ${this.config.rpcUrl}`
      return parseInt(execSync(cmd, { encoding: 'utf-8' }).trim())
    } catch {
      return 0
    }
  }

  /**
   * Save deployment info to file
   */
  private saveDeployment(result: DeploymentResult): void {
    const deploymentsDir = join(process.cwd(), 'deployments')
    const filepath = join(deploymentsDir, `${this.config.network}.json`)

    try {
      // Create directory if it doesn't exist
      execSync(`mkdir -p ${deploymentsDir}`)
      writeFileSync(filepath, JSON.stringify(result, null, 2))
    } catch (error) {
      logger.error('Failed to save deployment:', error, 'Script');
    }
  }
}

/**
 * Main deployment function
 */
async function main() {
  const network = (process.env.NETWORK || 'sepolia') as 'sepolia' | 'mainnet'

  const config: DeploymentConfig = {
    network,
    rpcUrl: network === 'sepolia'
      ? (process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com')
      : (process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com'),
    privateKey: process.env.DEPLOYER_PRIVATE_KEY,
    etherscanApiKey: process.env.ETHERSCAN_API_KEY
  }

  if (!config.privateKey) {
    logger.error('Error: DEPLOYER_PRIVATE_KEY environment variable required', undefined, 'Script');
    logger.info('Usage:', {
      example1: 'DEPLOYER_PRIVATE_KEY=0x... bun run scripts/deploy-contracts.ts',
      example2: 'NETWORK=sepolia DEPLOYER_PRIVATE_KEY=0x... bun run scripts/deploy-contracts.ts'
    }, 'Script');
    process.exit(1)
  }

  const deployer = new ContractDeployer(config)
  await deployer.deploy()
}

// Run deployment
main().catch((error) => {
  logger.error('Deployment failed:', error, 'Script');
  process.exit(1)
})
