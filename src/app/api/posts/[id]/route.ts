/**
 * API Route: /api/posts/[id]
 * Methods: GET (get single post details)
 */

import { optionalAuth } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { BusinessLogicError } from '@/lib/errors';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { gameService } from '@/lib/game-service';
import { logger } from '@/lib/logger';
import { PostIdParamSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';

/**
 * GET /api/posts/[id]
 * Get a single post by ID
 */
export const GET = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: postId } = PostIdParamSchema.parse(await context.params);

  // Optional authentication (to show liked status for logged-in users)
  const user = await optionalAuth(request).catch(() => null);

  // Get post with RLS - use asPublic for unauthenticated requests
  let post = user
    ? await asUser(user, async (db) => {
    // Try to get post from database first
    return await db.post.findUnique({
      where: { id: postId },
      include: {
        _count: {
          select: {
            reactions: {
              where: {
                type: 'like',
              },
            },
            comments: true,
            shares: true,
          },
        },
        reactions: user
          ? {
              where: {
                userId: user.userId,
                type: 'like',
              },
              select: {
                id: true,
              },
            }
          : {
              where: {
                userId: 'never-match',
                type: 'like',
              },
              select: {
                id: true,
              },
            },
        shares: user
          ? {
              where: {
                userId: user.userId,
              },
              select: {
                id: true,
              },
            }
          : {
              where: {
                userId: 'never-match',
              },
              select: {
                id: true,
              },
            },
      },
    })
  })
    : await asPublic(async (db) => {
    // Try to get post from database first (public access)
    return await db.post.findUnique({
      where: { id: postId },
      include: {
        _count: {
          select: {
            reactions: {
              where: {
                type: 'like',
              },
            },
            comments: true,
            shares: true,
          },
        },
        // Empty arrays for unauthenticated users
        reactions: {
          where: {
            userId: 'never-match', // Won't match any user
            type: 'like',
          },
          select: {
            id: true,
          },
        },
        shares: {
          where: {
            userId: 'never-match', // Won't match any user
          },
          select: {
            id: true,
          },
        },
      },
    })
  });

    // If not in database, try to find it in game store/realtime feed first
    if (!post) {
      // Try realtime posts first (most recent)
      const realtimeResult = await gameService.getRealtimePosts(1000, 0);
      const realtimePost = realtimeResult?.posts.find(p => p.id === postId);
      
      let gamePost = realtimePost;
      
      // If not found in realtime, try database posts (synced posts)
      if (!gamePost) {
        const dbPosts = await gameService.getRecentPosts(1000, 0);
        const foundPost = dbPosts.find(p => p.id === postId);
        if (foundPost) {
          gamePost = {
            ...foundPost,
            author: foundPost.authorId,
            timestamp: foundPost.timestamp instanceof Date ? foundPost.timestamp.toISOString() : foundPost.timestamp,
            createdAt: foundPost.createdAt instanceof Date ? foundPost.createdAt.toISOString() : foundPost.createdAt,
          } as typeof realtimePost;
        }
      }

      // If found in game store, return it directly
      if (gamePost) {
        // Get public data (counts and author info) - doesn't require user authentication
        const [likeCount, commentCount, shareCount, actor, userRecord] = await asPublic(async (db) => {
          const [likes, comments, shares] = await Promise.all([
            db.reaction.count({ where: { postId, type: 'like' } }),
            db.comment.count({ where: { postId } }),
            db.share.count({ where: { postId } }),
          ]);

          const act = await db.actor.findUnique({
            where: { id: gamePost.authorId },
            select: { name: true },
          });

          const usr = await db.user.findUnique({
            where: { id: gamePost.authorId },
            select: { displayName: true, username: true },
          });

          return [likes, comments, shares, act, usr];
        });

        let authorName = gamePost.authorId;
        let authorUsername: string | null = null;
        
        if (actor) {
          authorName = actor.name;
        } else if (userRecord) {
          authorName = userRecord.displayName || userRecord.username || gamePost.authorId;
          authorUsername = userRecord.username;
        }

        // Get user-specific interaction state (requires authentication)
        const [isLiked, isShared] = user
          ? await asUser(user, async (db) => {
              const liked = (await db.reaction.findFirst({
                where: { postId, userId: user.userId, type: 'like' },
              })) !== null;
              const shared = (await db.share.findFirst({
                where: { postId, userId: user.userId },
              })) !== null;
              return [liked, shared];
            })
          : [false, false];

        const timestampStr = gamePost.timestamp as string;
        const createdAtStr = (gamePost.createdAt || timestampStr) as string;

        return successResponse({
          data: {
            id: gamePost.id,
            type: 'post',
            content: gamePost.content,
            fullContent: null,
            articleTitle: null,
            byline: null,
            biasScore: null,
            sentiment: null,
            slant: null,
            category: null,
            authorId: gamePost.authorId,
            authorName,
            authorUsername,
            authorAvatar: undefined,
            isActorPost: true,
            timestamp: timestampStr,
            createdAt: createdAtStr,
            likeCount,
            commentCount,
            shareCount,
            isLiked,
            isShared,
            source: 'game-store',
          },
        });
      }

      let authorId = 'system';
      let gameId = 'babylon';
      let timestamp = new Date();

      const isoTimestampMatch = postId.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)$/);

      if (isoTimestampMatch?.[1]) {
        const timestampStr = isoTimestampMatch[1];
        timestamp = new Date(timestampStr);
        const firstHyphenIndex = postId.indexOf('-');
        if (firstHyphenIndex !== -1) {
          gameId = postId.substring(0, firstHyphenIndex);
          const withoutGameId = postId.substring(firstHyphenIndex + 1);
          const secondHyphenIndex = withoutGameId.indexOf('-');
          if (secondHyphenIndex !== -1) {
            const afterGameTimestamp = withoutGameId.substring(secondHyphenIndex + 1);
            authorId = afterGameTimestamp.substring(0, afterGameTimestamp.lastIndexOf('-' + timestampStr));
          }
        }
      } else if (postId.startsWith('post-')) {
        const parts = postId.split('-');
        if (parts.length >= 3 && parts[1]) {
          const timestampNum = parseInt(parts[1], 10);
          if (!isNaN(timestampNum) && timestampNum > 1000000000000) {
            timestamp = new Date(timestampNum);
            if (parts.length >= 4 && parts[2] && !parts[2].includes('.')) {
              const potentialActorId = parts[2];
              const actor = await asPublic(async (db) => {
                return await db.actor.findUnique({
                  where: { id: potentialActorId },
                  select: { id: true },
                });
              });
              if (actor) {
                authorId = potentialActorId;
              }
            }
          }
        }
      }

      // Upsert post - use appropriate context based on authentication
      post = user
        ? await asUser(user, async (db) => {
            return await db.post.upsert({
              where: { id: postId },
              update: {},
              create: {
                id: postId,
                content: '[Game-generated post]',
                authorId,
                gameId,
                timestamp,
              },
              include: {
                _count: {
                  select: {
                    reactions: {
                      where: {
                        type: 'like',
                      },
                    },
                    comments: true,
                    shares: true,
                  },
                },
                reactions: {
                  where: {
                    userId: user.userId,
                    type: 'like',
                  },
                  select: {
                    id: true,
                  },
                },
                shares: {
                  where: {
                    userId: user.userId,
                  },
                  select: {
                    id: true,
                  },
                },
              },
            });
          })
        : await asPublic(async (db) => {
            return await db.post.upsert({
              where: { id: postId },
              update: {},
              create: {
                id: postId,
                content: '[Game-generated post]',
                authorId,
                gameId,
                timestamp,
              },
              include: {
                _count: {
                  select: {
                    reactions: {
                      where: {
                        type: 'like',
                      },
                    },
                    comments: true,
                    shares: true,
                  },
                },
                reactions: {
                  where: {
                    userId: 'never-match',
                    type: 'like',
                  },
                  select: {
                    id: true,
                  },
                },
                shares: {
                  where: {
                    userId: 'never-match',
                  },
                  select: {
                    id: true,
                  },
                },
              },
            });
          });
    }

    if (!post) {
      throw new BusinessLogicError('Post not found', 'POST_NOT_FOUND');
    }

    // Get author info - public data, doesn't require user authentication
    const { authorName, authorUsername, authorProfileImageUrl } = await asPublic(async (db) => {
      let name = post.authorId;
      let username: string | null = null;
      let profileImageUrl: string | null = null;
      
      const actor = await db.actor.findUnique({
        where: { id: post.authorId },
        select: { id: true, name: true, profileImageUrl: true },
      });
      if (actor) {
        name = actor.name;
        // Use database profileImageUrl or construct path from actor ID
        profileImageUrl = actor.profileImageUrl || `/images/actors/${actor.id}.jpg`;
      } else {
        // Check if it's an organization (for articles)
        const org = await db.organization.findUnique({
          where: { id: post.authorId },
          select: { id: true, name: true, imageUrl: true },
        });
        if (org) {
          name = org.name;
          // Use database imageUrl or construct path from organization ID
          profileImageUrl = org.imageUrl || `/images/organizations/${org.id}.jpg`;
        } else {
          const usr = await db.user.findUnique({
            where: { id: post.authorId },
            select: { displayName: true, username: true, profileImageUrl: true },
          });
          if (usr) {
            name = usr.displayName || usr.username || post.authorId;
            username = usr.username || null;
            profileImageUrl = usr.profileImageUrl || null;
          }
        }
      }
      return { authorName: name, authorUsername: username, authorProfileImageUrl: profileImageUrl };
    });

    // Return database post
    // Safely check reactions and shares - Prisma may return undefined even when included
    const reactionsArray = post.reactions && Array.isArray(post.reactions) ? post.reactions : [];
    const sharesArray = post.shares && Array.isArray(post.shares) ? post.shares : [];

    logger.info('Post fetched successfully', { postId, source: 'database' }, 'GET /api/posts/[id]');

    return successResponse({
      data: {
        id: post.id,
        type: post.type || 'post',
        content: post.content,
        fullContent: post.fullContent || null,
        articleTitle: post.articleTitle || null,
        byline: post.byline || null,
        biasScore: post.biasScore !== undefined ? post.biasScore : null,
        sentiment: post.sentiment || null,
        slant: post.slant || null,
        category: post.category || null,
        authorId: post.authorId,
        authorName: authorName,
        authorUsername: authorUsername,
        authorProfileImageUrl: authorProfileImageUrl,
        authorAvatar: authorProfileImageUrl || undefined,
        isActorPost: true, // Posts are from game actors
        timestamp: post.timestamp ? post.timestamp.toISOString() : post.createdAt.toISOString(),
        createdAt: post.createdAt.toISOString(),
        likeCount: post._count?.reactions ?? 0,
        commentCount: post._count?.comments ?? 0,
        shareCount: post._count?.shares ?? 0,
        isLiked: reactionsArray.length > 0,
        isShared: sharesArray.length > 0,
        source: 'database',
      },
    });
});

