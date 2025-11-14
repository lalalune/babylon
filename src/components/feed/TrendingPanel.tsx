'use client'

import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext'
import { useWidgetCacheStore } from '@/stores/widgetCacheStore'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Skeleton } from '@/components/shared/Skeleton'

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
      // Only use cache if it has data (don't cache empty arrays)
      if (cached && Array.isArray(cached) && cached.length > 0) {
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
    <div className="bg-sidebar rounded-2xl p-4 flex-1 flex flex-col">
      <h2 className="text-lg font-bold text-foreground mb-3 text-left">
        Trending
      </h2>
      {loading ? (
        <div className="space-y-3 pl-3 flex-1">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : trending.length === 0 ? (
        <div className="text-sm text-muted-foreground pl-3 flex-1">
          No trending topics at the moment.
        </div>
      ) : (
        <div className="space-y-2 pl-3 flex-1">
          {trending.map((item) => (
            <div
              key={item.id}
              onClick={() => handleTrendingClick(item)}
              className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -ml-1.5 transition-colors duration-200"
            >
              <div className="flex-1 min-w-0">
                {/* Category and status */}
                <p className="text-xs text-muted-foreground">
                  {item.category || 'Trending'} · Trending
                </p>
                {/* Tag name */}
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {item.tag}
                </p>
                {/* Summary */}
                {item.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
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

