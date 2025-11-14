/**
 * Posts Feed API
 * 
 * @route GET /api/posts - Get posts feed
 * @route POST /api/posts - Create new post
 * @access GET: Public, POST: Authenticated
 * 
 * @description
 * Core API for the social feed system. Handles post retrieval with advanced
 * filtering, caching, and repost detection. POST creates new posts with
 * mention notifications, rate limiting, and real-time SSE broadcasting.
 * 
 * **GET - Retrieve Posts Feed**
 * 
 * Returns paginated posts with comprehensive metadata including:
 * - Author details (users, agents/actors, organizations)
 * - Interaction counts (likes, comments, shares)
 * - Repost metadata with original post tracking
 * - Following feed filtering
 * - Post type filtering (articles, standard posts)
 * 
 * **Query Parameters:**
 * @query {number} limit - Posts per page (default: 100, max recommended: 100)
 * @query {number} offset - Pagination offset (default: 0)
 * @query {string} actorId - Filter by specific actor/agent
 * @query {boolean} following - Show only followed users' posts
 * @query {string} userId - Required with following=true
 * @query {string} type - Filter by post type ('article', 'post', etc.)
 * 
 * **Caching Strategy:**
 * - Recent posts cached for 60s
 * - Following feeds cached for 120s
 * - Actor-specific posts cached per actor
 * - Cache invalidation on new post creation
 * 
 * **Repost Detection:**
 * Automatically parses repost content format:
 * ```
 * [Quote comment]
 *
 * --- Reposted from @originalAuthor ---
 * [Original content]
 * ```
 * 
 * @returns {object} Posts feed response
 * @property {boolean} success - Operation success
 * @property {array} posts - Array of post objects with metadata
 * @property {number} limit - Applied limit
 * @property {number} offset - Applied offset
 * @property {string} source - Feed source ('following' or undefined)
 * 
 * **POST - Create New Post**
 * 
 * Creates a new post with automatic processing:
 * - Content validation (max 280 characters)
 * - Rate limiting (prevents spam)
 * - Duplicate detection
 * - Mention extraction and notification (@username)
 * - Real-time SSE broadcast to feed subscribers
 * - Cache invalidation
 * - PostHog analytics tracking
 * 
 * @param {string} content - Post content (required, 1-280 chars)
 * 
 * @returns {object} Created post
 * @property {boolean} success - Operation success
 * @property {object} post - Created post with author details
 * 
 * @throws {400} Invalid content (empty, too long, duplicate, rate limited)
 * @throws {401} Unauthorized - authentication required
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Get recent posts
 * const feed = await fetch('/api/posts?limit=20&offset=0');
 * const { posts } = await feed.json();
 * 
 * // Get following feed
 * const following = await fetch(`/api/posts?following=true&userId=${userId}&limit=50`);
 * 
 * // Get actor's posts
 * const actorPosts = await fetch(`/api/posts?actorId=${actorId}`);
 * 
 * // Create post
 * const response = await fetch('/api/posts', {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     content: 'Hello @friend, check this out!'
 *   })
 * });
 * ```
 * 
 * @see {@link /lib/cached-database-service} Caching layer
 * @see {@link /lib/sse/event-broadcaster} Real-time broadcasts
 * @see {@link /lib/services/notification-service} Mention notifications
 * @see {@link /src/components/feed} Feed UI components
 */

import { authenticate, successResponse } from '@/lib/api/auth-middleware';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { getCacheOrFetch } from '@/lib/cache-service';
import { cachedDb } from '@/lib/cached-database-service';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import { broadcastToChannel } from '@/lib/sse/event-broadcaster';
import { ensureUserForAuth } from '@/lib/users/ensure-user';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { trackServerEvent } from '@/lib/posthog/server';
import { checkRateLimitAndDuplicates, RATE_LIMIT_CONFIGS, DUPLICATE_DETECTION_CONFIGS } from '@/lib/rate-limiting';
import { notifyMention } from '@/lib/services/notification-service';

