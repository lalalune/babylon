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
        User_Favorite_targetUserIdToUser: {
          select: {
            id: true,
            displayName: true,
            username: true,
            profileImageUrl: true,
            bio: true,
            isActor: true,
            _count: {
              select: {
                Favorite_Favorite_targetUserIdToUser: true,
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
            authorId: favorite.User_Favorite_targetUserIdToUser.id,
          },
        });

        return {
          id: favorite.User_Favorite_targetUserIdToUser.id,
          displayName: favorite.User_Favorite_targetUserIdToUser.displayName,
          username: favorite.User_Favorite_targetUserIdToUser.username,
          profileImageUrl: favorite.User_Favorite_targetUserIdToUser.profileImageUrl,
          bio: favorite.User_Favorite_targetUserIdToUser.bio,
          isActor: favorite.User_Favorite_targetUserIdToUser.isActor,
          postCount,
          favoriteCount: favorite.User_Favorite_targetUserIdToUser._count.Favorite_Favorite_targetUserIdToUser,
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
