'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, MessageCircle, Heart, Share2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { getProfileUrl } from '@/lib/profile-utils'
import Link from 'next/link'
import { Skeleton } from '@/components/shared/Skeleton'

interface TrendingPost {
  id: string
  content: string
  authorId: string
  authorName: string
  authorUsername?: string | null
  timestamp: string
  likeCount: number
  commentCount: number
  shareCount: number
  trendingScore: number
}

export function TrendingPostsPanel() {
  const [posts, setPosts] = useState<TrendingPost[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchTrendingPosts = async () => {
      const response = await fetch('/api/feed/widgets/trending-posts')
      const data = await response.json()
      if (data.success) {
        setPosts(data.posts || [])
      }
      setLoading(false)
    }

    fetchTrendingPosts()
    // Refresh every 30 seconds
    const interval = setInterval(fetchTrendingPosts, 30000)
    return () => clearInterval(interval)
  }, [])

  const handlePostClick = (postId: string) => {
    // Navigate to feed with post query param to open comments
    router.push(`/feed?post=${postId}`)
  }

  const truncateContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content
    return content.slice(0, maxLength) + '...'
  }

  return (
    <div className="bg-sidebar rounded-lg p-4 flex-1 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-5 h-5 text-[#0066FF]" />
        <h2 className="text-xl font-bold text-foreground">Trending</h2>
      </div>
      {loading ? (
        <div className="space-y-3 flex-1">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-sm text-muted-foreground flex-1">No trending posts at the moment.</div>
      ) : (
        <div className="space-y-3 flex-1">
          {posts.map((post) => {
            const postDate = new Date(post.timestamp)
            const timeAgo = formatDistanceToNow(postDate, { addSuffix: true })

            return (
              <div
                key={post.id}
                onClick={() => handlePostClick(post.id)}
                className="cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
              >
                {/* Author */}
                <div className="flex items-center gap-2 mb-1.5">
                  <Link
                    href={getProfileUrl(post.authorId, post.authorUsername)}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-sm text-foreground hover:underline truncate"
                  >
                    {post.authorName}
                  </Link>
                  <span className="text-xs text-muted-foreground truncate">
                    @{post.authorUsername || post.authorId}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{timeAgo}</span>
                </div>

                {/* Content */}
                <p className="text-sm text-foreground mb-2 line-clamp-2 break-words">
                  {truncateContent(post.content, 120)}
                </p>

                {/* Interaction counts */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    <span>{post.likeCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    <span>{post.commentCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Share2 className="w-3 h-3" />
                    <span>{post.shareCount}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

