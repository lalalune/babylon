/**
 * Trending Tag Detail API
 * 
 * GET /api/trending/[tag] - Get posts with a specific tag
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'
import { optionalAuth } from '@/lib/api/auth-middleware'
import { asUser, asPublic } from '@/lib/db/context'
import { getPostsByTag } from '@/lib/services/tag-storage-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  const { tag } = await params
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  if (!tag) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tag parameter is required',
      },
      { status: 400 }
    )
  }

  const result = await getPostsByTag(tag, { limit, offset })

  if (!result.tag) {
    return NextResponse.json(
      {
        success: false,
        error: 'Tag not found',
        posts: [],
        total: 0,
      },
      { status: 404 }
    )
  }

    // Optional auth - trending posts are public but RLS still applies
    const authUser = await optionalAuth(request).catch(() => null)

    // Enrich posts with author information and engagement stats with RLS
    const enrichedPosts = await Promise.all(
      result.posts.map(async (post) => {
        // Get author info (could be User, Actor, or Organization)
        const [user, actor, org, likeCount, commentCount, shareCount, userLike, userShare] = (authUser && authUser.userId)
          ? await asUser(authUser, async (db) => {
              return await Promise.all([
                db.user.findUnique({
                  where: { id: post.authorId },
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    profileImageUrl: true,
                    isActor: true,
                  },
                }),
                db.actor.findUnique({
                  where: { id: post.authorId },
                  select: {
                    id: true,
                    name: true,
                    profileImageUrl: true,
                  },
                }),
                db.organization.findUnique({
                  where: { id: post.authorId },
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                  },
                }),
                db.reaction.count({
                  where: { postId: post.id, type: 'like' },
                }),
                db.comment.count({
                  where: { postId: post.id },
                }),
                db.share.count({
                  where: { postId: post.id },
                }),
                db.reaction.findFirst({
                  where: { postId: post.id, userId: authUser.userId, type: 'like' },
                  select: { id: true },
                }),
                db.share.findFirst({
                  where: { postId: post.id, userId: authUser.userId },
                  select: { id: true },
                }),
              ])
            })
          : await asPublic(async (db) => {
              return await Promise.all([
                db.user.findUnique({
                  where: { id: post.authorId },
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    profileImageUrl: true,
                    isActor: true,
                  },
                }),
                db.actor.findUnique({
                  where: { id: post.authorId },
                  select: {
                    id: true,
                    name: true,
                    profileImageUrl: true,
                  },
                }),
                db.organization.findUnique({
                  where: { id: post.authorId },
                  select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                  },
                }),
                db.reaction.count({
                  where: { postId: post.id, type: 'like' },
                }),
                db.comment.count({
                  where: { postId: post.id },
                }),
                db.share.count({
                  where: { postId: post.id },
                }),
                null, // No user context for public requests
                null, // No user context for public requests
              ])
            })

        // Determine author info
        const authorName = user?.displayName || user?.username || actor?.name || org?.name || 'Unknown'
        const authorUsername = user?.username || null
        const authorProfileImageUrl = user?.profileImageUrl || actor?.profileImageUrl || org?.imageUrl || null

        return {
          id: post.id,
          content: post.content,
          authorId: post.authorId,
          authorName,
          authorUsername,
          authorProfileImageUrl,
          timestamp: post.timestamp.toISOString(),
          likeCount,
          commentCount,
          shareCount,
          isLiked: !!userLike,
          isShared: !!userShare,
        }
      })
    )

  return NextResponse.json({
    success: true,
    tag: {
      name: result.tag.name,
      displayName: result.tag.displayName,
      category: result.tag.category,
    },
    posts: enrichedPosts,
    total: result.total,
  })
}

