'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Skeleton'

interface TopMover {
  ticker: string
  name: string
  currentPrice: number
  change24h: number
  changePercent24h: number
  organizationId?: string
  high24h?: number
  low24h?: number
  volume24h?: number
  openInterest?: number
  fundingRate?: {
    rate: number
    nextFundingTime: string
    predictedRate: number
  }
  maxLeverage?: number
  minOrderSize?: number
}

interface TopMoversPanelProps {
  onMarketClick?: (market: TopMover) => void
}

export function TopMoversPanel({ onMarketClick }: TopMoversPanelProps) {
  const [topGainers, setTopGainers] = useState<TopMover[]>([])
  const [topLosers, setTopLosers] = useState<TopMover[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMovers = async () => {
      setLoading(true)
      const response = await fetch('/api/markets/perps')
      const data = await response.json()
      if (data.markets && Array.isArray(data.markets)) {
        const markets = data.markets.map((m: {
          ticker: string
          name: string
          currentPrice?: number
          change24h?: number
          changePercent24h?: number
          organizationId?: string
          high24h?: number
          low24h?: number
          volume24h?: number
          openInterest?: number
          fundingRate?: {
            rate: number
            nextFundingTime: string
            predictedRate: number
          }
          maxLeverage?: number
          minOrderSize?: number
        }) => ({
          ticker: m.ticker,
          name: m.name,
          currentPrice: m.currentPrice || 0,
          change24h: m.change24h || 0,
          changePercent24h: m.changePercent24h || 0,
          organizationId: m.organizationId,
          high24h: m.high24h,
          low24h: m.low24h,
          volume24h: m.volume24h,
          openInterest: m.openInterest,
          fundingRate: m.fundingRate,
          maxLeverage: m.maxLeverage,
          minOrderSize: m.minOrderSize,
        }))

        // Sort by change percentage
        const sorted = [...markets].sort((a, b) => b.changePercent24h - a.changePercent24h)
        setTopGainers(sorted.slice(0, 4))
        setTopLosers(sorted.slice(-4).reverse())
      }
      setLoading(false)
    }

    fetchMovers()
    const interval = setInterval(fetchMovers, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const formatPrice = (p: number) => `$${p.toFixed(2)}`

  return (
    <div className="bg-sidebar rounded-2xl px-4 py-3 flex-1 flex flex-col">
      <h2 className="text-xl font-bold text-foreground mb-3">Top Movers</h2>
      {loading ? (
        <div className="space-y-3 flex-1">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <div className="space-y-4 flex-1">
          {/* Top Gainers */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <h3 className="text-sm font-semibold text-foreground">Top Gainers</h3>
            </div>
            <div className="space-y-1.5">
              {topGainers.length > 0 ? (
                topGainers.map((mover) => (
                  <button
                    key={mover.ticker}
                    onClick={() => onMarketClick?.(mover)}
                    className={cn(
                      "w-full flex justify-between items-center text-sm hover:bg-muted/50 rounded-lg p-1.5 -ml-1.5 transition-colors cursor-pointer text-left"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">${mover.ticker}</div>
                      <div className="text-xs text-muted-foreground truncate">{mover.name}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <div className="text-right">
                        <div className="font-semibold text-foreground">{formatPrice(mover.currentPrice)}</div>
                        <div className="text-xs text-green-600 font-medium">
                          +{mover.changePercent24h.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No gainers</div>
              )}
            </div>
          </div>

          {/* Top Losers */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <h3 className="text-sm font-semibold text-foreground">Top Losers</h3>
            </div>
            <div className="space-y-1.5">
              {topLosers.length > 0 ? (
                topLosers.map((mover) => (
                  <button
                    key={mover.ticker}
                    onClick={() => onMarketClick?.(mover)}
                    className={cn(
                      "w-full flex justify-between items-center text-sm hover:bg-muted/50 rounded-lg p-1.5 -ml-1.5 transition-colors cursor-pointer text-left"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">${mover.ticker}</div>
                      <div className="text-xs text-muted-foreground truncate">{mover.name}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <div className="text-right">
                        <div className="font-semibold text-foreground">{formatPrice(mover.currentPrice)}</div>
                        <div className="text-xs text-red-600 font-medium">
                          {mover.changePercent24h.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No losers</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

