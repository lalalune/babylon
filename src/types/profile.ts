/**
 * Profile-related TypeScript types
 * Types for user profile widgets and data displays
 */

/**
 * User balance data from /api/users/[userId]/balance
 */
export interface UserBalanceData {
  balance: number
  totalDeposited: number
  totalWithdrawn: number
  lifetimePnL: number
}

/**
 * Prediction market position from /api/markets/positions/[userId]
 */
export interface PredictionPosition {
  id: string
  marketId: string
  question: string
  side: 'YES' | 'NO'
  shares: number
  avgPrice: number
  currentPrice: number
  resolved: boolean
  resolution?: boolean | null
}

/**
 * User profile statistics
 */
export interface UserProfileStats {
  following: number
  followers: number
  totalActivity: number
  positions?: number
  comments?: number
  reactions?: number
}

/**
 * Perp position from API response (/api/markets/positions/[userId])
 * This matches the actual API response structure
 */
export interface PerpPositionFromAPI {
  id: string
  ticker: string
  side: 'LONG' | 'SHORT'
  entryPrice: number
  currentPrice: number
  size: number
  leverage: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  liquidationPrice: number
  fundingPaid: number
  openedAt: string
}


