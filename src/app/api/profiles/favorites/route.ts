/**
 * API Route: /api/profiles/favorites
 * Methods: GET (get user's favorited profiles)
 */

import {
  authenticate,
  successResponse
} from '@/lib/api/auth-middleware';
import { asUser } from '@/lib/db/context';
import { withErrorHandling } from '@/lib/errors/error-handler';
import { logger } from '@/lib/logger';
import { PaginationSchema } from '@/lib/validation/schemas';
import type { NextRequest } from 'next/server';

/**
 * GET /api/profiles/favorites
 * Get list of profiles the authenticated user has favorited
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  // Authenticate user
  const user = await authenticate(request);
  
  // Validate query parameters
  const { searchParams } = new URL(request.url);
  const queryParams = {
    page: searchParams.get('page'),
    limit: searchParams.get('limit')
  };
  PaginationSchema.partial().parse(queryParams);

  // Get favorited profiles with RLS
  const favoritedProfiles = await asUser(user, async (db) => {
    // Get favorited profiles
    const favorites = await db.favorite.findMany({
      where: {
        userId: user.userId,
      },
      include: {
        targetUser: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
            bio: true,
            isActor: true,
            _count: {
              select: {
                favoritedBy: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get post counts for each profile (posts are authored by actor IDs)
    const profiles = await Promise.all(
      favorites.map(async (favorite) => {
        const postCount = await db.post.count({
          where: {
            authorId: favorite.targetUser.id,
          },
        });

        return {
          id: favorite.targetUser.id,
          displayName: favorite.targetUser.displayName,
          username: favorite.targetUser.username,
          profileImageUrl: favorite.targetUser.profileImageUrl,
          bio: favorite.targetUser.bio,
          isActor: favorite.targetUser.isActor,
          postCount,
          favoriteCount: favorite.targetUser._count.favoritedBy,
          favoritedAt: favorite.createdAt,
          isFavorited: true,
        };
      })
    );

    return profiles;
  });

  logger.info('Favorited profiles fetched successfully', { userId: user.userId, count: favoritedProfiles.length }, 'GET /api/profiles/favorites');

  return successResponse({
    profiles: favoritedProfiles,
    total: favoritedProfiles.length,
  });
});
