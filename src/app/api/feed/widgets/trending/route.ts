/**
 * Trending Tags Widget API
 * 
 * GET /api/feed/widgets/trending - Get current trending tags
 */

import { optionalAuth, type AuthenticatedUser } from '@/lib/api/auth-middleware'
import { asPublic, asUser } from '@/lib/db/context'
import { withErrorHandling } from '@/lib/errors/error-handler'
import { getCurrentTrendingTags } from '@/lib/services/tag-storage-service'
import { generateTrendingSummary } from '@/lib/services/trending-summary-service'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export const GET = withErrorHandling(async (request: NextRequest) => {
  // Get trending tags from cache
  const trending = await getCurrentTrendingTags(5)

  if (!trending || trending.length === 0) {
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
            where: { tagId: item.Tag.id },
            include: {
              Post: {
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
            where: { tagId: item.Tag.id },
            include: {
              Post: {
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

      const postContents = recentPosts.map(pt => pt.Post.content)
      
      const summary = await generateTrendingSummary(
        item.Tag.displayName,
        item.Tag.category,
        postContents
      )

      return {
        id: item.id,
        tag: item.Tag.displayName,
        tagSlug: item.Tag.name,
        category: item.Tag.category,
        postCount: item.postCount,
        summary,
        rank: item.rank,
      }
    })
  )

  // Filter out null values
  const validItems = trendingItems.filter((item): item is NonNullable<typeof item> => item !== null)

  return NextResponse.json({
    success: true,
    trending: validItems,
  })
})
