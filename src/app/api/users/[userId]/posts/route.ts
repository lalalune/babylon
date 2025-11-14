/**
 * API Route: /api/users/[userId]/posts
 * Methods: GET (get user posts and comments/replies)
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/database-service';
import { optionalAuth } from '@/lib/api/auth-middleware';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { UserIdParamSchema, UserPostsQuerySchema } from '@/lib/validation/schemas';
import { logger } from '@/lib/logger';
import { findUserByIdentifier } from '@/lib/users/user-lookup';

/**
 * GET /api/users/[userId]/posts
 * Get user's posts and comments/replies
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) => {
  const params = await context.params;
  const { userId } = UserIdParamSchema.parse(params);
  const targetUser = await findUserByIdentifier(userId, { id: true });
  
  // If user doesn't exist yet (new Privy user), return empty data
  if (!targetUser) {
    logger.info('User not found - returning empty data (may be new Privy user)', { userId }, 'GET /api/users/[userId]/posts');
    return successResponse({
      items: [],
      total: 0,
      type: 'posts',
    });
  }
  
  const canonicalUserId = targetUser.id;
  
  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    type: searchParams.get('type') || 'posts',
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  };
  const { type } = UserPostsQuerySchema.parse(queryParams);

  // Optional authentication
  const user = await optionalAuth(request);

    if (type === 'replies') {
      // Get user's comments (replies) - query by authorId
      const comments = await prisma.comment.findMany({
        where: {
          authorId: canonicalUserId,
        },
        include: {
          Post: {
            select: {
              id: true,
              content: true,
              authorId: true,
              timestamp: true,
            },
          },
          _count: {
            select: {
              Reaction: {
                where: { type: 'like' },
              },
              other_Comment: true,
            },
          },
          Reaction: user
            ? {
                where: {
                  userId: user.userId,
                  type: 'like',
                },
                select: { id: true },
              }
            : false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      });

      // Get unique post author IDs to fetch author info
      const postAuthorIds = [...new Set(comments.map(c => c.Post.authorId))];
      
      // Fetch User and Actor info for post authors
      const [postAuthorsUsers, postAuthorsActors] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: postAuthorIds } },
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
          },
        }),
        prisma.actor.findMany({
          where: { id: { in: postAuthorIds } },
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        }),
      ]);
      
      // Create author lookup maps
      const userAuthorsMap = new Map(postAuthorsUsers.map(u => [u.id, u]));
      const actorAuthorsMap = new Map(postAuthorsActors.map(a => [a.id, a]));
      
      // Format comments as replies
      const replies = comments.map((comment) => {
        const authorUser = userAuthorsMap.get(comment.Post.authorId);
        const authorActor = actorAuthorsMap.get(comment.Post.authorId);
        
        return {
          id: comment.id,
          content: comment.content,
          postId: comment.postId,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          likeCount: comment._count.Reaction,
          replyCount: comment._count.other_Comment,
          isLiked: comment.Reaction.length > 0,
          post: {
            id: comment.Post.id,
            content: comment.Post.content,
            authorId: comment.Post.authorId,
            timestamp: comment.Post.timestamp.toISOString(),
            author: authorUser
              ? {
                  id: authorUser.id,
                  displayName: authorUser.displayName,
                  username: authorUser.username,
                  profileImageUrl: authorUser.profileImageUrl,
                }
              : authorActor
                ? {
                    id: authorActor.id,
                    displayName: authorActor.name,
                    username: null,
                    profileImageUrl: authorActor.profileImageUrl,
                  }
                : null,
          },
        };
      });

      logger.info('User replies fetched successfully', { userId: canonicalUserId, total: replies.length }, 'GET /api/users/[userId]/posts');

      return successResponse({
        type: 'replies',
        items: replies,
        total: replies.length,
      });
    } else {
      // Get user's posts
      const posts = await prisma.post.findMany({
        where: {
          authorId: canonicalUserId,
          deletedAt: null, // Filter out deleted posts
          // Exclude reposts (posts with replyTo field will be handled separately)
        },
        include: {
          _count: {
            select: {
              Reaction: {
                where: { type: 'like' },
              },
              Comment: true,
              Share: true,
            },
          },
          Reaction: user
            ? {
                where: {
                  userId: user.userId,
                  type: 'like',
                },
                select: { id: true },
              }
            : false,
          Share: user
            ? {
                where: {
                  userId: user.userId,
                },
                select: { id: true },
              }
            : false,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: 100,
      });

      // Also get user's shares (reposts)
      const shares = await prisma.share.findMany({
        where: {
          userId: canonicalUserId,
        },
        include: {
          Post: {
            select: {
              id: true,
              content: true,
              authorId: true,
              timestamp: true,
              _count: {
                select: {
                  Reaction: {
                    where: { type: 'like' },
                  },
                  Comment: true,
                  Share: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 100,
      });

      // Fetch author info for the user (posts are all from userId)
      const postAuthor = await prisma.user.findUnique({
        where: { id: canonicalUserId },
        select: {
          id: true,
          displayName: true,
          username: true,
          profileImageUrl: true,
        },
      });
      
      // Get unique author IDs from shared posts
      const sharedPostAuthorIds = [...new Set(shares.map(s => s.Post.authorId))];
      
      // Fetch User, Actor, and Organization info for shared post authors
      const [sharedAuthorsUsers, sharedAuthorsActors, sharedAuthorsOrgs] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: sharedPostAuthorIds } },
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
          },
        }),
        prisma.actor.findMany({
          where: { id: { in: sharedPostAuthorIds } },
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
          },
        }),
        prisma.organization.findMany({
          where: { id: { in: sharedPostAuthorIds } },
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        }),
      ]);
      
      // Create author lookup maps
      const userAuthorsMap = new Map(sharedAuthorsUsers.map(u => [u.id, u]));
      const actorAuthorsMap = new Map(sharedAuthorsActors.map(a => [a.id, a]));
      const orgAuthorsMap = new Map(sharedAuthorsOrgs.map(o => [o.id, o]));
      
      // Format posts
      const formattedPosts = posts.map((post) => ({
        id: post.id,
        content: post.content,
        authorId: post.authorId,
        timestamp: post.timestamp.toISOString(),
        createdAt: post.createdAt.toISOString(),
        likeCount: post._count.Reaction,
        commentCount: post._count.Comment,
        shareCount: post._count.Share,
        isLiked: post.Reaction.length > 0,
        isShared: post.Share.length > 0,
        author: postAuthor
          ? {
              id: postAuthor.id,
              displayName: postAuthor.displayName,
              username: postAuthor.username,
              profileImageUrl: postAuthor.profileImageUrl,
            }
          : null,
      }));

      // Format shares as reposts
      const reposts = shares.map((share) => {
        const authorUser = userAuthorsMap.get(share.Post.authorId);
        const authorActor = actorAuthorsMap.get(share.Post.authorId);
        const authorOrg = orgAuthorsMap.get(share.Post.authorId);
        
        return {
          id: `share-${share.id}`,
          content: share.Post.content,
          authorId: share.Post.authorId,
          timestamp: share.createdAt.toISOString(),
          createdAt: share.createdAt.toISOString(),
          likeCount: share.Post._count.Reaction,
          commentCount: share.Post._count.Comment,
          shareCount: share.Post._count.Share,
          isLiked: false, // Could check if user liked original post
          isShared: true,
          isRepost: true,
          originalPostId: share.Post.id,
          author: authorUser
            ? {
                id: authorUser.id,
                displayName: authorUser.displayName,
                username: authorUser.username,
                profileImageUrl: authorUser.profileImageUrl,
              }
            : authorActor
              ? {
                  id: authorActor.id,
                  displayName: authorActor.name,
                  username: null,
                  profileImageUrl: authorActor.profileImageUrl,
                }
              : authorOrg
              ? {
                  id: authorOrg.id,
                  displayName: authorOrg.name,
                  username: null,
                  profileImageUrl: authorOrg.imageUrl,
                }
              : null,
        };
      });

      // Combine and sort by timestamp
      const allItems = [...formattedPosts, ...reposts].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      logger.info('User posts fetched successfully', { userId: canonicalUserId, total: allItems.length }, 'GET /api/users/[userId]/posts');

      return successResponse({
        type: 'posts',
        items: allItems,
        total: allItems.length,
      });
    }
});
