/**
 * Trending Tags Widget API
 * 
 * GET /api/feed/widgets/trending - Get current trending tags
 */

import type { NextRequest } from 'next/server'
import { optionalAuth, type AuthenticatedUser } from '@/lib/api/auth-middleware'
import { asUser, asPublic } from '@/lib/db/context'
import { getCurrentTrendingTags } from '@/lib/services/tag-storage-service'
import { generateTrendingSummary } from '@/lib/services/trending-summary-service'
import { NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const trending = await getCurrentTrendingTags(5)

  // If no trending data exists yet (first load), return placeholder
  if (trending.length === 0) {
    return NextResponse.json({
      success: true,
      trending: [],
      message: 'No trending data yet - check back after first game tick',
    })
  }

  // Optional auth - trending tags are public but RLS still applies
  const authUser: AuthenticatedUser | null = await optionalAuth(request).catch(() => null)

  const trendingItems = await Promise.all(
    trending.map(async (item) => {
      const recentPosts = (authUser && authUser.userId)
        ? await asUser(authUser, async (db) => {
          return await db.postTag.findMany({
            where: { tagId: item.tag.id },
            include: {
              post: {
                select: {
                  content: true,
                },
              },
            },
            take: 3,
            orderBy: {
              createdAt: 'desc',
            },
          })
        })
        : await asPublic(async (db) => {
          return await db.postTag.findMany({
            where: { tagId: item.tag.id },
            include: {
              post: {
                select: {
                  content: true,
                },
              },
            },
            take: 3,
            orderBy: {
              createdAt: 'desc',
            },
          })
        })

      const postContents = recentPosts.map(pt => pt.post.content)
      
      const summary = await generateTrendingSummary(
        item.tag.displayName,
        item.tag.category,
        postContents
      )

      return {
        id: item.id,
        tag: item.tag.displayName,
        tagSlug: item.tag.name,
        category: item.tag.category,
        postCount: item.postCount,
        summary,
        rank: item.rank,
      }
    })
  )

  return NextResponse.json({
    success: true,
    trending: trendingItems,
  })
}