/**
 * Safely convert a date value to ISO string
 * Handles Date objects, strings, and null/undefined
 */
function toISOStringSafe(date: Date | string | null | undefined): string {
  if (!date) {
    return new Date().toISOString();
  }
  if (date instanceof Date) {
    return date.toISOString();
  }
  if (typeof date === 'string') {
    // If it's already an ISO string, return it
    if (date.includes('T') && date.includes('Z')) {
      return date;
    }
    // Try to parse and convert
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  // Fallback to current date
  return new Date().toISOString();
}

/**
 * Parse repost content to extract metadata
 * Returns null if not a repost, otherwise returns parsed data
 */
function parseRepostContent(content: string): {
  isRepost: true;
  quoteComment: string | null;
  originalContent: string;
  originalAuthorUsername: string;
} | null {
  const separatorPattern = /\n\n--- Reposted from @(.+?) ---\n/;
  const match = content.match(separatorPattern);
  
  if (!match) return null;
  
  const parts = content.split(separatorPattern);
  const quoteComment = parts[0]?.trim() || null;
  const originalContent = parts[2]?.trim() || '';
  const originalAuthorUsername = match[1] || '';
  
  return {
    isRepost: true,
    quoteComment,
    originalContent,
    originalAuthorUsername,
  };
}

export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')
  const actorId = searchParams.get('actorId') || undefined
  const following = searchParams.get('following') === 'true'
  const userId = searchParams.get('userId') || undefined
  const type = searchParams.get('type') || undefined

    // If following feed is requested, filter by followed users/actors
    if (following && userId) {
      // Cache key for user's follows
      const followsCacheKey = `follows:${userId}`;
      
      // Get list of followed users/actors with caching
      const allFollowedIds = await getCacheOrFetch(
        followsCacheKey,
        async () => {
          const [userFollows, actorFollows, legacyActorFollows] = await Promise.all([
            prisma.follow.findMany({
              where: { followerId: userId },
              select: { followingId: true },
            }),
            prisma.userActorFollow.findMany({
              where: { userId: userId },
              select: { actorId: true },
            }),
            prisma.followStatus.findMany({
              where: { 
                userId: userId, 
                isActive: true,
                followReason: 'user_followed',
              },
              select: { npcId: true },
            }),
          ]);

          const followedUserIds = userFollows.map((f) => f.followingId);
          const followedActorIds = new Set<string>();
          actorFollows.forEach((f) => followedActorIds.add(f.actorId));
          legacyActorFollows.forEach((f) => followedActorIds.add(f.npcId));
          return [...followedUserIds, ...Array.from(followedActorIds)];
        },
        {
          namespace: 'user:follows',
          ttl: 120, // Cache follows for 2 minutes
        }
      );

      if (allFollowedIds.length === 0) {
        // User is not following anyone
        return NextResponse.json({
          success: true,
          posts: [],
          total: 0,
          limit,
          offset,
          source: 'following',
        });
      }

      // Get posts from followed users/actors with caching
      const posts = await cachedDb.getPostsForFollowing(
        userId,
        allFollowedIds,
        limit,
        offset
      );

      // Get user data for posts
      const authorIds = [...new Set(posts.map(p => p.authorId).filter((id): id is string => id !== undefined))];
      const users = await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, username: true, displayName: true },
      });
      const userMap = new Map(users.map(u => [u.id, u]));
      
      // Get interaction counts for all posts in parallel
      const postIds = posts.map(p => p.id);
      const [allReactions, allComments] = await Promise.all([
        prisma.reaction.groupBy({
          by: ['postId'],
          where: { postId: { in: postIds }, type: 'like' },
          _count: { postId: true },
        }),
        prisma.comment.groupBy({
          by: ['postId'],
          where: { postId: { in: postIds } },
          _count: { postId: true },
        }),
      ]);
      
      // Create maps for quick lookup
      const reactionMap = new Map(allReactions.map(r => [r.postId, r._count.postId]));
      const commentMap = new Map(allComments.map(c => [c.postId, c._count.postId]));
      
      // OPTIMIZED: Batch repost metadata lookups to avoid N+1
      // First, identify all reposts and extract original usernames
      const repostDataMap = new Map<string, ReturnType<typeof parseRepostContent>>();
      const originalUsernames = new Set<string>();
      
      for (const post of posts) {
        const repostData = parseRepostContent(post.content || '');
        if (repostData) {
          repostDataMap.set(post.id, repostData);
          originalUsernames.add(repostData.originalAuthorUsername);
        }
      }

      // Batch lookup original authors (users and actors)
      const originalAuthorsMap = new Map<string, { id: string; name: string; username: string; profileImageUrl: string | null }>();
      
      if (originalUsernames.size > 0) {
        const usernameArray = Array.from(originalUsernames);
        const [originalUsers, originalActors] = await Promise.all([
          prisma.user.findMany({
            where: { username: { in: usernameArray } },
            select: { id: true, username: true, displayName: true, profileImageUrl: true },
          }),
          prisma.actor.findMany({
            where: { id: { in: usernameArray } },
            select: { id: true, name: true, profileImageUrl: true },
          }),
        ]);

        // Map users
        for (const user of originalUsers) {
          originalAuthorsMap.set(user.username!, {
            id: user.id,
            name: user.displayName || user.username || user.id,
            username: user.username!,
            profileImageUrl: user.profileImageUrl,
          });
        }

        // Map actors
        for (const actor of originalActors) {
          originalAuthorsMap.set(actor.id, {
            id: actor.id,
            name: actor.name,
            username: actor.id,
            profileImageUrl: actor.profileImageUrl,
          });
        }

        // Batch lookup share records for all reposters
        const reposterIds = posts.filter(p => repostDataMap.has(p.id)).map(p => p.authorId).filter((id): id is string => !!id);
        const shareRecords = await prisma.share.findMany({
          where: { userId: { in: reposterIds } },
          select: { postId: true, userId: true },
          orderBy: { createdAt: 'desc' },
        });

        const shareMap = new Map(shareRecords.map(s => [s.userId, s.postId]));

        // Build repost metadata lookup
        const repostMetadataMap = new Map<string, Record<string, unknown>>();
        for (const [postId, repostData] of repostDataMap.entries()) {
          if (!repostData) continue; // Skip null entries
          
          const originalAuthor = originalAuthorsMap.get(repostData.originalAuthorUsername);
          const post = posts.find(p => p.id === postId);
          const shareRecord = post?.authorId ? shareMap.get(post.authorId) : undefined;

          if (originalAuthor) {
            repostMetadataMap.set(postId, {
              isRepost: true,
              quoteComment: repostData.quoteComment,
              originalContent: repostData.originalContent,
              originalPostId: shareRecord ?? null,
              originalAuthorId: originalAuthor.id,
              originalAuthorName: originalAuthor.name,
              originalAuthorUsername: originalAuthor.username,
              originalAuthorProfileImageUrl: originalAuthor.profileImageUrl,
            });
          } else {
            repostMetadataMap.set(postId, {
              isRepost: true,
              quoteComment: repostData.quoteComment,
              originalContent: repostData.originalContent,
              originalPostId: null,
              originalAuthorId: repostData.originalAuthorUsername,
              originalAuthorName: repostData.originalAuthorUsername,
              originalAuthorUsername: repostData.originalAuthorUsername,
              originalAuthorProfileImageUrl: null,
            });
          }
        }

        // Format following posts synchronously using lookup maps
        const formattedFollowingPosts = posts.map((post) => {
          const user = post.authorId ? userMap.get(post.authorId) : undefined;
          const repostMetadata = repostMetadataMap.get(post.id) || {};
          
          return {
            id: post.id,
            content: post.content,
            author: post.authorId,
            authorId: post.authorId,
            authorName: user?.displayName || user?.username || post.authorId || 'Unknown',
            authorUsername: user?.username || null,
            timestamp: toISOStringSafe(post.timestamp),
            createdAt: toISOStringSafe(post.createdAt),
            likeCount: reactionMap.get(post.id) ?? 0,
            commentCount: commentMap.get(post.id) ?? 0,
            shareCount: 0, // Share count not currently tracked in feed
            isLiked: false,
            isShared: false,
            ...repostMetadata,
          };
        });
        
        return NextResponse.json({
          success: true,
          posts: formattedFollowingPosts,
          limit,
          offset,
          source: 'following',
        });
      }
    }
    // Get posts from database with caching
    let posts;
    
    logger.info('Fetching posts from database (with cache)', { limit, offset, actorId, type, hasActorId: !!actorId, hasType: !!type }, 'GET /api/posts');
    
    if (type) {
      // Filter by type (e.g., 'article')
      logger.info('Filtering posts by type', { type, limit, offset }, 'GET /api/posts');
      posts = await prisma.post.findMany({
        where: { 
          type,
          deletedAt: null, // Filter out deleted posts
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      });
      logger.info('Fetched posts by type', { type, count: posts.length }, 'GET /api/posts');
    } else if (actorId) {
      // Get posts by specific actor (cached)
      posts = await cachedDb.getPostsByActor(actorId, limit);
      logger.info('Fetched posts by actor (cached)', { actorId, count: posts.length }, 'GET /api/posts');
    } else {
      // Get recent posts from database (cached)
      posts = await cachedDb.getRecentPosts(limit, offset);
      logger.info('Fetched recent posts (cached)', { count: posts.length, limit, offset }, 'GET /api/posts');
    }
    
    // Log post structure for debugging
    if (posts.length > 0) {
      const samplePost = posts[0];
      if (samplePost) {
        logger.debug('Sample post structure', {
          id: samplePost.id,
          hasTimestamp: !!samplePost.timestamp,
          timestampType: typeof samplePost.timestamp,
          timestampValue: samplePost.timestamp,
          hasCreatedAt: !!samplePost.createdAt,
          createdAtType: typeof samplePost.createdAt,
          createdAtValue: samplePost.createdAt,
        }, 'GET /api/posts');
      }
    }
    
    // Get unique author IDs to fetch author data (users, actors, or organizations)
    const authorIds = [...new Set(posts.map(p => p.authorId).filter((id): id is string => id !== undefined))];
    const [users, actors, organizations] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, username: true, displayName: true, profileImageUrl: true },
      }),
      prisma.actor.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, profileImageUrl: true },
      }),
      prisma.organization.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, imageUrl: true },
      }),
    ]);
    const userMap = new Map(users.map(u => [u.id, u]));
    const actorMap = new Map(actors.map(a => [a.id, a]));
    const orgMap = new Map(organizations.map(o => [o.id, o]));
    
    // Get interaction counts for all posts in parallel
    const postIds = posts.map(p => p.id);
    const [allReactions, allComments, allShares] = await Promise.all([
      prisma.reaction.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds }, type: 'like' },
        _count: { postId: true },
      }),
      prisma.comment.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { postId: true },
      }),
      prisma.share.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { postId: true },
      }),
    ]);
    
    // Create maps for quick lookup
    const reactionMap = new Map(allReactions.map(r => [r.postId, r._count.postId]));
    const commentMap = new Map(allComments.map(c => [c.postId, c._count.postId]));
    const shareMap = new Map(allShares.map(s => [s.postId, s._count.postId]));
    
    const formattedPosts = await Promise.all(posts.map(async (post) => {
      logger.warn('Invalid post structure detected', { post }, 'GET /api/posts')

      const user = userMap.get(post.authorId!)
      const actor = actorMap.get(post.authorId!)
      const org = orgMap.get(post.authorId!)
      
      let authorName = post.authorId!
      let authorUsername: string | null = null
      let authorProfileImageUrl: string | null = null
      
      if (actor) {
        authorName = actor.name
        authorProfileImageUrl = actor.profileImageUrl!
      } else if (org) {
        authorName = org.name
        authorProfileImageUrl = org.imageUrl!
      } else if (user) {
        authorName = user.displayName!
        authorUsername = user.username!
        authorProfileImageUrl = user.profileImageUrl
      }
      
      const timestamp = toISOStringSafe(post.timestamp)
      const createdAt = toISOStringSafe(post.createdAt)
      
      // Check if this is a repost by parsing content or checking originalPostId field
      const parsedRepostData = parseRepostContent(post.content!)
      let repostMetadata = {}
      
      if (parsedRepostData || post.originalPostId) {
        // Try to get original author info
        let originalAuthor = null
        const originalPostId = post.originalPostId || null
        let effectiveRepostData = parsedRepostData
        
        if (parsedRepostData) {
          // Parse from content if available (fallback for old posts)
          originalAuthor = await prisma.user.findUnique({
            where: { username: parsedRepostData.originalAuthorUsername },
            select: { id: true, username: true, displayName: true, profileImageUrl: true },
          }) || await prisma.actor.findFirst({
            where: { id: parsedRepostData.originalAuthorUsername },
            select: { id: true, name: true, profileImageUrl: true },
          }) || await prisma.organization.findFirst({
            where: { id: parsedRepostData.originalAuthorUsername },
            select: { id: true, name: true, imageUrl: true },
          })
        }
        
        // If we have originalPostId but no author info yet, fetch from original post
        if (originalPostId && !originalAuthor) {
          const originalPost = await prisma.post.findUnique({
            where: { id: originalPostId },
            select: { authorId: true, content: true },
          })
          
          if (originalPost) {
            // Fetch author details
            const [user, actor, org] = await Promise.all([
              prisma.user.findUnique({
                where: { id: originalPost.authorId },
                select: { id: true, username: true, displayName: true, profileImageUrl: true },
              }),
              prisma.actor.findUnique({
                where: { id: originalPost.authorId },
                select: { id: true, name: true, profileImageUrl: true },
              }),
              prisma.organization.findUnique({
                where: { id: originalPost.authorId },
                select: { id: true, name: true, imageUrl: true },
              }),
            ])
            
            originalAuthor = user || actor || org
            
            // Create repostData with actual original content if not already set
            if (!effectiveRepostData || !effectiveRepostData.originalContent) {
              effectiveRepostData = {
                ...(effectiveRepostData || {}),
                isRepost: true,
                quoteComment: effectiveRepostData?.quoteComment ?? null,
                originalContent: originalPost.content,
                originalAuthorUsername: user?.username || originalPost.authorId,
              };
            }
          }
        }
        
        if (originalAuthor && effectiveRepostData) {
          repostMetadata = {
            isRepost: true,
            quoteComment: effectiveRepostData.quoteComment,
            originalContent: effectiveRepostData.originalContent,
            originalPostId: originalPostId,
            originalAuthorId: originalAuthor.id,
            originalAuthorName: 'name' in originalAuthor ? originalAuthor.name : originalAuthor.displayName!,
            originalAuthorUsername: 'username' in originalAuthor ? originalAuthor.username! : originalAuthor.id,
            originalAuthorProfileImageUrl: 'imageUrl' in originalAuthor ? originalAuthor.imageUrl : originalAuthor.profileImageUrl,
          }
        }
      }
      
      return {
        id: post.id,
        type: post.type || undefined,
        content: post.content!,
        fullContent: post.fullContent || undefined,
        articleTitle: post.articleTitle || undefined,
        byline: post.byline || undefined,
        biasScore: post.biasScore !== undefined ? post.biasScore : undefined,
        sentiment: post.sentiment || undefined,
        slant: post.slant || undefined,
        category: post.category || undefined,
        author: post.authorId,
        authorId: post.authorId,
        authorName,
        authorUsername,
        authorProfileImageUrl,
        timestamp,
        createdAt,
        gameId: post.gameId || undefined,
        dayNumber: post.dayNumber || undefined,
        likeCount: reactionMap.get(post.id) ?? 0,
        commentCount: commentMap.get(post.id) ?? 0,
        shareCount: shareMap.get(post.id) ?? 0,
        isLiked: false,
        isShared: false,
        ...repostMetadata,
      }

      logger.error('Error formatting post', { postId: post?.id, post }, 'GET /api/posts')
    }))
    
    logger.info('Formatted posts', { 
      originalCount: posts.length, 
      formattedCount: formattedPosts.length,
      filteredOut: posts.length - formattedPosts.length 
    }, 'GET /api/posts');
    
    // Next.js 16: Add cache headers for real-time feeds
    // Use 'no-store' to ensure fresh data for real-time updates
    // This prevents stale data in client-side caches
    logger.info('Returning formatted posts', { 
      postCount: formattedPosts.length,
      total: formattedPosts.length,
      limit,
      offset 
    }, 'GET /api/posts');
    
    const response = NextResponse.json({
      success: true,
      posts: formattedPosts,
      limit,
      offset,
    });
    
    // Real-time feeds should not be cached (no-store)
    // This ensures WebSocket updates reflect immediately
  response.headers.set('Cache-Control', 'no-store, must-revalidate')
  
  return response
})

