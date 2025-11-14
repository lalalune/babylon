'use client'

import { CreatePostModal } from '@/components/posts/CreatePostModal'
import { PostCard } from '@/components/posts/PostCard'
import { FeedToggle } from '@/components/shared/FeedToggle'
import { InviteFriendsBanner } from '@/components/shared/InviteFriendsBanner'
import { PageContainer } from '@/components/shared/PageContainer'
import { PullToRefreshIndicator } from '@/components/shared/PullToRefreshIndicator'
import { SearchBar } from '@/components/shared/SearchBar'
import { FeedSkeleton } from '@/components/shared/Skeleton'
import { WidgetSidebar } from '@/components/shared/WidgetSidebar'
import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext'
import { useAuth } from '@/hooks/useAuth'
import { useErrorToasts } from '@/hooks/useErrorToasts'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { cn } from '@/lib/utils'
import type { FeedPost } from '@/shared/types'
import { useAuthStore } from '@/stores/authStore'
import { useGameStore } from '@/stores/gameStore'
import { Plus } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'

const PAGE_SIZE = 20

function FeedPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authenticated } = useAuth()
  const { user } = useAuthStore()
  const { refreshAll: refreshWidgets } = useWidgetRefresh()
  const [tab, setTab] = useState<'latest' | 'following'>('latest')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Read search query from URL params on mount
  useEffect(() => {
    const searchParam = searchParams.get('search')
    if (searchParam) {
      setSearchQuery(searchParam)
    }
  }, [searchParams])
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  
  const [followingPosts, setFollowingPosts] = useState<FeedPost[]>([])
  const [loadingFollowing, setLoadingFollowing] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map())
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Smart banner frequency based on user referrals
  const calculateBannerInterval = () => {
    if (!user) return Math.floor(Math.random() * 51) + 50
    
    const referralCount = user.referralCount ?? 0
    
    // Check if recently dismissed (within 7 days)
    const dismissKey = `banner_dismiss_time_${user.id}`
    const lastDismiss = typeof window !== 'undefined' ? localStorage.getItem(dismissKey) : null
    if (lastDismiss) {
      const daysSinceDismiss = (Date.now() - parseInt(lastDismiss)) / 86400000
      if (daysSinceDismiss < 7) {
        return 999999 // Don't show for 7 days after dismiss
      }
    }
    
    // Frequency based on referrals
    if (referralCount === 0) {
      // No referrals: show more frequently (30-50 posts)
      return Math.floor(Math.random() * 21) + 30
    } else if (referralCount < 5) {
      // Few referrals: normal frequency (50-80 posts)
      return Math.floor(Math.random() * 31) + 50
    } else if (referralCount < 10) {
      // Some referrals: less frequent (80-120 posts)
      return Math.floor(Math.random() * 41) + 80
    } else {
      // Many referrals: rarely (150-200 posts)
      return Math.floor(Math.random() * 51) + 150
    }
  }
  
  const bannerInterval = useRef(calculateBannerInterval())

  // Game timeline state (viewer-style)
  const { allGames, startTime, currentTimeMs } = useGameStore()
  const currentDate = startTime ? new Date(startTime + currentTimeMs) : null

  // Enable error toast notifications
  useErrorToasts()

  useEffect(() => {
    const loadActorNames = async () => {
      const response = await fetch('/data/actors.json')
      const data = await response.json() as { actors?: Array<{ id: string; name: string }> }
      const nameMap = new Map<string, string>()
      data.actors?.forEach((actor) => {
        nameMap.set(actor.id, actor.name)
      })
      setActorNames(nameMap)
    }
    loadActorNames()
  }, [])

  const fetchLatestPosts = useCallback(async (requestOffset: number, append = false, skipLoadingState = false) => {
    if (tab !== 'latest') return

    if (!skipLoadingState) {
      if (append) setLoadingMore(true)
      else setLoading(true)
    }

    const response = await fetch(`/api/posts?limit=${PAGE_SIZE}&offset=${requestOffset}`)
    if (!response.ok) {
      if (append) setHasMore(false)
      return
    }

    const data = await response.json()
    const newPosts = data.posts as FeedPost[]
    const total = data.total as number | undefined

    let uniqueAdded = 0

    setPosts(prev => {
      const prevSize = prev.length
      const combined = append ? [...prev, ...newPosts] : [...newPosts, ...prev]
      const unique = new Map<string, FeedPost>()
      combined.forEach(post => {
        unique.set(post.id, post)
      })

      const deduped = Array.from(unique.values()).sort((a, b) => {
        const aTime = new Date(a.timestamp ?? 0).getTime()
        const bTime = new Date(b.timestamp ?? 0).getTime()
        return bTime - aTime
      })

      uniqueAdded = deduped.length - prevSize
      setOffset(deduped.length)
      return deduped
    })

    if (append && uniqueAdded === 0) {
      setHasMore(false)
      return
    }

    const moreAvailable =
      newPosts.length === PAGE_SIZE &&
      (total === undefined || requestOffset + newPosts.length < total)

    if (!append && newPosts.length === 0 && requestOffset === 0) {
      setHasMore(false)
    } else {
      setHasMore(moreAvailable)
    }

    if (!skipLoadingState) {
      if (append) setLoadingMore(false)
      else setLoading(false)
    }
  }, [tab])

  const handleRefresh = useCallback(async () => {
    if (tab !== 'latest') return
    // Use skipLoadingState=true since pull-to-refresh shows its own loading indicator
    await fetchLatestPosts(0, false, true)
    // Also refresh widgets
    refreshWidgets()
  }, [tab, fetchLatestPosts, refreshWidgets])

  // Pull-to-refresh hook
  const {
    pullDistance,
    isRefreshing,
    containerRef: scrollContainerRef,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: tab === 'latest',
  })

  // Initial load and reset when switching to latest tab
  useEffect(() => {
    if (tab === 'latest') {
      setOffset(0)
      setHasMore(true)
      fetchLatestPosts(0, false)
    }
  }, [tab, fetchLatestPosts])

  // Infinite scroll observer for latest tab
  useEffect(() => {
    if (tab !== 'latest') return

    const target = loadMoreRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (
          entry?.isIntersecting &&
          hasMore &&
          !loading &&
          !loadingMore &&
          !searchQuery.trim()
        ) {
          void fetchLatestPosts(offset, true)
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(target)
    return () => {
      observer.disconnect()
    }
  }, [tab, hasMore, loading, loadingMore, searchQuery, offset, fetchLatestPosts])

  useEffect(() => {
    const fetchFollowingPosts = async () => {
      if (tab !== 'following') return
      if (!authenticated || !user) {
        setFollowingPosts([])
        setLoadingFollowing(false)
        return
      }

      setLoadingFollowing(true)
      
      const token = typeof window !== 'undefined' ? window.__privyAccessToken : null

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }

      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(
        `/api/posts?following=true&userId=${user.id}&limit=${PAGE_SIZE}&offset=0`,
        { headers }
      )

      const data = await response.json()
      setFollowingPosts(data.posts as FeedPost[])
      setLoadingFollowing(false)
    }

    fetchFollowingPosts()
  }, [tab, authenticated, user])

  // Compute timeline-visible posts from game (mirrors viewer FeedView)
  const timelinePosts = useMemo(() => {
    if (!startTime || !currentDate || allGames.length === 0) return [] as Array<{
      id: string
      content: string
      authorId: string
      authorName: string
      timestamp: string
    }>

    const items: Array<{ id: string; content: string; authorId: string; authorName: string; timestamp: string; timestampMs: number }>= []

    allGames.forEach((g) => {
      g.timeline?.forEach((day) => {
        day.feedPosts?.forEach((post) => {
          const ts = new Date(post.timestamp).getTime()
          items.push({
            id: `game-${g.id}-${post.timestamp}`,
            content: post.content,
            authorId: post.author,
            authorName: post.authorName,
            timestamp: post.timestamp,
            timestampMs: ts,
          })
        })
      })
    })

    const currentAbs = startTime + currentTimeMs
    return items
      .filter((p) => p.timestampMs <= currentAbs)
      .sort((a, b) => b.timestampMs - a.timestampMs)
      .map(({ timestampMs: _timestampMs, ...rest }) => {
        // Explicitly exclude timestampMs from the result
        return rest
      })
  }, [allGames, startTime, currentTimeMs])

  // Choose data source: always use API posts for latest tab (GameEngine persists to database)
  // For following tab, use followingPosts
  // Only use timelinePosts if we have no API posts (fallback for viewer mode)
  const basePosts = (tab === 'following') 
    ? followingPosts 
    : (posts.length > 0 ? posts : (startTime && allGames.length > 0 ? timelinePosts : posts))

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return basePosts
    const query = searchQuery.toLowerCase()
    return basePosts.filter((post) => {
      const postContent = String(post.content)
      const authorField = 'author' in post ? String(post.author) : String(post.authorId)
      const postAuthorName = String(post.authorName)
      return (
        postContent.toLowerCase().includes(query) ||
        authorField.toLowerCase().includes(query) ||
        postAuthorName.toLowerCase().includes(query)
      )
    })
  }, [basePosts, searchQuery])

  if (loading) {
    return (
      <PageContainer noPadding className="flex flex-col">
        <FeedToggle activeTab={tab} onTabChange={setTab} />
        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-4 sm:px-6">
            <FeedSkeleton count={8} />
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer noPadding className="flex flex-col min-h-screen w-full overflow-visible">
      {/* Mobile: Header with tabs and search */}
      <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0 md:hidden">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2">
          {/* Tabs on left */}
          <div className="flex-shrink-0">
            <FeedToggle activeTab={tab} onTabChange={setTab} />
          </div>
          {/* Search on right */}
          <div className="flex-1 max-w-[200px]">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search..."
              compact
            />
          </div>
        </div>
      </div>

      {/* Desktop: Multi-column layout with scrollable feed */}
      <div className="hidden lg:flex flex-1 min-h-0">
        {/* Left: Feed area - aligned with sidebar, full width */}
        <div className="flex-1 flex flex-col min-w-0 border-l border-r border-[rgba(120,120,120,0.5)]">
          {/* Desktop: Top bar with tabs, search, and post button */}
          <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0">
            <div className="px-6 py-4">
              {/* Top row: Tabs and Post button */}
              <div className="flex items-center justify-between mb-3">
                <FeedToggle activeTab={tab} onTabChange={setTab} />
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search..."
                />
              </div>
            </div>
          </div>

          {/* Feed content - Scrollable container with pull-to-refresh */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 bg-background overflow-y-auto overflow-x-hidden"
          >
            <div className="w-full max-w-[700px] mx-auto">
              {/* Pull to refresh indicator (desktop) */}
              <PullToRefreshIndicator
                pullDistance={pullDistance}
                isRefreshing={isRefreshing}
              />
            </div>
            
            {(loading || (tab === 'following' && loadingFollowing)) ? (
              <div className="w-full max-w-[700px] mx-auto px-6">
                <FeedSkeleton count={6} />
              </div>
            ) : filteredPosts.length === 0 && !searchQuery && tab === 'latest' ? (
                // No posts yet
                <div className="w-full p-4 sm:p-8 text-center">
                  <div className="text-muted-foreground py-8 sm:py-12">
                    <h2 className="text-lg sm:text-2xl font-bold mb-2 text-foreground">No Posts Yet</h2>
                    <p className="mb-4 text-sm sm:text-base">
                      Engine is generating posts...
                    </p>
                    <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
                      <p>Check terminal for tick logs.</p>
                      <p>Posts appear within 60 seconds.</p>
                    </div>
                  </div>
                </div>
              ) : filteredPosts.length === 0 && !searchQuery && tab === 'following' ? (
                // Following tab with no followed profiles
                <div className="w-full p-4 sm:p-8 text-center">
                  <div className="text-muted-foreground py-8 sm:py-12">
                    <h2 className="font-semibold mb-2 text-foreground">👥 Not Following Anyone Yet</h2>
                    <p className="mb-4 text-sm sm:text-base">
                      {loadingFollowing
                        ? 'Loading following...'
                        : 'Follow profiles to see their posts here. Visit a profile and click the Follow button.'}
                    </p>
                  </div>
                </div>
              ) : filteredPosts.length === 0 && !searchQuery ? (
                // Game loaded but no visible posts yet
                <div className="w-full p-4 sm:p-8 text-center">
                <div className="text-muted-foreground py-8 sm:py-12">
                  <h2 className="text-lg sm:text-xl font-semibold mb-2 text-foreground">⏱️ No Posts Yet</h2>
                  <p className="mb-4 text-sm sm:text-base">
                    Game is running in the background via realtime-daemon. Content will appear here as it&apos;s generated.
                  </p>
                </div>
                </div>
              ) : filteredPosts.length === 0 && searchQuery ? (
                // No search results
                <div className="w-full p-4 sm:p-8 text-center">
                  <div className="text-muted-foreground py-8 sm:py-12">
                    <h2 className="text-lg sm:text-xl font-semibold mb-2 text-foreground">No Results</h2>
                    <p className="mb-4 text-sm sm:text-base break-words">
                      No posts found matching &quot;{searchQuery}&quot;
                    </p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className={cn(
                        'inline-block px-4 sm:px-6 py-2 sm:py-3 font-semibold rounded text-sm sm:text-base cursor-pointer',
                        'bg-[#3462f3] text-white',
                        'hover:bg-[#2952d9]',
                        'transition-all duration-300'
                      )}
                    >
                      Clear Search
                    </button>
                  </div>
                </div>
            ) : (
              // Show posts - centered container
              <div className="w-full px-6 space-y-0 max-w-[700px] mx-auto">
                {filteredPosts.map((post, i: number) => {
                    // Handle both FeedPost (from game store) and API post shapes
                    // API posts have authorId, FeedPost has author (both are author IDs)
                    const authorId = ('authorId' in post ? post.authorId : post.author) || ''
                    // Get actual actor name from loaded data, fallback to authorName or ID
                    const authorName = actorNames.get(authorId) || ('authorName' in post ? post.authorName : '') || authorId

                    // Show banner at the random interval (if not dismissed)
                    const showBannerAfterThisPost = !bannerDismissed && i === bannerInterval.current - 1

                    const postData = {
                      id: post.id,
                      content: post.content,
                      authorId,
                      authorName,
                      authorUsername: ('authorUsername' in post ? post.authorUsername : null) || null,
                      authorProfileImageUrl: ('authorProfileImageUrl' in post ? post.authorProfileImageUrl : null),
                      timestamp: post.timestamp,
                      likeCount: ('likeCount' in post ? (post.likeCount as number) : 0) || 0,
                      commentCount: ('commentCount' in post ? (post.commentCount as number) : 0) || 0,
                      shareCount: ('shareCount' in post ? (post.shareCount as number) : 0) || 0,
                      isLiked: ('isLiked' in post ? (post.isLiked as boolean) : false) || false,
                      isShared: ('isShared' in post ? (post.isShared as boolean) : false) || false,
                    }

                    return (
                      <div key={`post-wrapper-${post.id}-${i}`}>
                        <PostCard
                          post={postData}
                          onClick={() => router.push(`/post/${post.id}`)}
                        />
                        {showBannerAfterThisPost && (
                          <InviteFriendsBanner 
                            onDismiss={() => {
                              setBannerDismissed(true)
                              // Recalculate interval for next load
                              bannerInterval.current = calculateBannerInterval()
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                  {tab === 'latest' && (
                    <>
                      <div ref={loadMoreRef} className="h-1 w-full" />
                      {loadingMore && (
                        <div className="py-4 text-center text-sm text-muted-foreground">
                          Loading more posts...
                        </div>
                      )}
                      {!loadingMore && !hasMore && posts.length > 0 && (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                          You&apos;re all caught up.
                        </div>
                      )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Widget panels - only on desktop (xl+) */}
        <WidgetSidebar />
      </div>

      {/* Mobile/Tablet: Feed area */}
      <div 
        ref={scrollContainerRef}
        className="flex lg:hidden flex-1 overflow-y-auto overflow-x-hidden bg-background w-full"
      >
        <div className="w-full">
          {/* Pull to refresh indicator */}
          <PullToRefreshIndicator
            pullDistance={pullDistance}
            isRefreshing={isRefreshing}
          />
          
          {(loading || (tab === 'following' && loadingFollowing)) ? (
            <div className="w-full px-4">
              <FeedSkeleton count={5} />
            </div>
          ) : filteredPosts.length === 0 && !searchQuery && tab === 'latest' ? (
            // No posts yet
            <div className="w-full p-4 sm:p-8 text-center">
              <div className="text-muted-foreground py-8 sm:py-12">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 text-foreground">No Posts Yet</h2>
                <p className="mb-4 text-sm sm:text-base">
                  Engine is generating posts...
                </p>
                <div className="text-xs sm:text-sm text-muted-foreground space-y-2">
                  <p>Check terminal for tick logs.</p>
                  <p>Posts appear within 60 seconds.</p>
                </div>
              </div>
            </div>
          ) : filteredPosts.length === 0 && !searchQuery && tab === 'following' ? (
            // Following tab with no followed profiles
            <div className="w-full p-4 sm:p-8 text-center">
              <div className="text-muted-foreground py-8 sm:py-12">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 text-foreground">👥 Not Following Anyone Yet</h2>
                <p className="mb-4 text-sm sm:text-base">
                  {loadingFollowing
                    ? 'Loading following...'
                    : 'Follow profiles to see their posts here. Visit a profile and click the Follow button.'}
                </p>
              </div>
            </div>
          ) : filteredPosts.length === 0 && !searchQuery ? (
            // Game loaded but no visible posts yet
            <div className="w-full p-4 sm:p-8 text-center">
              <div className="text-muted-foreground py-8 sm:py-12">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 text-foreground">⏱️ No Posts Yet</h2>
                <p className="mb-4 text-sm sm:text-base">
                  Game is running in the background via realtime-daemon. Content will appear here as it&apos;s generated.
                </p>
              </div>
            </div>
          ) : filteredPosts.length === 0 && searchQuery ? (
            // No search results
            <div className="w-full p-4 sm:p-8 text-center">
              <div className="text-muted-foreground py-8 sm:py-12">
                <h2 className="text-lg sm:text-xl font-semibold mb-2 text-foreground">No Results</h2>
                <p className="mb-4 text-sm sm:text-base break-words">
                  No posts found matching &quot;{searchQuery}&quot;
                </p>
                <button
                  onClick={() => setSearchQuery('')}
                  className={cn(
                    'inline-block px-4 sm:px-6 py-2 sm:py-3 font-semibold rounded text-sm sm:text-base cursor-pointer',
                    'bg-[#3462f3] text-white',
                    'hover:bg-[#2952d9]',
                    'transition-all duration-300'
                  )}
                >
                  Clear Search
                </button>
              </div>
            </div>
          ) : (
            // Show posts
            <div className="w-full px-4">
              {filteredPosts.map((post, i: number) => {
              // Handle both FeedPost (from game store) and API post shapes
              // API posts have authorId, FeedPost has author (both are author IDs)
              const authorId = ('authorId' in post ? post.authorId : post.author) || ''
              // Get actual actor name from loaded data, fallback to authorName or ID
              const authorName = actorNames.get(authorId) || ('authorName' in post ? post.authorName : '') || authorId

              // Show banner at the random interval (if not dismissed)
              const showBannerAfterThisPost = !bannerDismissed && i === bannerInterval.current - 1

              const postData = {
                id: post.id,
                content: post.content,
                authorId,
                authorName,
                authorUsername: ('authorUsername' in post ? post.authorUsername : null) || null,
                authorProfileImageUrl: ('authorProfileImageUrl' in post ? post.authorProfileImageUrl : null),
                timestamp: post.timestamp,
                likeCount: ('likeCount' in post ? (post.likeCount as number) : 0) || 0,
                commentCount: ('commentCount' in post ? (post.commentCount as number) : 0) || 0,
                shareCount: ('shareCount' in post ? (post.shareCount as number) : 0) || 0,
                isLiked: ('isLiked' in post ? (post.isLiked as boolean) : false) || false,
                isShared: ('isShared' in post ? (post.isShared as boolean) : false) || false,
              }

              return (
                <div key={`post-wrapper-${post.id}-${i}`}>
                  <PostCard
                    post={postData}
                    onClick={() => router.push(`/post/${post.id}`)}
                  />
                  {showBannerAfterThisPost && (
                    <InviteFriendsBanner 
                      onDismiss={() => {
                        setBannerDismissed(true)
                        // Recalculate interval for next load
                        bannerInterval.current = calculateBannerInterval()
                      }}
                    />
                  )}
                </div>
                )
              })}
              {tab === 'latest' && (
                <>
                  <div ref={loadMoreRef} className="h-1 w-full" />
                  {loadingMore && (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      Loading more posts...
                    </div>
                  )}
                  {!loadingMore && !hasMore && posts.length > 0 && (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      You&apos;re all caught up.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Post Button - Bottom Right */}
      {authenticated && (
        <button
          onClick={() => setShowCreateModal(true)}
          className={cn(
            'fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[100]',
            'flex items-center justify-center gap-2',
            'bg-[#0066FF] hover:bg-[#2952d9]',
            'text-white font-semibold',
            'rounded-full',
            'transition-all duration-200',
            'shadow-lg hover:shadow-xl hover:scale-105',
            'w-14 h-14 md:w-16 md:h-16'
          )}
          aria-label="Create Post"
        >
          <Plus className="w-6 h-6 md:w-7 md:h-7" />
        </button>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPostCreated={() => {
          // Don't reload - WebSocket will handle real-time update
          // Just close the modal, the new post will appear automatically
          setShowCreateModal(false)

          // If not on feed page, navigate to it
          if (window.location.pathname !== '/feed') {
            router.push('/feed')
          }
        }}
      />
    </PageContainer>
  )
}

// Export the feed page content directly (WidgetRefreshProvider is now in root Providers)
export default function FeedPage() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <FeedPageContent />
    </Suspense>
  )
}
