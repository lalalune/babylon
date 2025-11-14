'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext'

interface Market {
  id: string
  question: string
  yesPrice: number
  noPrice: number
  volume: number
  endDate: string
}

export function MarketsPanel() {
  const router = useRouter()
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const { registerRefresh, unregisterRefresh } = useWidgetRefresh()

  const fetchMarkets = useCallback(async () => {
    const response = await fetch('/api/feed/widgets/markets')
    const data = await response.json()
    if (data.success) {
      setMarkets(data.markets || [])
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

  return (
    <div className="bg-sidebar rounded-lg p-4 flex-1 flex flex-col">
      <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 text-left">
        Markets
      </h2>
      {loading ? (
        <div className="text-base text-muted-foreground pl-3 flex-1">Loading...</div>
      ) : markets.length === 0 ? (
        <div className="text-base text-muted-foreground pl-3 flex-1">
          No active markets at the moment.
        </div>
      ) : (
        <div className="space-y-2.5 pl-3 flex-1">
          {markets.map((market) => (
            <div
              key={market.id}
              onClick={() => handleMarketClick(market.id)}
              className="flex items-start gap-2.5 cursor-pointer hover:bg-muted/50 rounded-lg -ml-1.5 p-2 transition-colors duration-200"
            >
              <div className="flex-1 min-w-0">
                {/* Market question */}
                <p className="text-base sm:text-lg font-semibold text-foreground leading-relaxed line-clamp-2">
                  {market.question}
                </p>
                {/* Market stats */}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-green-500">
                    Yes {(market.yesPrice * 100).toFixed(0)}%
                  </span>
                  <span className="text-sm text-red-500">
                    No {(market.noPrice * 100).toFixed(0)}%
                  </span>
                  {market.volume > 0 && (
                    <span className="text-sm text-muted-foreground">
                      ${market.volume.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
