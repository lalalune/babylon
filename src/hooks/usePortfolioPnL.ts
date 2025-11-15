'use client'

import { useAuth } from '@/hooks/useAuth'
import { logger } from '@/lib/logger'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PortfolioPnLSnapshot } from '@/lib/portfolio/calculate-pnl'

// Re-export for components that import from this hook
export type { PortfolioPnLSnapshot } from '@/lib/portfolio/calculate-pnl'

interface UsePortfolioPnLResult {
  loading: boolean
  error: string | null
  data: PortfolioPnLSnapshot | null
  refresh: () => Promise<void>
  lastUpdated: number | null
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  return fallback
}

export function usePortfolioPnL(): UsePortfolioPnLResult {
  const { user, authenticated } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PortfolioPnLSnapshot | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    if (!authenticated || !user?.id) {
      setData(null)
      setLoading(false)
      setError(null)
      setLastUpdated(null)
      return
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setError(null)

    const [balanceRes, positionsRes] = await Promise.all([
      fetch(`/api/users/${encodeURIComponent(user.id)}/balance`, {
        signal: abortController.signal,
      }),
      fetch(`/api/markets/positions/${encodeURIComponent(user.id)}`, {
        signal: abortController.signal,
      }),
    ])

    let balanceJson;
    let positionsJson;
    try {
      balanceJson = await balanceRes.json();
      positionsJson = await positionsRes.json();
    } catch (error) {
      logger.error('Failed to parse portfolio PnL response', { error, userId: user.id }, 'usePortfolioPnL');
      setError('Failed to parse response');
      setLoading(false);
      return;
    }

      const totalDeposited = toNumber(balanceJson.totalDeposited)
      const totalWithdrawn = toNumber(balanceJson.totalWithdrawn)
      const lifetimePnL = toNumber(balanceJson.lifetimePnL)
      const availableBalance = toNumber(balanceJson.balance)

      const perpUnrealized = (positionsJson?.perpetuals?.positions ?? []).reduce(
        (sum: number, position: { unrealizedPnL?: number }) =>
          sum + toNumber(position?.unrealizedPnL),
        0,
      )

      const predictionUnrealized = (positionsJson?.predictions?.positions ?? []).reduce(
        (sum: number, position: { unrealizedPnL?: number }) =>
          sum + toNumber(position?.unrealizedPnL),
        0,
      )

      const totalUnrealizedPnL = perpUnrealized + predictionUnrealized
      const totalPnL = lifetimePnL + totalUnrealizedPnL
      const netContributions = totalDeposited - totalWithdrawn
      const accountEquity = netContributions + totalPnL

    setData({
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
    })
    setLastUpdated(Date.now())
    setLoading(false)
  }, [authenticated, user?.id])

  useEffect(() => {
    refresh()

    return () => {
      abortControllerRef.current?.abort()
    }
  }, [refresh])

  const memoizedData = useMemo(() => data, [data])

  return {
    loading,
    error,
    data: memoizedData,
    refresh,
    lastUpdated,
  }
}

