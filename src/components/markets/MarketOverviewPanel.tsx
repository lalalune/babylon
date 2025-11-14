'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, BarChart3, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/shared/Skeleton'

interface PerpMarket {
  ticker: string
  organizationId: string
  name: string
  currentPrice: number
  change24h: number
  changePercent24h: number
  high24h: number
  low24h: number
  volume24h: number
  openInterest: number
  fundingRate: {
    rate: number
    nextFundingTime: string
    predictedRate: number
  }
  maxLeverage: number
  minOrderSize: number
}

interface MarketOverview {
  totalMarkets: number
  totalVolume24h: number
  totalOpenInterest: number
  avgChange24h: number
  marketsUp: number
  marketsDown: number
}

export function MarketOverviewPanel() {
  const [overview, setOverview] = useState<MarketOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOverview = async () => {
      const response = await fetch('/api/markets/perps')
      const data = await response.json()
      if (data.markets && Array.isArray(data.markets)) {
        const markets = data.markets as PerpMarket[]
        const totalVolume = markets.reduce((sum: number, m: PerpMarket) => sum + (m.volume24h || 0), 0)
        const totalOI = markets.reduce((sum: number, m: PerpMarket) => sum + (m.openInterest || 0), 0)
        const avgChange = markets.length > 0
          ? markets.reduce((sum: number, m: PerpMarket) => sum + (m.changePercent24h || 0), 0) / markets.length
          : 0
        const marketsUp = markets.filter((m: PerpMarket) => (m.changePercent24h || 0) > 0).length
        const marketsDown = markets.filter((m: PerpMarket) => (m.changePercent24h || 0) < 0).length

        setOverview({
          totalMarkets: markets.length,
          totalVolume24h: totalVolume,
          totalOpenInterest: totalOI,
          avgChange24h: avgChange,
          marketsUp,
          marketsDown,
        })
      }
      setLoading(false)
    }

    fetchOverview()
    const interval = setInterval(fetchOverview, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const formatVolume = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
    if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
    return `$${(v / 1e3).toFixed(2)}K`
  }

  return (
    <div className="bg-sidebar rounded-2xl p-4 flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-5 h-5 text-[#0066FF]" />
        <h2 className="text-xl font-bold text-foreground">Market Overview</h2>
      </div>
      {loading ? (
        <div className="space-y-3 flex-1">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : overview ? (
        <div className="space-y-3 flex-1">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Markets</span>
              <span className="text-sm font-semibold text-foreground">{overview.totalMarkets}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">24h Volume</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{formatVolume(overview.totalVolume24h)}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Open Interest</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{formatVolume(overview.totalOpenInterest)}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Avg Change 24h</span>
              <div className={cn(
                "flex items-center gap-1 text-sm font-semibold",
                overview.avgChange24h >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {overview.avgChange24h >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                {overview.avgChange24h >= 0 ? '+' : ''}{overview.avgChange24h.toFixed(2)}%
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1 text-green-600">
                <TrendingUp className="w-3 h-3" />
                <span>{overview.marketsUp} Up</span>
              </div>
              <div className="flex items-center gap-1 text-red-600">
                <TrendingDown className="w-3 h-3" />
                <span>{overview.marketsDown} Down</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground flex-1">No data available</div>
      )}
    </div>
  )
}

