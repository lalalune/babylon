/**
 * Contract Address Loader
 * 
 * Loads deployed contract addresses based on current network
 * Supports: localnet (Anvil), Base Sepolia, Base mainnet
 */

import type { Address } from 'viem'
import localDeployment from '../../../deployments/local/latest.json'
import baseSepoliaDeployment from '../../../deployments/base-sepolia/latest.json'

export interface DeployedContracts {
  diamond: Address
  babylonOracle: Address
  predimarket: Address
  predictionMarketFacet: Address
  identityRegistry: Address
  reputationSystem: Address
  chainId: number
  network: string
}

/**
 * Get deployed contract addresses for current network
 */
export function getContractAddresses(): DeployedContracts {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337)
  
  // Localnet (Anvil)
  if (chainId === 31337) {
    return {
      diamond: localDeployment.contracts.diamond as Address,
      babylonOracle: localDeployment.contracts.babylonOracle as Address,
      predimarket: localDeployment.contracts.predimarket as Address,
      predictionMarketFacet: localDeployment.contracts.predictionMarketFacet as Address,
      identityRegistry: localDeployment.contracts.identityRegistry as Address,
      reputationSystem: localDeployment.contracts.reputationSystem as Address,
      chainId: 31337,
      network: 'localnet'
    }
  }
  
  // Base Sepolia
  if (chainId === 84532) {
    return {
      diamond: baseSepoliaDeployment.contracts.diamond as Address,
      babylonOracle: (process.env.NEXT_PUBLIC_BABYLON_ORACLE || baseSepoliaDeployment.contracts.oracleFacet) as Address,
      predimarket: '0x0000000000000000000000000000000000000000' as Address, // Not deployed on Base Sepolia yet
      predictionMarketFacet: baseSepoliaDeployment.contracts.predictionMarketFacet as Address,
      identityRegistry: baseSepoliaDeployment.contracts.identityRegistry as Address,
      reputationSystem: baseSepoliaDeployment.contracts.reputationSystem as Address,
      chainId: 84532,
      network: 'base-sepolia'
    }
  }
  
  // Default to localnet
  return {
    diamond: localDeployment.contracts.diamond as Address,
    babylonOracle: localDeployment.contracts.babylonOracle as Address,
    predimarket: localDeployment.contracts.predimarket as Address,
    predictionMarketFacet: localDeployment.contracts.predictionMarketFacet as Address,
    identityRegistry: localDeployment.contracts.identityRegistry as Address,
    reputationSystem: localDeployment.contracts.reputationSystem as Address,
    chainId: 31337,
    network: 'localnet'
  }
}

/**
 * Check if we're on localnet (Anvil)
 */
export function isLocalnet(): boolean {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337)
  return chainId === 31337
}

/**
 * Get RPC URL for current network
 */
export function getRpcUrl(): string {
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337)
  
  if (chainId === 31337) {
    return process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'
  }
  
  if (chainId === 84532) {
    return process.env.NEXT_PUBLIC_RPC_URL || 'https://sepolia.base.org'
  }
  
  return process.env.NEXT_PUBLIC_RPC_URL || 'http://localhost:8545'
}