/**
 * POST /api/posts - Create a new post
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const authUser = await authenticate(request)

  const body = await request.json()
  const { content } = body

  checkRateLimitAndDuplicates(
    authUser.userId,
    content,
    RATE_LIMIT_CONFIGS.CREATE_POST,
    DUPLICATE_DETECTION_CONFIGS.POST
  )

  const fallbackDisplayName = authUser.walletAddress
    ? `${authUser.walletAddress.slice(0, 6)}...${authUser.walletAddress.slice(-4)}`
    : 'Anonymous'

  const { user: canonicalUser } = await ensureUserForAuth(authUser, {
    displayName: fallbackDisplayName,
  })
  const canonicalUserId = canonicalUser.id

  const post = await prisma.post.create({
    data: {
      id: await generateSnowflakeId(),
      content: content.trim(),
      authorId: canonicalUserId,
      timestamp: new Date(),
    },
    include: {
      Comment: false,
      Reaction: false,
      Share: false,
    },
  })

  const authorName = canonicalUser.username!

  await cachedDb.invalidatePostsCache()
  await cachedDb.invalidateActorPostsCache(canonicalUserId)
  logger.info('Invalidated post caches', { postId: post.id }, 'POST /api/posts')

  broadcastToChannel('feed', {
    type: 'new_post',
    post: {
      id: post.id,
      content: post.content,
      authorId: post.authorId,
      authorName: authorName,
      authorUsername: canonicalUser.username,
      authorDisplayName: canonicalUser.displayName,
      authorProfileImageUrl: canonicalUser.profileImageUrl,
      timestamp: post.timestamp.toISOString(),
    },
  })
  logger.info('Broadcast new user post to feed channel', { postId: post.id }, 'POST /api/posts')

  const mentions = content.match(/@(\w+)/g)!
  const usernames = [...new Set(mentions.map((m: string) => m.substring(1)))]
  
  const mentionedUsers = await prisma.user.findMany({
    where: {
      username: { in: usernames as string[] },
    },
    select: { id: true, username: true },
  })

  await Promise.all(
    mentionedUsers.map(mentionedUser =>
      notifyMention(
        mentionedUser.id,
        canonicalUserId,
        post.id,
        undefined
      )
    )
  )

  logger.info('Sent mention notifications', { 
    postId: post.id, 
    mentionCount: mentionedUsers.length,
    mentionedUsernames: mentionedUsers.map(u => u.username!)
  }, 'POST /api/posts')

  trackServerEvent(canonicalUserId, 'post_created', {
    postId: post.id,
    contentLength: content.trim().length,
    hasUsername: Boolean(canonicalUser.username),
  })

  return successResponse({
    success: true,
    post: {
      id: post.id,
      content: post.content,
      authorId: post.authorId,
      authorName: authorName,
      authorUsername: canonicalUser.username,
      authorDisplayName: canonicalUser.displayName,
      authorProfileImageUrl: canonicalUser.profileImageUrl,
      timestamp: post.timestamp.toISOString(),
      createdAt: post.createdAt.toISOString(),
    },
  })
});
