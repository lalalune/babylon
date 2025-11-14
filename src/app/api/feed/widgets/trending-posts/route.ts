/**
 * API Route: /api/feed/widgets/trending-posts
 * Returns trending posts based on engagement (likes, comments, shares) and recency
 */

import type { NextRequest } from 'next/server'
import { optionalAuth } from '@/lib/api/auth-middleware'
import { asUser, asPublic } from '@/lib/db/context'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { TrendingPostsQuerySchema } from '@/lib/validation/schemas'
import { logger } from '@/lib/logger'
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

/**
 * Calculate trending score for a post
 * Formula: (likes * 2 + comments * 3 + shares * 4) * recency_factor
 * Recency factor: 1.0 for posts < 1 hour old, decreasing by 0.1 per hour, min 0.1
 */
function calculateTrendingScore(
  likeCount: number,
  commentCount: number,
  shareCount: number,
  timestamp: Date
): number {
  const now = Date.now()
  const postTime = new Date(timestamp).getTime()
  const hoursAgo = (now - postTime) / (1000 * 60 * 60)

  // Recency factor: 1.0 for < 1 hour, decreases by 0.1 per hour, min 0.1
  const recencyFactor = Math.max(0.1, 1.0 - hoursAgo * 0.1)

  // Engagement score: weighted by interaction type importance
  const engagementScore = likeCount * 2 + commentCount * 3 + shareCount * 4

  return engagementScore * recencyFactor
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Validate query parameters
  const { searchParams } = new URL(request.url)
  const queryParams = {
    limit: searchParams.get('limit') || '10',
    timeframe: searchParams.get('timeframe') || '24h',
    minInteractions: searchParams.get('minInteractions') || '5'
  }
  TrendingPostsQuerySchema.parse(queryParams)
  // Get recent posts from last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Optional auth - trending posts are public but RLS still applies
  const authUser = await optionalAuth(request).catch(() => null)

  // Get posts, interactions, and users with RLS
  const { posts, allReactions, allComments, allShares, users } = (authUser && authUser.userId)
    ? await asUser(authUser, async (db) => {
    const postsList = await db.post.findMany({
      where: {
        timestamp: {
          gte: oneDayAgo,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 100, // Get more posts to calculate trending from
    })

    if (postsList.length === 0) {
      return { posts: [], allReactions: [], allComments: [], allShares: [], users: [] }
    }

    // Get interaction counts for all posts
    const postIds = postsList.map((p) => p.id)
    const [reactions, comments, shares] = await Promise.all([
      db.reaction.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds }, type: 'like' },
        _count: { postId: true },
      }),
      db.comment.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { postId: true },
      }),
      db.share.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { postId: true },
      }),
    ])

    // Get user data for posts
    const authorIds = [...new Set(postsList.map((p) => p.authorId))]
    const usersList = await db.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, username: true, displayName: true },
    })

    return { posts: postsList, allReactions: reactions, allComments: comments, allShares: shares, users: usersList }
  })
    : await asPublic(async (db) => {
    const postsList = await db.post.findMany({
      where: {
        timestamp: {
          gte: oneDayAgo,
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 100, // Get more posts to calculate trending from
    })

    if (postsList.length === 0) {
      return { posts: [], allReactions: [], allComments: [], allShares: [], users: [] }
    }

    // Get interaction counts for all posts
    const postIds = postsList.map((p) => p.id)
    const [reactions, comments, shares] = await Promise.all([
      db.reaction.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds }, type: 'like' },
        _count: { postId: true },
      }),
      db.comment.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { postId: true },
      }),
      db.share.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { postId: true },
      }),
    ])

    // Get user data for posts
    const authorIds = [...new Set(postsList.map((p) => p.authorId))]
    const usersList = await db.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, username: true, displayName: true },
    })

    return { posts: postsList, allReactions: reactions, allComments: comments, allShares: shares, users: usersList }
  })

  if (posts.length === 0) {
    return successResponse({
      posts: [],
    })
  }

  // Create maps for quick lookup
  const reactionMap = new Map(allReactions.map((r) => [r.postId, r._count.postId]))
  const commentMap = new Map(allComments.map((c) => [c.postId, c._count.postId]))
  const shareMap = new Map(allShares.map((s) => [s.postId, s._count.postId]))
  const userMap = new Map(users.map((u) => [u.id, u]))

  // Calculate trending scores and format posts
  const trendingPosts: TrendingPost[] = posts
      .map((post) => {
        const likeCount = reactionMap.get(post.id) ?? 0
        const commentCount = commentMap.get(post.id) ?? 0
        const shareCount = shareMap.get(post.id) ?? 0

        const trendingScore = calculateTrendingScore(
          likeCount,
          commentCount,
          shareCount,
          post.timestamp
        )

        const user = userMap.get(post.authorId)

        return {
          id: post.id,
          content: post.content,
          authorId: post.authorId,
          authorName: user?.displayName || user?.username || post.authorId,
          authorUsername: user?.username || null,
          timestamp: post.timestamp.toISOString(),
          likeCount,
          commentCount,
          shareCount,
          trendingScore,
        }
      })
      .filter((post) => post.trendingScore > 0) // Only include posts with some engagement
      .sort((a, b) => b.trendingScore - a.trendingScore) // Sort by trending score descending
      .slice(0, 5) // Top 5 trending posts

  logger.info('Trending posts fetched successfully', { count: trendingPosts.length }, 'GET /api/feed/widgets/trending-posts')

  return successResponse({
    posts: trendingPosts,
  })
});


