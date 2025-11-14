/**
 * Trading Fee Configuration
 * 
 * Centralized fee configuration for all trading activities
 */

export const FEE_CONFIG = {
  // Trading fees
  TRADING_FEE_RATE: 0.02, // 2% on all trades
  
  // Fee distribution
  PLATFORM_SHARE: 0.50, // 50% to platform
  REFERRER_SHARE: 0.50, // 50% to referrer (if they have one)
  
  // Minimum fees
  MIN_FEE_AMOUNT: 0.01, // Don't process fees < $0.01
  
  // Fee types
  FEE_TYPES: {
    PRED_BUY: 'pred_buy',
    PRED_SELL: 'pred_sell',
    PERP_OPEN: 'perp_open',
    PERP_CLOSE: 'perp_close',
  } as const,
  
  // Balance transaction types for fees
  TRANSACTION_TYPES: {
    TRADING_FEE: 'trading_fee',
    REFERRAL_FEE_EARNED: 'referral_fee_earned',
  } as const,
} as const

export type FeeType = typeof FEE_CONFIG.FEE_TYPES[keyof typeof FEE_CONFIG.FEE_TYPES]
export type FeeTransactionType = typeof FEE_CONFIG.TRANSACTION_TYPES[keyof typeof FEE_CONFIG.TRANSACTION_TYPES]



