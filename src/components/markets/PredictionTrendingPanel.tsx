'use client'

import { useEffect, useMemo, useState } from 'react'
import { Flame } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Skeleton'
import { usePredictionMarketsSubscription } from '@/hooks/usePredictionMarketStream'
import { logger } from '@/lib/logger'

interface PredictionSummary {
  id: string
  text: string
  yesShares: number
  noShares: number
  resolutionDate?: string
}

interface PredictionQuestion {
  id: string | number
  text: string
  yesShares?: number | null
  noShares?: number | null
  resolutionDate?: string | null
}

interface PredictionTrendingPanelProps {
  onMarketClick?: (marketId: string) => void
}

export function PredictionTrendingPanel({ onMarketClick }: PredictionTrendingPanelProps) {
  const [markets, setMarkets] = useState<PredictionSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/markets/predictions')
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`)
        }
        const data = await response.json()
        if (Array.isArray(data.questions)) {
          setMarkets(
            (data.questions as PredictionQuestion[]).map((question) => ({
              id: question.id.toString(),
              text: question.text,
              yesShares: Number(question.yesShares ?? 0),
              noShares: Number(question.noShares ?? 0),
              resolutionDate: question.resolutionDate ?? undefined,
            }))
          )
        }
      } catch (error) {
        logger.error('Failed to fetch hot predictions', { error }, 'PredictionTrendingPanel')
        // Keep existing data on error
      } finally {
        setLoading(false)
      }
    }

    fetchPredictions()
    const interval = setInterval(fetchPredictions, 60000)
    return () => clearInterval(interval)
  }, [])

  usePredictionMarketsSubscription({
    onTrade: (event) => {
      setMarkets((prev) =>
        prev.map((market) =>
          market.id === event.marketId
            ? {
                ...market,
                yesShares: event.yesShares,
                noShares: event.noShares,
              }
            : market
        )
      )
    },
    onResolution: (event) => {
      setMarkets((prev) =>
        prev.map((market) =>
          market.id === event.marketId
            ? {
                ...market,
                yesShares: event.yesShares,
                noShares: event.noShares,
              }
            : market
        )
      )
    },
  })

  const sortedMarkets = useMemo(() => {
    return [...markets]
      .filter((m) => m.yesShares + m.noShares > 0)
      .sort(
        (a, b) =>
          b.yesShares + b.noShares - (a.yesShares + a.noShares)
      )
      .slice(0, 4)
  }, [markets])

  const renderProbability = (market: PredictionSummary) => {
    const total = market.yesShares + market.noShares
    const yesPercent = total > 0 ? (market.yesShares / total) * 100 : 50
    return yesPercent.toFixed(1)
  }

  return (
    <div className="bg-sidebar rounded-2xl px-4 py-3 flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-semibold text-foreground">Hot Predictions</h2>
      </div>
      {loading ? (
        <div className="space-y-3 flex-1">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : sortedMarkets.length === 0 ? (
        <div className="text-xs text-muted-foreground">No active prediction markets</div>
      ) : (
        <div className="flex flex-col gap-2 flex-1">
          {sortedMarkets.map((market) => (
            <button
              key={market.id}
              onClick={() => onMarketClick?.(market.id)}
              className={cn(
                'w-full p-2 rounded-lg text-left hover:bg-muted/50 transition-colors cursor-pointer'
              )}
            >
              <div className="text-sm font-medium text-foreground line-clamp-2">
                {market.text}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                <span>
                  Volume: {(market.yesShares + market.noShares).toFixed(0)} shares
                </span>
                <span className="text-green-600 font-semibold">
                  {renderProbability(market)}% YES
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
