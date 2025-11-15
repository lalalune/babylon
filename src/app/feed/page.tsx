'use client'

import { ArticleCard } from '@/components/articles/ArticleCard'
import { CreatePostModal } from '@/components/posts/CreatePostModal'
import { PostCard } from '@/components/posts/PostCard'
import { FeedToggle } from '@/components/shared/FeedToggle'
import { InviteFriendsBanner } from '@/components/shared/InviteFriendsBanner'
import { PageContainer } from '@/components/shared/PageContainer'
import { PullToRefreshIndicator } from '@/components/shared/PullToRefreshIndicator'
import { FeedSkeleton } from '@/components/shared/Skeleton'
import { WidgetSidebar } from '@/components/shared/WidgetSidebar'
import { TradesFeed } from '@/components/trades/TradesFeed'
import { useWidgetRefresh } from '@/contexts/WidgetRefreshContext'
import { useAuth } from '@/hooks/useAuth'
import { useErrorToasts } from '@/hooks/useErrorToasts'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { cn } from '@/lib/utils'
import type { FeedPost } from '@/shared/types'
import { useAuthStore } from '@/stores/authStore'
import { useFeedStore } from '@/stores/feedStore'
import { useGameStore } from '@/stores/gameStore'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PAGE_SIZE = 20

