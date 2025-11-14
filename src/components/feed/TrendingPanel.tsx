'use client'

import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext'
import { useWidgetCacheStore } from '@/stores/widgetCacheStore'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

interface TrendingItem {
  id: string
  tag: string
  tagSlug: string
  category?: string | null
  postCount: number
  summary?: string | null
  rank: number
}

export function TrendingPanel() {
  const router = useRouter()
  const [trending, setTrending] = useState<TrendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const { getTrending, setTrending: cacheTrending } = useWidgetCacheStore()
  const { registerRefresh, unregisterRefresh } = useWidgetRefresh()

  // Use ref to store fetchTrending function to break dependency chain
  const fetchTrendingRef = useRef<(() => void) | null>(null)

  const fetchTrending = useCallback(async (skipCache = false) => {
    // Check cache first (unless explicitly skipping)
    if (!skipCache) {
      const cached = getTrending()
      if (cached) {
        setTrending(cached as TrendingItem[])
        setLoading(false)
        return
      }
    }

    const response = await fetch('/api/feed/widgets/trending')
    const data = await response.json()
    if (data.success) {
      const trendingData = data.trending || []
      setTrending(trendingData)
      cacheTrending(trendingData) // Cache the data
    }
    setLoading(false)
  }, [getTrending, cacheTrending])

  // Update ref when fetchTrending changes
  useEffect(() => {
    fetchTrendingRef.current = () => fetchTrending(true) // Skip cache on manual refresh
  }, [fetchTrending])

  useEffect(() => {
    fetchTrending()
  }, [fetchTrending])

  // Register refresh function
  useEffect(() => {
    const refresh = () => fetchTrending(true)
    registerRefresh('trending', refresh)
    return () => unregisterRefresh('trending')
  }, [registerRefresh, unregisterRefresh, fetchTrending])

  // Note: Real-time updates via SSE removed - using manual pull-to-refresh

  const handleTrendingClick = (item: TrendingItem) => {
    router.push(`/trending/${item.tagSlug}`)
  }

  return (
    <div className="bg-sidebar rounded-lg p-3 md:p-4 flex-1 flex flex-col">
      <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-foreground mb-2 md:mb-3 text-left">
        Trending
      </h2>
      {loading ? (
        <div className="text-sm md:text-base text-muted-foreground pl-2 md:pl-3 flex-1">Loading...</div>
      ) : trending.length === 0 ? (
        <div className="text-sm md:text-base text-muted-foreground pl-2 md:pl-3 flex-1">
          No trending topics at the moment.
        </div>
      ) : (
        <div className="space-y-2 md:space-y-2.5 pl-2 md:pl-3 flex-1">
          {trending.map((item) => (
            <div
              key={item.id}
              onClick={() => handleTrendingClick(item)}
              className="flex items-start gap-2 md:gap-2.5 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -ml-1.5 transition-colors duration-200"
            >
              <div className="flex-1 min-w-0">
                {/* Category and status */}
                <p className="text-xs md:text-sm text-muted-foreground">
                  {item.category || 'Trending'} · Trending
                </p>
                {/* Tag name */}
                <p className="text-base md:text-lg lg:text-xl font-semibold text-foreground leading-relaxed">
                  {item.tag}
                </p>
                {/* Summary */}
                {item.summary && (
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                    {item.summary}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

