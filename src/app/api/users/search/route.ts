/**
 * API Route: /api/users/search
 * Methods: GET (search for users)
 */

import type { NextRequest } from 'next/server'
import { authenticate } from '@/lib/api/auth-middleware'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger'
import { asUser } from '@/lib/db/context'

/**
 * GET /api/users/search
 * Search for users by username or display name
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await authenticate(request)

  // Get query parameter
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.trim().length < 2) {
    return successResponse({ users: [] })
  }

  const searchTerm = query.trim().toLowerCase()

  // Search for users (excluding the current user and NPCs)
  const users = await asUser(user, async (db) => {
    return await db.user.findMany({
      where: {
        AND: [
          {
            OR: [
              {
                username: {
                  contains: searchTerm,
                  mode: 'insensitive',
                },
              },
              {
                displayName: {
                  contains: searchTerm,
                  mode: 'insensitive',
                },
              },
            ],
          },
          {
            id: {
              not: user.userId, // Exclude current user
            },
          },
          {
            isActor: false, // Exclude NPCs
          },
          {
            isBanned: false, // Exclude banned users
          },
        ],
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        profileImageUrl: true,
        bio: true,
      },
      take: 20, // Limit results
      orderBy: [
        {
          username: 'asc',
        },
      ],
    })
  })

  logger.info('User search completed', { userId: user.userId, query: searchTerm, results: users.length }, 'GET /api/users/search')

  return successResponse({
    users,
  })
})

