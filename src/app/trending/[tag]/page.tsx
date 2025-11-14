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
    <PageContainer noPadding className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
          <div className="max-w-[700px] mx-auto px-4 sm:px-6 py-4">
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

