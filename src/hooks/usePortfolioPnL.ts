'use client'

import { useAuth } from '@/hooks/useAuth'
import { logger } from '@/lib/logger'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface PortfolioPnLSnapshot {
  lifetimePnL: number
  netContributions: number
  totalDeposited: number
  totalWithdrawn: number
  availableBalance: number
  unrealizedPerpPnL: number
  unrealizedPredictionPnL: number
  unrealizedPoolPnL: number
  totalUnrealizedPnL: number
  totalPnL: number
  accountEquity: number
}

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

    try {
      const [balanceRes, positionsRes, poolsRes] = await Promise.all([
        fetch(`/api/users/${encodeURIComponent(user.id)}/balance`, {
          signal: abortController.signal,
        }),
        fetch(`/api/markets/positions/${encodeURIComponent(user.id)}`, {
          signal: abortController.signal,
        }),
        fetch(`/api/pools/deposits/${encodeURIComponent(user.id)}`, {
          signal: abortController.signal,
        }),
      ])

      if (!balanceRes.ok) {
        throw new Error(`Balance request failed with status ${balanceRes.status}`)
      }

      if (!positionsRes.ok) {
        throw new Error(`Positions request failed with status ${positionsRes.status}`)
      }

      if (!poolsRes.ok) {
        throw new Error(`Pools request failed with status ${poolsRes.status}`)
      }

      const balanceJson = await balanceRes.json()
      const positionsJson = await positionsRes.json()
      const poolsJson = await poolsRes.json()

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

      const poolUnrealized = toNumber(poolsJson?.summary?.totalUnrealizedPnL)

      const totalUnrealizedPnL = perpUnrealized + predictionUnrealized + poolUnrealized
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
        unrealizedPoolPnL: poolUnrealized,
        totalUnrealizedPnL,
        totalPnL,
        accountEquity,
      })
      setLastUpdated(Date.now())
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        return
      }

      const message = err instanceof Error ? err.message : 'Failed to load portfolio P&L'
      setError(message)
      logger.error('Failed to load portfolio P&L', { error: message }, 'usePortfolioPnL')
    } finally {
      setLoading(false)
    }
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

