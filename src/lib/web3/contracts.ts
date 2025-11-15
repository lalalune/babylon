/**
 * Smart Contract Configuration
 * ERC-8004 Identity, Reputation, and Prediction Market contracts
 * Supports Base Sepolia (primary) and Ethereum Sepolia (legacy)
 */

import type { Address } from 'viem'

// Subset of contract addresses for web3 operations
// For full deployment contract addresses, see @/lib/deployment/validation
export interface Web3ContractAddresses {
  identityRegistry: Address
  reputationSystem: Address
  diamond: Address
  predictionMarketFacet: Address
  oracleFacet: Address
}

// Base Sepolia (Primary Testnet) - Chain ID: 84532
export const BASE_SEPOLIA_CONTRACTS: Web3ContractAddresses = {
  identityRegistry: (process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address,
  reputationSystem: (process.env.NEXT_PUBLIC_REPUTATION_SYSTEM_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address,
  diamond: (process.env.NEXT_PUBLIC_DIAMOND_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address,
  predictionMarketFacet: (process.env.NEXT_PUBLIC_DIAMOND_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address, // Diamond handles all facets
  oracleFacet: (process.env.NEXT_PUBLIC_DIAMOND_BASE_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address, // Diamond handles all facets
}

// Ethereum Sepolia (Legacy Testnet) - Chain ID: 11155111
export const SEPOLIA_CONTRACTS: Web3ContractAddresses = {
  identityRegistry: (process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address,
  reputationSystem: (process.env.NEXT_PUBLIC_REPUTATION_SYSTEM_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address,
  diamond: (process.env.NEXT_PUBLIC_DIAMOND_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address,
  predictionMarketFacet: (process.env.NEXT_PUBLIC_DIAMOND_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address, // Diamond handles all facets
  oracleFacet: (process.env.NEXT_PUBLIC_DIAMOND_SEPOLIA || '0x0000000000000000000000000000000000000000') as Address, // Diamond handles all facets
}

// Ethereum Mainnet - Chain ID: 1
export const MAINNET_CONTRACTS: Web3ContractAddresses = {
  identityRegistry: (process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_MAINNET || '0x0000000000000000000000000000000000000000') as Address,
  reputationSystem: (process.env.NEXT_PUBLIC_REPUTATION_SYSTEM_MAINNET || '0x0000000000000000000000000000000000000000') as Address,
  diamond: (process.env.NEXT_PUBLIC_DIAMOND_MAINNET || '0x0000000000000000000000000000000000000000') as Address,
  predictionMarketFacet: (process.env.NEXT_PUBLIC_DIAMOND_MAINNET || '0x0000000000000000000000000000000000000000') as Address, // Diamond handles all facets
  oracleFacet: (process.env.NEXT_PUBLIC_DIAMOND_MAINNET || '0x0000000000000000000000000000000000000000') as Address, // Diamond handles all facets
}

/**
 * Get contract addresses for the current chain
 */
export function getContractAddresses(chainId: number): Web3ContractAddresses {
  switch (chainId) {
    case 84532: // Base Sepolia (primary)
      return BASE_SEPOLIA_CONTRACTS
    case 11155111: // Ethereum Sepolia (legacy)
      return SEPOLIA_CONTRACTS
    case 1: // Ethereum Mainnet
      return MAINNET_CONTRACTS
    default:
      return BASE_SEPOLIA_CONTRACTS // Default to Base Sepolia testnet
  }
}

/**
 * Check if contracts are deployed on the given chain
 */
export function areContractsDeployed(chainId: number): boolean {
  const contracts = getContractAddresses(chainId)
  return contracts.identityRegistry !== '0x0000000000000000000000000000000000000000'
}
