'use client'

import { logger } from '@/lib/logger'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageContainer } from '@/components/shared/PageContainer'
import { PostCard } from '@/components/posts/PostCard'
import { ArrowLeft } from 'lucide-react'
interface PostData {
  id: string
  content: string
  authorId: string
  authorName: string
  authorUsername?: string | null
  authorProfileImageUrl?: string | null
  timestamp: string
  likeCount?: number
  commentCount?: number
  shareCount?: number
  isLiked?: boolean
  isShared?: boolean
}

const PAGE_SIZE = 20

export default function TrendingTagPage() {
  const params = useParams()
  const router = useRouter()
  const tag = params.tag as string
  const [posts, setPosts] = useState<PostData[]>([])
  const [loading, setLoading] = useState(true)
  const [tagInfo, setTagInfo] = useState<{
    name: string
    displayName: string
    category?: string | null
  } | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchPosts = useCallback(async (requestOffset: number, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)

    const response = await fetch(
      `/api/trending/${encodeURIComponent(tag)}?limit=${PAGE_SIZE}&offset=${requestOffset}`
    )
    
    if (!response.ok) {
      if (response.status === 404) {
        logger.warn('Tag not found', { tag }, 'TrendingTagPage')
      }
      if (append) setHasMore(false)
      if (append) setLoadingMore(false)
      else setLoading(false)
      return
    }

    const data = await response.json()
    
    if (data.success) {
      if (!append && data.tag) {
        setTagInfo(data.tag)
      }

      const newPosts = data.posts || []
      
      setPosts(prev => {
        const combined = append ? [...prev, ...newPosts] : newPosts
        const unique = new Map<string, PostData>()
        combined.forEach((post: PostData) => {
          if (post?.id) {
            unique.set(post.id, post)
          }
        })
        
        const deduped = Array.from(unique.values()).sort((a, b) => {
          const aTime = new Date(a.timestamp ?? 0).getTime()
          const bTime = new Date(b.timestamp ?? 0).getTime()
          return bTime - aTime
        })
        
        return deduped
      })

      setOffset(requestOffset + newPosts.length)
      
      const moreAvailable = newPosts.length === PAGE_SIZE
      setHasMore(moreAvailable)
    }
    if (append) setLoadingMore(false)
    else setLoading(false)
  }, [tag])

  useEffect(() => {
    setOffset(0)
    setHasMore(true)
    fetchPosts(0, false)
  }, [tag, fetchPosts])

  const handleLoadMore = () => {
    if (!loading && !loadingMore && hasMore) {
      fetchPosts(offset, true)
    }
  }

  return (
    <PageContainer noPadding className="flex flex-col min-h-screen w-full overflow-visible">
      {/* Mobile/Tablet: Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 shrink-0 lg:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            {tagInfo ? (
              <>
                <h1 className="text-2xl font-bold">{tagInfo.displayName}</h1>
                {tagInfo.category && (
                  <p className="text-sm text-muted-foreground">
                    {tagInfo.category} · Trending
                  </p>
                )}
              </>
            ) : (
              <h1 className="text-2xl font-bold">{decodeURIComponent(tag)}</h1>
            )}
          </div>
        </div>
      </div>

      {/* Desktop: Multi-column layout with sidebar */}
      <div className="hidden lg:flex flex-1 min-h-0">
        {/* Left: Feed area */}
        <div className="flex-1 flex flex-col min-w-0 border-l border-r border-[rgba(120,120,120,0.5)]">
          {/* Desktop Header */}
          <div className="sticky top-0 z-10 bg-background shadow-sm shrink-0">
            <div className="px-6 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  {tagInfo ? (
                    <>
                      <h1 className="text-2xl font-bold">{tagInfo.displayName}</h1>
                      {tagInfo.category && (
                        <p className="text-sm text-muted-foreground">
                          {tagInfo.category} · Trending
                        </p>
                      )}
                    </>
                  ) : (
                    <h1 className="text-2xl font-bold">{decodeURIComponent(tag)}</h1>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Feed content - Scrollable */}
          <div className="flex-1 bg-background overflow-y-auto overflow-x-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading posts...</div>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">No posts found</h2>
                  <p className="text-muted-foreground">
                    No posts have been tagged with &quot;{tagInfo?.displayName || tag}&quot; yet.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-feed mx-auto px-6 py-4 space-y-0">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onClick={() => router.push(`/post/${post.id}`)}
                  />
                ))}
                
                {hasMore && (
                  <div className="py-4 text-center">
                    {loadingMore ? (
                      <div className="text-sm text-muted-foreground">
                        Loading more posts...
                      </div>
                    ) : (
                      <button
                        onClick={handleLoadMore}
                        className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                      >
                        Load More
                      </button>
                    )}
                  </div>
                )}
                
                {!hasMore && posts.length > 0 && (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    You&apos;re all caught up.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile/Tablet: Content */}
      <div className="flex lg:hidden flex-1 overflow-y-auto overflow-x-hidden bg-background w-full">
        {loading ? (
          <div className="flex items-center justify-center py-12 w-full">
            <div className="text-muted-foreground">Loading posts...</div>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex items-center justify-center py-12 w-full">
            <div className="text-center px-4">
              <h2 className="text-xl font-semibold mb-2">No posts found</h2>
              <p className="text-muted-foreground">
                No posts have been tagged with &quot;{tagInfo?.displayName || tag}&quot; yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full px-4 py-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onClick={() => router.push(`/post/${post.id}`)}
              />
            ))}
            
            {hasMore && (
              <div className="py-4 text-center">
                {loadingMore ? (
                  <div className="text-sm text-muted-foreground">
                    Loading more posts...
                  </div>
                ) : (
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Load More
                  </button>
                )}
              </div>
            )}
            
            {!hasMore && posts.length > 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                You&apos;re all caught up.
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}

