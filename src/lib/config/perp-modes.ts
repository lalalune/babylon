/**
 * Perpetuals Settlement Mode Configuration
 *
 * Supports three modes:
 * - offchain: Fast MVP trading with database persistence 
 * - onchain: Decentralized trading with blockchain settlement (P 
 * - hybrid: Off-chain execution with periodic on-chain settlement (best of both)
 */

export type PerpSettlementMode = 'offchain' | 'onchain' | 'hybrid';

export interface PerpModeConfig {
  // Settlement mode
  settlementMode: PerpSettlementMode;

  // On-chain contract addresses (required for onchain/hybrid modes)
  diamondAddress?: string;

  // Hybrid mode settings
  hybridBatchInterval: number; // milliseconds
  hybridBatchSize: number; // max positions per batch

  // Feature flags
  enableOnChainMode: boolean;
  enableReferrals: boolean;
  enableLiquidityPools: boolean;

  // Settlement options
  asyncSettlement: boolean; // true = don't await blockchain confirmation
  settlementRetries: number; // retry attempts for failed settlements
}

/**
 * Load configuration from environment variables
 */
export const PERP_CONFIG: PerpModeConfig = {
  // Default to off-chain MVP for fastest performance
  settlementMode: (process.env.NEXT_PUBLIC_PERP_SETTLEMENT_MODE || 'offchain') as PerpSettlementMode,

  // On-chain contract addresses (optional)
  diamondAddress: process.env.NEXT_PUBLIC_DIAMOND_ADDRESS,

  // Hybrid mode settings (1 hour batches, 100 positions max)
  hybridBatchInterval: parseInt(process.env.NEXT_PUBLIC_HYBRID_BATCH_INTERVAL || '3600000'),
  hybridBatchSize: parseInt(process.env.NEXT_PUBLIC_HYBRID_BATCH_SIZE || '100'),

  // Feature flags (all disabled by default for MVP)
  enableOnChainMode: process.env.NEXT_PUBLIC_ENABLE_ONCHAIN_PERPS === 'true',
  enableReferrals: process.env.NEXT_PUBLIC_ENABLE_REFERRALS === 'true',
  enableLiquidityPools: process.env.NEXT_PUBLIC_ENABLE_LIQUIDITY_POOLS === 'true',

  // Settlement options (async by default to keep fast UX)
  asyncSettlement: process.env.NEXT_PUBLIC_ASYNC_SETTLEMENT !== 'false',
  settlementRetries: parseInt(process.env.NEXT_PUBLIC_SETTLEMENT_RETRIES || '3'),
};

/**
 * Validate configuration
 */
export function validatePerpConfig(): void {
  // Check on-chain modes have diamond address
  if ((PERP_CONFIG.settlementMode === 'onchain' || PERP_CONFIG.settlementMode === 'hybrid') && !PERP_CONFIG.diamondAddress) {
    throw new Error('NEXT_PUBLIC_DIAMOND_ADDRESS required for onchain/hybrid settlement modes');
  }

  // Validate batch settings for hybrid mode
  if (PERP_CONFIG.settlementMode === 'hybrid') {
    if (PERP_CONFIG.hybridBatchInterval < 60000) {
      throw new Error('Hybrid batch interval must be at least 60 seconds');
    }
    if (PERP_CONFIG.hybridBatchSize < 1 || PERP_CONFIG.hybridBatchSize > 1000) {
      throw new Error('Hybrid batch size must be between 1 and 1000');
    }
  }
}

/**
 * Check if on-chain settlement is enabled
 */
export function isOnChainEnabled(): boolean {
  return PERP_CONFIG.settlementMode === 'onchain' || PERP_CONFIG.settlementMode === 'hybrid';
}

/**
 * Check if using off-chain mode (PR #128 only)
 */
export function isOffChainOnly(): boolean {
  return PERP_CONFIG.settlementMode === 'offchain';
}

/**
 * Check if using hybrid mode
 */
export function isHybridMode(): boolean {
  return PERP_CONFIG.settlementMode === 'hybrid';
}

/**
 * Get settlement mode display name
 */
export function getSettlementModeDisplay(): string {
  switch (PERP_CONFIG.settlementMode) {
    case 'offchain':
      return 'Fast Trading (Off-Chain)';
    case 'onchain':
      return 'DeFi Mode (On-Chain)';
    case 'hybrid':
      return 'Hybrid (Off-Chain + Periodic Settlement)';
    default:
      return 'Unknown';
  }
}
