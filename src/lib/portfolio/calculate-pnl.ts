/**
 * Server-side portfolio P&L calculation
 */

import { prisma } from '@/lib/database-service'

export interface PortfolioPnLSnapshot {
  lifetimePnL: number
  netContributions: number
  totalDeposited: number
  totalWithdrawn: number
  availableBalance: number
  unrealizedPerpPnL: number
  unrealizedPredictionPnL: number
  totalUnrealizedPnL: number
  totalPnL: number
  accountEquity: number
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export async function calculatePortfolioPnL(
  userId: string
): Promise<PortfolioPnLSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      virtualBalance: true,
      totalDeposited: true,
      totalWithdrawn: true,
      lifetimePnL: true,
    },
  })

  if (!user) return null

  const perpPositions = await prisma.perpPosition.findMany({
    where: {
      userId,
      closedAt: null,
    },
    select: {
      unrealizedPnL: true,
    },
  })

  const predictionPositions = await prisma.position.findMany({
    where: {
      userId,
      Market: {
        resolved: false,
      },
    },
    select: {
      shares: true,
      avgPrice: true,
      side: true,
      Market: {
        select: {
          yesShares: true,
          noShares: true,
        },
      },
    },
  })

  const totalDeposited = toNumber(user.totalDeposited)
  const totalWithdrawn = toNumber(user.totalWithdrawn)
  const lifetimePnL = toNumber(user.lifetimePnL)
  const availableBalance = toNumber(user.virtualBalance)

  const perpUnrealized = perpPositions.reduce(
    (sum, position) => sum + toNumber(position.unrealizedPnL),
    0
  )

  const predictionUnrealized = predictionPositions.reduce((sum, position) => {
    const shares = toNumber(position.shares)
    const avgPrice = toNumber(position.avgPrice)
    
    // Calculate current price from shares (CPMM pricing)
    const yesShares = toNumber(position.Market.yesShares)
    const noShares = toNumber(position.Market.noShares)
    const totalShares = yesShares + noShares
    
    const currentPrice = totalShares > 0
      ? (position.side === true
        ? noShares / totalShares  // Yes price = noShares / total
        : yesShares / totalShares  // No price = yesShares / total
      )
      : avgPrice

    return sum + shares * (currentPrice - avgPrice)
  }, 0)

  const totalUnrealizedPnL = perpUnrealized + predictionUnrealized
  const totalPnL = lifetimePnL + totalUnrealizedPnL
  const netContributions = totalDeposited - totalWithdrawn
  const accountEquity = netContributions + totalPnL

  return {
    lifetimePnL,
    netContributions,
    totalDeposited,
    totalWithdrawn,
    availableBalance,
    unrealizedPerpPnL: perpUnrealized,
    unrealizedPredictionPnL: predictionUnrealized,
    totalUnrealizedPnL,
    totalPnL,
    accountEquity,
  }
}

