'use client'

import { Skeleton } from '@/components/shared/Skeleton'
import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext'
import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface Market {
  id: string
  question: string
  yesPrice: number
  noPrice: number
  volume: number
  endDate: string
  priceChange24h?: number
  changePercent24h?: number
}

interface PerpMarket {
  ticker: string
  name: string
  currentPrice: number
  change24h: number
  changePercent24h: number
  volume24h?: number
}

export function MarketsPanel() {
  const router = useRouter()
  const [markets, setMarkets] = useState<Market[]>([])
  const [perpMarkets, setPerpMarkets] = useState<PerpMarket[]>([])
  const [loading, setLoading] = useState(true)
  const { registerRefresh, unregisterRefresh } = useWidgetRefresh()

  const fetchMarkets = useCallback(async () => {
    // Fetch prediction markets
    const response = await fetch('/api/feed/widgets/markets')
    const data = await response.json()
    if (data.success) {
      setMarkets(data.markets || [])
    }

    // Fetch perp markets for trending tokens
    const perpResponse = await fetch('/api/markets/perps')
    const perpData = await perpResponse.json()
    
    if (perpData.markets && Array.isArray(perpData.markets)) {
      // Map and normalize the data (same as TopMoversPanel)
      const normalizedMarkets = perpData.markets.map((m: {
        ticker: string
        name: string
        currentPrice?: number
        change24h?: number
        changePercent24h?: number
        volume24h?: number
      }) => ({
        ticker: m.ticker,
        name: m.name,
        currentPrice: m.currentPrice || 0,
        change24h: m.change24h || 0,
        changePercent24h: m.changePercent24h || 0,
        volume24h: m.volume24h,
      }))
      
      setPerpMarkets(normalizedMarkets)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMarkets()
  }, [fetchMarkets])

  // Register refresh function
  useEffect(() => {
    registerRefresh('markets', fetchMarkets)
    return () => unregisterRefresh('markets')
  }, [registerRefresh, unregisterRefresh, fetchMarkets])

  const handleMarketClick = (marketId: string) => {
    router.push(`/markets/${marketId}`)
  }

  // Get top movers (markets with biggest price changes)
  const topMovers = markets
    .filter(m => m.changePercent24h !== undefined && m.changePercent24h !== 0)
    .sort((a, b) => Math.abs(b.changePercent24h || 0) - Math.abs(a.changePercent24h || 0))
    .slice(0, 3)

  // Get trending tokens - use same strategy as TopMoversPanel
  const sortedPerpMarkets = [...perpMarkets].sort((a, b) => b.changePercent24h - a.changePercent24h)
  const tokenGainers = sortedPerpMarkets.slice(0, 3) // Top 3 (highest positive or least negative)
  const tokenLosers = sortedPerpMarkets.slice(-3).reverse() // Bottom 3 (most negative)

  const handleTokenClick = (ticker: string) => {
    router.push(`/markets/perps/${ticker}`)
  }

  return (
    <div className="bg-sidebar rounded-2xl px-4 py-3 flex-1 flex flex-col">
      <h2 className="text-lg font-bold text-foreground mb-3 text-left">
        Markets
      </h2>
      {loading ? (
        <div className="space-y-3 pl-3 flex-1">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : markets.length === 0 && perpMarkets.length === 0 ? (
        <div className="text-sm text-muted-foreground pl-3 flex-1">
          No active markets at the moment.
        </div>
      ) : (
        <>
          {/* Top Movers Section - show when we have price changes */}
          {topMovers.length > 0 && (
            <div className="mb-4 pl-3">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-4 h-4 text-[#0066FF]" />
                <h3 className="text-sm font-semibold text-foreground">Top Movers (24h)</h3>
              </div>
              <div className="space-y-2">
                {topMovers.map((market) => (
                  <div
                    key={`mover-${market.id}`}
                    onClick={() => handleMarketClick(market.id)}
                    className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 rounded-lg -ml-1.5 px-2 py-2 transition-colors duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground leading-snug line-clamp-1">
                        {market.question}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-green-500">
                          Yes {(market.yesPrice * 100).toFixed(0)}%
                        </span>
                        <div className={cn(
                          "flex items-center gap-0.5 text-xs font-semibold",
                          (market.changePercent24h || 0) >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {(market.changePercent24h || 0) >= 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {(market.changePercent24h || 0) >= 0 ? '+' : ''}{(market.changePercent24h || 0).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-border mt-3 pt-3" />
            </div>
          )}

          {/* Trending Tokens Section - show perp futures gainers and losers */}
          {perpMarkets.length > 0 && (
            <div className="mb-4 pl-3">
              <div className="grid grid-cols-2 gap-3">
                {/* Top Gainers Column */}
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    <h4 className="text-xs font-semibold text-green-600">Gainers</h4>
                  </div>
                  <div className="space-y-1.5">
                    {tokenGainers.map((token) => (
                      <div
                        key={`gainer-${token.ticker}`}
                        onClick={() => handleTokenClick(token.ticker)}
                        className="cursor-pointer hover:bg-muted/50 rounded p-1.5 transition-colors duration-200"
                      >
                        <p className="text-xs font-bold text-foreground">
                          ${token.ticker}
                        </p>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-xs text-muted-foreground truncate">
                            ${token.currentPrice.toFixed(2)}
                          </span>
                          <span className={cn(
                            "text-xs font-semibold",
                            token.changePercent24h >= 0 ? "text-green-600" : "text-muted-foreground"
                          )}>
                            {token.changePercent24h >= 0 ? '+' : ''}{token.changePercent24h.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Losers Column */}
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <TrendingDown className="w-3 h-3 text-red-600" />
                    <h4 className="text-xs font-semibold text-red-600">Losers</h4>
                  </div>
                  <div className="space-y-1.5">
                    {tokenLosers.map((token) => (
                      <div
                        key={`loser-${token.ticker}`}
                        onClick={() => handleTokenClick(token.ticker)}
                        className="cursor-pointer hover:bg-muted/50 rounded p-1.5 transition-colors duration-200"
                      >
                        <p className="text-xs font-bold text-foreground">
                          ${token.ticker}
                        </p>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <span className="text-xs text-muted-foreground truncate">
                            ${token.currentPrice.toFixed(2)}
                          </span>
                          <span className={cn(
                            "text-xs font-semibold",
                            token.changePercent24h < 0 ? "text-red-600" : "text-muted-foreground"
                          )}>
                            {token.changePercent24h.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Prediction Markets List - only show when there are prediction markets */}
          {markets.length > 0 && (
            <div className="pl-3 flex-1">
              <div className="space-y-2.5">
                {markets.slice(0, 5).map((market) => (
                <div
                  key={market.id}
                  onClick={() => handleMarketClick(market.id)}
                    className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 rounded-lg -ml-1.5 px-2 py-2 transition-colors duration-200"
                >
                  <div className="flex-1 min-w-0">
                    {/* Market question */}
                    <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                      {market.question}
                    </p>
                    {/* Market stats */}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-green-500">
                        Yes {(market.yesPrice * 100).toFixed(0)}%
                      </span>
                      <span className="text-xs text-red-500">
                        No {(market.noPrice * 100).toFixed(0)}%
                      </span>
                      {market.volume > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ${market.volume.toFixed(0)}
                        </span>
                      )}
                      {market.changePercent24h !== undefined && market.changePercent24h !== 0 && (
                        <span className={cn(
                          "text-xs font-medium",
                          market.changePercent24h >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {market.changePercent24h >= 0 ? '+' : ''}{market.changePercent24h.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
