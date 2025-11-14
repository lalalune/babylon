/**
 * Betting Types
 */

export interface Market {
  sessionId: string
  question: string
  questionId: string
  questionNumber: number
  yesShares: bigint
  noShares: bigint
  yesPrice: number
  noPrice: number
  totalVolume: bigint
  resolved: boolean
  outcome?: boolean
  finalized: boolean
  liquidityParameter?: bigint
  createdAt?: number
}

export interface Position {
  yesShares: bigint
  noShares: bigint
  totalSpent: bigint
  totalReceived: bigint
  hasClaimed: boolean
}

export interface TradeResult {
  txHash: string
  shares: bigint
  cost: bigint
}

