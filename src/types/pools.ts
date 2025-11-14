/**
 * Pool-related TypeScript types
 * Based on Prisma schema and API responses
 */

export interface NPCActor {
  id: string
  name: string
  description?: string
  tier?: string
  personality?: string
  domain?: string[]
  postStyle?: string
}

export interface PoolPosition {
  id: string
  poolId: string
  marketType: 'perp' | 'prediction'
  ticker?: string | null
  marketId?: string | null
  side: 'long' | 'short' | 'YES' | 'NO'
  entryPrice: number
  currentPrice: number
  size: number
  shares?: number | null
  leverage?: number | null
  liquidationPrice?: number | null
  unrealizedPnL: number
  openedAt: string
  closedAt?: string | null
  realizedPnL?: number | null
  updatedAt: string
}

export interface PoolTrade {
  id: string
  npcActorId: string
  poolId?: string | null
  marketType: 'perp' | 'prediction'
  ticker?: string | null
  marketId?: string | null
  action: 'buy' | 'sell' | 'open_long' | 'open_short' | 'close'
  side?: 'long' | 'short' | 'YES' | 'NO' | null
  amount: number
  price: number
  sentiment?: number | null
  reason?: string | null
  postId?: string | null
  executedAt: string
}

export interface PoolDeposit {
  id: string
  poolId: string
  userId: string
  amount: number
  shares: number
  currentValue: number
  unrealizedPnL: number
  depositedAt: string
  withdrawnAt?: string | null
  withdrawnAmount?: number | null
}

export interface UserPoolDeposit {
  id: string
  poolId: string
  poolName: string
  npcActor: NPCActor
  amount: number
  shares: number
  currentValue: number
  unrealizedPnL: number
  returnPercent: number
  depositedAt: string
  withdrawnAt: string | null
  withdrawnAmount: number | null
  isActive: boolean
}

export interface UserPoolSummary {
  totalInvested: number
  totalCurrentValue: number
  totalUnrealizedPnL: number
  totalReturnPercent: number
  activePools: number
  historicalCount: number
}

export interface PoolDetails {
  id: string
  name: string
  description?: string | null
  npcActor: NPCActor
  totalValue: number
  totalDeposits: number
  availableBalance: number
  lifetimePnL: number
  totalReturn: number
  performanceFeeRate: number
  totalFeesCollected: number
  isActive: boolean
  activeInvestors: number
  openPositions: number
  totalTrades: number
  openedAt: string
  closedAt?: string | null
  updatedAt: string
}

export interface PoolDetailResponse {
  pool: PoolDetails
  positions: PoolPosition[]
  recentTrades: PoolTrade[]
}

export interface Post {
  id: string
  content: string
  authorId: string
  authorName: string
  authorUsername?: string | null
  authorProfileImageUrl?: string | null
  timestamp: string
  likeCount: number
  commentCount: number
  shareCount: number
  isLiked: boolean
  isShared: boolean
}