function FeedPageContent() {
  const router = useRouter()
  const { authenticated, getAccessToken } = useAuth()
  const { user } = useAuthStore()
  const { refreshAll: refreshWidgets } = useWidgetRefresh()
  const { registerOptimisticPostCallback, unregisterOptimisticPostCallback } = useFeedStore()
  const [tab, setTab] = useState<'latest' | 'following' | 'trades'>('latest')
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null) // Cursor for pagination
  
  const [followingPosts, setFollowingPosts] = useState<FeedPost[]>([])
  const [loadingFollowing, setLoadingFollowing] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const [actorNames, setActorNames] = useState<Map<string, string>>(new Map())
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  
  // Track locally created posts (optimistic UI)
  const [localPosts, setLocalPosts] = useState<FeedPost[]>([])
  
  // Ref for scroll container (used by TradesFeed)
  const scrollContainerRefObject = useRef<HTMLDivElement | null>(null)
  
  // Ref to track loading state synchronously (prevents race conditions)
  const loadingMoreRef = useRef(false)
  
  // Keep ref in sync with state
  useEffect(() => {
    loadingMoreRef.current = loadingMore
  }, [loadingMore])
  
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
      try {
        const response = await fetch('/data/actors-full.json')
        if (!response.ok) return
        const data = await response.json() as { actors?: Array<{ id: string; name: string }> }
        const nameMap = new Map<string, string>()
        data.actors?.forEach((actor) => {
          nameMap.set(actor.id, actor.name)
        })
        setActorNames(nameMap)
      } catch (err) {
        console.error('Failed to load actor names:', err)
        // Fail silently - actor names are optional
      }
    }
    loadActorNames()
  }, [])

  // Register callback for optimistic posts (e.g., from quote reposts)
  useEffect(() => {
    const handleOptimisticPost = (post: FeedPost) => {
      setLocalPosts(prev => [post, ...prev])
    }

    registerOptimisticPostCallback(handleOptimisticPost)

    return () => {
      unregisterOptimisticPostCallback()
    }
  }, [registerOptimisticPostCallback, unregisterOptimisticPostCallback])

  const fetchLatestPosts = useCallback(async (requestCursor: string | null, append = false, skipLoadingState = false) => {
    if (tab !== 'latest') return
    
    // Guard against concurrent fetches (use ref for synchronous check)
    if (append && loadingMoreRef.current) {
      return
    }
    
    // Set loading states
    if (append) {
      setLoadingMore(true)
      loadingMoreRef.current = true
    } else if (!skipLoadingState) {
      setLoading(true)
    }

    try {
      const url = requestCursor 
        ? `/api/posts?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(requestCursor)}`
        : `/api/posts?limit=${PAGE_SIZE}`;
      
      const response = await fetch(url)
      if (!response.ok) {
        if (append) setHasMore(false)
        return
      }

      const data = await response.json()
      const newPosts = data.posts as FeedPost[]
      const nextCursor = data.cursor as string | null
      const hasMoreFromAPI = data.hasMore as boolean

      // Simple approach: merge and deduplicate, let state handle it
      setPosts(prev => {
        const combined = append ? [...prev, ...newPosts] : newPosts
        
        // Deduplicate by ID
        const unique = new Map<string, FeedPost>()
        combined.forEach(post => unique.set(post.id, post))
        
        // Sort by timestamp
        const deduped = Array.from(unique.values()).sort((a, b) => {
          const aTime = new Date(a.timestamp ?? 0).getTime()
          const bTime = new Date(b.timestamp ?? 0).getTime()
          return bTime - aTime
        })
        
        return deduped
      })
      
      // Update cursor for next page
      setCursor(nextCursor)
      
      // Clear local posts when refreshing (they should now be in API response)
      if (!append) {
        setLocalPosts(prev => {
          const newPostIds = new Set(newPosts.map(p => p.id))
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
          
          return prev.filter(localPost => {
            if (newPostIds.has(localPost.id)) return false
            const postTime = new Date(localPost.timestamp).getTime()
            if (postTime < fiveMinutesAgo) return false
            return true
          })
        })
      }

      // Update hasMore based on API response
      setHasMore(hasMoreFromAPI && newPosts.length > 0)
    } catch (err) {
      console.error('Failed to fetch latest posts:', err)
      if (append) setHasMore(false)
      if (!skipLoadingState) {
        if (append) setLoadingMore(false)
        else setLoading(false)
      }
    } finally {
      // Always reset loading states in finally block
      if (append) {
        setLoadingMore(false)
        loadingMoreRef.current = false
      } else if (!skipLoadingState) {
        setLoading(false)
      }
    }
  }, [tab])

  const handleRefresh = useCallback(async () => {
    if (tab !== 'latest' && tab !== 'trades') return
    if (tab === 'latest') {
      // Use skipLoadingState=true since pull-to-refresh shows its own loading indicator
      await fetchLatestPosts(null, false, true) // Reset cursor on refresh
      // Also refresh widgets
      refreshWidgets()
    }
    // For trades tab, the TradesFeed component handles its own refresh
  }, [tab, fetchLatestPosts, refreshWidgets])

  // Pull-to-refresh hook
  const {
    pullDistance,
    isRefreshing,
    containerRef: scrollContainerCallbackRef,
  } = usePullToRefresh({
    onRefresh: handleRefresh,
    enabled: tab === 'latest' || tab === 'trades',
  })

  // Combine callback ref from usePullToRefresh with our RefObject
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerCallbackRef(node)
    if (scrollContainerRefObject.current !== node) {
      scrollContainerRefObject.current = node
    }
  }, [scrollContainerCallbackRef])

  // Initial load and reset when switching to latest tab
  useEffect(() => {
    if (tab === 'latest') {
      setCursor(null) // Reset cursor
      setHasMore(true)
      fetchLatestPosts(null, false) // Initial load with no cursor
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
          !loadingMore
        ) {
          void fetchLatestPosts(cursor, true) // Use cursor for pagination
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(target)
    return () => {
      observer.disconnect()
    }
  }, [tab, hasMore, loading, loadingMore, cursor, fetchLatestPosts])

  useEffect(() => {
    const fetchFollowingPosts = async () => {
      if (tab !== 'following') return
      if (!authenticated || !user) {
        setFollowingPosts([])
        setLoadingFollowing(false)
        return
      }

      setLoadingFollowing(true)
      
      try {
        const token = await getAccessToken()

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

        if (!response.ok) {
          throw new Error('Failed to fetch following posts')
        }

        const data = await response.json()
        setFollowingPosts(data.posts as FeedPost[])
      } catch (err) {
        console.error('Failed to fetch following posts:', err)
        // Keep existing posts on error
      } finally {
        setLoadingFollowing(false)
      }
    }

    fetchFollowingPosts()
  }, [tab, authenticated, user])

  // Compute timeline-visible posts from game (mirrors viewer FeedView)
  const timelinePosts = useMemo(() => {
    if (!startTime || !currentDate || allGames.length === 0) return [] as FeedPost[]

    const items: Array<{ id: string; content: string; author: string; authorId: string; authorName: string; timestamp: string; timestampMs: number }>= []

    allGames.forEach((g) => {
      g.timeline?.forEach((day) => {
        day.feedPosts?.forEach((post) => {
          const ts = new Date(post.timestamp).getTime()
          items.push({
            id: `game-${g.id}-${post.timestamp}`,
            content: post.content,
            author: post.author, // Required by FeedPost interface
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
        return rest as FeedPost
      })
  }, [allGames, startTime, currentTimeMs])

  // Choose data source: always use API posts for latest tab (game tick persists to database)
  // For following tab, use followingPosts
  // Only use timelinePosts if we have no API posts (fallback for viewer mode)
  const apiPosts = (tab === 'following') 
    ? followingPosts 
    : (posts.length > 0 ? posts : (startTime && allGames.length > 0 ? timelinePosts : posts))
  
  // Combine local posts (optimistic UI) with API posts, deduplicating by ID
  const basePosts = useMemo(() => {
    if (tab !== 'latest') return apiPosts
    
    // Efficient deduplication using Map (O(n) instead of O(n²))
    // Local posts come first to ensure they appear at the top
    const postMap = new Map<string, FeedPost>()
    
    // Add local posts first (they take priority)
    localPosts.forEach(post => postMap.set(post.id, post))
    
    // Add API posts (will not override local posts with same ID)
    apiPosts.forEach(post => {
      if (!postMap.has(post.id)) {
        postMap.set(post.id, post)
      }
    })
    
    // Convert back to array and sort by timestamp
    return Array.from(postMap.values()).sort((a, b) => {
      const aTime = new Date(a.timestamp ?? 0).getTime()
      const bTime = new Date(b.timestamp ?? 0).getTime()
      return bTime - aTime
    })
  }, [tab, localPosts, apiPosts])

  // Removed early loading return to prevent layout shifts - loading state is handled inline

  return (
    <PageContainer noPadding className="flex flex-col w-full !overflow-visible">
      {/* Wrapper for pull-to-refresh ref */}
      <div ref={scrollContainerRef} className="relative flex flex-1">
        {/* Feed area - responsive width and borders */}
        <div className="flex-1 flex flex-col min-w-0 lg:border-l lg:border-r border-[rgba(120,120,120,0.5)]">
          {/* Header with tabs - responsive positioning and padding */}
          <div className="sticky top-0 z-10 bg-background shadow-sm flex-shrink-0">
            <div className="px-3 sm:px-4 lg:px-6">
              <div className="flex items-center justify-between lg:mb-3">
                <FeedToggle activeTab={tab} onTabChange={setTab} />
              </div>
            </div>
          </div>

          {/* Feed content - No internal scroll, let page scroll naturally */}
          <div className="flex-1 bg-background">
            {/* Content wrapper - responsive padding and max-width */}
            <div className="w-full px-4 lg:px-6 lg:max-w-[700px] lg:mx-auto">
              {/* Pull to refresh indicator */}
              <PullToRefreshIndicator
                pullDistance={pullDistance}
                isRefreshing={isRefreshing}
              />
              
              {tab === 'trades' ? (
                // Trades tab - use TradesFeed component
                <TradesFeed containerRef={scrollContainerRefObject} />
              ) : (loading || (tab === 'following' && loadingFollowing)) ? (
                <div className="w-full">
                  <FeedSkeleton count={5} />
                </div>
              ) : basePosts.length === 0 && tab === 'latest' ? (
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
              ) : basePosts.length === 0 && tab === 'following' ? (
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
              ) : basePosts.length === 0 ? (
                // Game loaded but no visible posts yet
                <div className="w-full p-4 sm:p-8 text-center">
                  <div className="text-muted-foreground py-8 sm:py-12">
                    <h2 className="text-lg sm:text-xl font-semibold mb-2 text-foreground">⏱️ No Posts Yet</h2>
                    <p className="mb-4 text-sm sm:text-base">
                      Game tick runs every 60 seconds. Content will appear here as it&apos;s generated.
                    </p>
                  </div>
                </div>
              ) : (
                // Show posts - single implementation
                <div className="w-full space-y-0">
                  {basePosts.map((post, i: number) => {
                    // Handle both FeedPost (from game store) and API post shapes
                    // API posts have authorId, FeedPost has author (both are author IDs)
                    const authorId = ('authorId' in post ? post.authorId : post.author) || ''
                    // Get actual actor name from loaded data, fallback to authorName or ID
                    const authorName = actorNames.get(authorId) || ('authorName' in post ? post.authorName : '') || authorId

                    // Show banner at the random interval (if not dismissed)
                    const showBannerAfterThisPost = !bannerDismissed && i === bannerInterval.current - 1

                    const postData = {
                      id: post.id,
                      type: ('type' in post ? post.type : undefined) || undefined,
                      content: post.content,
                      articleTitle: ('articleTitle' in post ? post.articleTitle : null) || null,
                      byline: ('byline' in post ? post.byline : null) || null,
                      biasScore: ('biasScore' in post ? post.biasScore : null) ?? null,
                      category: ('category' in post ? post.category : null) || null,
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
                      // Repost metadata
                      isRepost: ('isRepost' in post ? post.isRepost : false) || false,
                      originalPostId: ('originalPostId' in post ? post.originalPostId : null) || null,
                      originalAuthorId: ('originalAuthorId' in post ? post.originalAuthorId : null) || null,
                      originalAuthorName: ('originalAuthorName' in post ? post.originalAuthorName : null) || null,
                      originalAuthorUsername: ('originalAuthorUsername' in post ? post.originalAuthorUsername : null) || null,
                      originalAuthorProfileImageUrl: ('originalAuthorProfileImageUrl' in post ? post.originalAuthorProfileImageUrl : null) || null,
                      originalContent: ('originalContent' in post ? post.originalContent : null) || null,
                      quoteComment: ('quoteComment' in post ? post.quoteComment : null) || null,
                    }

                    return (
                      <div key={`post-wrapper-${post.id}-${i}`}>
                        {postData.type && postData.type === 'article' ? (
                          <ArticleCard
                            post={postData}
                            onClick={() => router.push(`/post/${post.id}`)}
                          />
                        ) : (
                          <PostCard
                            post={postData}
                            onClick={() => router.push(`/post/${post.id}`)}
                          />
                        )}
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
        </div>

        {/* Right: Widget panels - only on desktop (xl+) */}
        <WidgetSidebar />
      </div>

      {/* Floating Post Button - Bottom Right */}
      {authenticated && (
        <button
          onClick={() => setShowCreateModal(true)}
          className={cn(
            'fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[100]',
            'flex items-center justify-center gap-2',
            'bg-[#0066FF] hover:bg-[#2952d9]',
            'text-primary-foreground font-semibold',
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
        onPostCreated={(newPost) => {
          // Add post optimistically to the top of the feed
          const optimisticPost: FeedPost = {
            id: newPost.id,
            content: newPost.content,
            author: newPost.authorId,
            authorId: newPost.authorId,
            authorName: newPost.authorName,
            authorUsername: newPost.authorUsername || undefined,
            authorProfileImageUrl: newPost.authorProfileImageUrl || undefined,
            timestamp: newPost.timestamp,
            likeCount: 0,
            commentCount: 0,
            shareCount: 0,
            isLiked: false,
            isShared: false,
          }
          
          setLocalPosts(prev => [optimisticPost, ...prev])
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
