/**
 * API Route: /api/posts/[id]
 * Methods: GET (get single post details), DELETE (soft delete post)
 */

import { optionalAuth, authenticate } from '@/lib/api/auth-middleware';
import { asUser, asPublic } from '@/lib/db/context';
import { BusinessLogicError } from '@/lib/errors';
import { successResponse, withErrorHandling } from '@/lib/errors/error-handler';
import { gameService } from '@/lib/game-service';
import { logger } from '@/lib/logger';
import { PostIdParamSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';

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
  // Errors during auth check are non-critical - treat as unauthenticated
  const user = await optionalAuth(request).catch((error) => {
    logger.debug('Optional auth failed for GET post request', { postId, error }, 'GET /api/posts/[id]');
    return null;
  });

  // Get post with RLS - use asPublic for unauthenticated requests
  let post = user
    ? await asUser(user, async (db) => {
    // Try to get post from database first
    return await db.post.findUnique({
      where: { id: postId },
      include: {
        _count: {
          select: {
            Reaction: {
              where: {
                type: 'like',
              },
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
        Share: user
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
            Reaction: {
              where: {
                type: 'like',
              },
            },
            Comment: true,
            Share: true,
          },
        },
        // Empty arrays for unauthenticated users
        Reaction: {
          where: {
            userId: 'never-match', // Won't match any user
            type: 'like',
          },
          select: {
            id: true,
          },
        },
        Share: {
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

        // Parse repost metadata if this is a repost
        const parsedRepostData = gamePost.content ? parseRepostContent(gamePost.content) : null;
        let repostMetadata = {};
        
        const originalPostIdFromGame = 'originalPostId' in gamePost ? (gamePost as Record<string, unknown>).originalPostId as string | undefined : undefined;
        if (parsedRepostData || originalPostIdFromGame) {
          // Try to get original author info
          let originalAuthor = null;
          const originalPostId = originalPostIdFromGame || null;
          let effectiveRepostData = parsedRepostData;
          
          if (parsedRepostData) {
            // Parse from content if available (fallback for old posts)
            originalAuthor = await asPublic(async (db) => {
              const usr = await db.user.findUnique({
                where: { username: parsedRepostData.originalAuthorUsername },
                select: { id: true, username: true, displayName: true, profileImageUrl: true },
              });
              
              if (usr) return usr;
              
              const act = await db.actor.findFirst({
                where: { id: parsedRepostData.originalAuthorUsername },
                select: { id: true, name: true, profileImageUrl: true },
              });
              
              if (act) return act;
              
              const org = await db.organization.findFirst({
                where: { id: parsedRepostData.originalAuthorUsername },
                select: { id: true, name: true, imageUrl: true },
              });
              
              return org;
            });
          }
          
          // If we have originalPostId but no author info yet, fetch from original post
          if (originalPostId && !originalAuthor) {
            const originalPost = await asPublic(async (db) => {
              return await db.post.findUnique({
                where: { id: originalPostId },
                select: { authorId: true, content: true },
              });
            });
            
            if (originalPost) {
              // Fetch author details
              originalAuthor = await asPublic(async (db) => {
                const usr = await db.user.findUnique({
                  where: { id: originalPost.authorId },
                  select: { id: true, username: true, displayName: true, profileImageUrl: true },
                });
                
                if (usr) return usr;
                
                const act = await db.actor.findUnique({
                  where: { id: originalPost.authorId },
                  select: { id: true, name: true, profileImageUrl: true },
                });
                
                if (act) return act;
                
                const org = await db.organization.findUnique({
                  where: { id: originalPost.authorId },
                  select: { id: true, name: true, imageUrl: true },
                });
                
                return org;
              });
              
              // Create repostData with actual original content if not already set
              if (!parsedRepostData && originalAuthor) {
                effectiveRepostData = {
                  isRepost: true,
                  quoteComment: null,
                  originalContent: originalPost.content,
                  originalAuthorUsername: 'username' in originalAuthor ? originalAuthor.username! : originalPost.authorId,
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
              originalAuthorName: 'name' in originalAuthor ? originalAuthor.name : originalAuthor.displayName,
              originalAuthorUsername: 'username' in originalAuthor ? originalAuthor.username : originalAuthor.id,
              originalAuthorProfileImageUrl: 'profileImageUrl' in originalAuthor ? originalAuthor.profileImageUrl : ('imageUrl' in originalAuthor ? originalAuthor.imageUrl : null),
            };
          } else if (effectiveRepostData) {
            // Fallback if we can't find the original author
            repostMetadata = {
              isRepost: true,
              quoteComment: effectiveRepostData.quoteComment,
              originalContent: effectiveRepostData.originalContent,
              originalPostId: originalPostId,
              originalAuthorId: effectiveRepostData.originalAuthorUsername,
              originalAuthorName: effectiveRepostData.originalAuthorUsername,
              originalAuthorUsername: effectiveRepostData.originalAuthorUsername,
              originalAuthorProfileImageUrl: null,
            };
          }
        }

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
            ...repostMetadata, // Add repost metadata if applicable
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
                    Reaction: {
                      where: {
                        type: 'like',
                      },
                    },
                    Comment: true,
                    Share: true,
                  },
                },
                Reaction: {
                  where: {
                    userId: user.userId,
                    type: 'like',
                  },
                  select: {
                    id: true,
                  },
                },
                Share: {
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
                    Reaction: {
                      where: {
                        type: 'like',
                      },
                    },
                    Comment: true,
                    Share: true,
                  },
                },
                Reaction: {
                  where: {
                    userId: 'never-match',
                    type: 'like',
                  },
                  select: {
                    id: true,
                  },
                },
                Share: {
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

    // Check if post is deleted
    if (post.deletedAt) {
      throw new BusinessLogicError('This post has been deleted', 'POST_DELETED');
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
    const reactionsArray = post.Reaction && Array.isArray(post.Reaction) ? post.Reaction : [];
    const sharesArray = post.Share && Array.isArray(post.Share) ? post.Share : [];

    // Parse repost metadata if this is a repost
    const repostData = post.content ? parseRepostContent(post.content) : null;
    let repostMetadata = {};
    
    if (repostData) {
      // Look up original author by username (could be User, Actor, or Organization)
      const originalAuthor = await asPublic(async (db) => {
        const usr = await db.user.findUnique({
          where: { username: repostData.originalAuthorUsername },
          select: { id: true, username: true, displayName: true, profileImageUrl: true },
        });
        
        if (usr) return usr;
        
        const act = await db.actor.findFirst({
          where: { id: repostData.originalAuthorUsername },
          select: { id: true, name: true, profileImageUrl: true },
        });
        
        if (act) return act;
        
        const org = await db.organization.findFirst({
          where: { id: repostData.originalAuthorUsername },
          select: { id: true, name: true, imageUrl: true },
        });
        
        return org;
      });
      
      if (originalAuthor) {
        // Find the Share record for this repost to get the original post ID
        const shareRecord = await asPublic(async (db) => {
          return await db.share.findFirst({
            where: { 
              userId: post.authorId || '',
              Post: {
                authorId: originalAuthor.id
              }
            },
            orderBy: { createdAt: 'desc' },
            select: { postId: true },
          });
        });
        
        let originalPostId = shareRecord?.postId || null;
        
        // If Share lookup failed, try to find the original post by content and author
        if (!originalPostId && repostData.originalContent) {
          const originalPost = await asPublic(async (db) => {
            return await db.post.findFirst({
              where: {
                authorId: originalAuthor.id,
                content: repostData.originalContent,
                deletedAt: null,
              },
              orderBy: { timestamp: 'desc' },
              select: { id: true },
            });
          });
          originalPostId = originalPost?.id || null;
        }
        
        repostMetadata = {
          isRepost: true,
          quoteComment: repostData.quoteComment,
          originalContent: repostData.originalContent,
          originalPostId: originalPostId,
          originalAuthorId: originalAuthor.id,
          originalAuthorName: 'name' in originalAuthor ? originalAuthor.name : originalAuthor.displayName,
          originalAuthorUsername: 'username' in originalAuthor ? originalAuthor.username : originalAuthor.id,
          originalAuthorProfileImageUrl: 'profileImageUrl' in originalAuthor ? originalAuthor.profileImageUrl : ('imageUrl' in originalAuthor ? originalAuthor.imageUrl : null),
        };
      } else {
        // Even if we can't find the original author, still mark as repost
        repostMetadata = {
          isRepost: true,
          quoteComment: repostData.quoteComment,
          originalContent: repostData.originalContent,
          originalPostId: null,
          originalAuthorId: repostData.originalAuthorUsername,
          originalAuthorName: repostData.originalAuthorUsername,
          originalAuthorUsername: repostData.originalAuthorUsername,
          originalAuthorProfileImageUrl: null,
        };
      }
    }

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
        likeCount: post._count?.Reaction ?? 0,
        commentCount: post._count?.Comment ?? 0,
        shareCount: post._count?.Share ?? 0,
        isLiked: reactionsArray.length > 0,
        isShared: sharesArray.length > 0,
        source: 'database',
        ...repostMetadata, // Add repost metadata if applicable
      },
    });
});

/**
 * DELETE /api/posts/[id]
 * Soft delete a post (mark as deleted)
 */
export const DELETE = withErrorHandling(async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) => {
  const { id: postId } = PostIdParamSchema.parse(await context.params);
  
  // Require authentication (throws error if not authenticated)
  const user = await authenticate(request);
  
  // Get the post to check ownership
  const post = await asUser(user, async (db) => {
    return await db.post.findUnique({
      where: { id: postId },
      select: { id: true, authorId: true, deletedAt: true },
    });
  });
  
  if (!post) {
    throw new BusinessLogicError('Post not found', 'POST_NOT_FOUND');
  }
  
  // Check if post is already deleted
  if (post.deletedAt) {
    throw new BusinessLogicError('Post already deleted', 'POST_ALREADY_DELETED');
  }
  
  // Check if user is the author of the post
  if (post.authorId !== user.userId) {
    throw new BusinessLogicError('Unauthorized to delete this post', 'UNAUTHORIZED');
  }
  
  // Soft delete the post by setting deletedAt timestamp
  await asUser(user, async (db) => {
    await db.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
  });
  
  logger.info('Post soft deleted', { postId, userId: user.userId }, 'DELETE /api/posts/[id]');
  
  return successResponse({
    message: 'Post deleted successfully',
    data: { id: postId, deletedAt: new Date().toISOString() },
  });
});


