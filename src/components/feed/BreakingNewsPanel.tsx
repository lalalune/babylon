'use client'

import { useWidgetCacheStore } from '@/stores/widgetCacheStore'
import { Activity, Calendar, DollarSign, TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BreakingNewsDetailModal } from './BreakingNewsDetailModal'
import { Skeleton } from '@/components/shared/Skeleton'

interface BreakingNewsItem {
  id: string
  title: string
  description: string
  icon: 'chart' | 'calendar' | 'dollar' | 'trending'
  timestamp: string
  trending?: boolean
  source?: string
  fullDescription?: string
  imageUrl?: string
  relatedQuestion?: number
  relatedActorId?: string
  relatedOrganizationId?: string
}

export function BreakingNewsPanel() {
  const [news, setNews] = useState<BreakingNewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<BreakingNewsItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { getBreakingNews, setBreakingNews } = useWidgetCacheStore()

  // Use ref to store fetchNews function to break dependency chain
  const fetchNewsRef = useRef<(() => void) | null>(null)

  // Force close modal on HMR to prevent stuck state
  useEffect(() => {
    return () => {
      setIsModalOpen(false)
      setSelectedItem(null)
    }
  }, [])

  const fetchNews = useCallback(async (skipCache = false) => {
    // Check cache first (unless explicitly skipping)
    if (!skipCache) {
      const cached = getBreakingNews()
      // Only use cache if it has data (don't cache empty arrays)
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setNews(cached as BreakingNewsItem[])
        setLoading(false)
        return
      }
    }

    const response = await fetch('/api/feed/widgets/breaking-news')
    const data = await response.json()
    if (data.success) {
      const newsData = data.news || []
      setNews(newsData)
      setBreakingNews(newsData) // Cache the data
    }
    setLoading(false)
  }, [getBreakingNews, setBreakingNews])

  // Update ref when fetchNews changes
  useEffect(() => {
    fetchNewsRef.current = () => fetchNews(true) // Skip cache on manual refresh
  }, [fetchNews])

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  // Note: Real-time updates via SSE removed - using periodic polling instead

  const getIcon = (icon: BreakingNewsItem['icon']) => {
    switch (icon) {
      case 'chart':
        return <TrendingUp className="w-6 h-6 sm:w-7 sm:h-7" />
      case 'calendar':
        return <Calendar className="w-6 h-6 sm:w-7 sm:h-7" />
      case 'dollar':
        return <DollarSign className="w-6 h-6 sm:w-7 sm:h-7" />
      default:
        return <Activity className="w-6 h-6 sm:w-7 sm:h-7" />
    }
  }

  const handleItemClick = (item: BreakingNewsItem) => {
    setSelectedItem(item)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedItem(null)
  }

  return (
    <>
      <div className="bg-sidebar rounded-2xl p-4 flex-1 flex flex-col">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 text-left">Breaking News</h2>
        {loading ? (
          <div className="space-y-3 pl-3 flex-1">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : news.length === 0 ? (
          <div className="text-base text-muted-foreground pl-3 flex-1">No breaking news at the moment.</div>
        ) : (
          <div className="space-y-2.5 pl-3 flex-1">
            {news.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-1.5 -ml-1.5 transition-colors duration-200"
              >
                <div className="text-[#0066FF] mt-0.5 shrink-0">
                  {getIcon(item.icon)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg sm:text-xl font-semibold text-foreground leading-relaxed">
                    {item.title}
                  </p>
                  <p className="text-base sm:text-lg text-muted-foreground mt-1">
                    {item.description}
                    {item.trending && (
                      <span className="ml-2 text-[#0066FF] font-semibold">• Trending</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BreakingNewsDetailModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        item={selectedItem}
      />
    </>
  )
}

