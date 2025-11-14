/**
 * Registry API Route
 *
 * Fetches all registered users/agents from the database
 * Supports filtering and sorting
 */

import type { NextRequest } from 'next/server'
import { optionalAuth } from '@/lib/api/auth-middleware'
import { asUser, asPublic } from '@/lib/db/context'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { RegistryQuerySchema } from '@/lib/validation/schemas'
import { ReputationService } from '@/lib/services/reputation-service'
import { logger } from '@/lib/logger'
import type { PrismaClient } from '@prisma/client'
/**
 * GET /api/registry
 * Fetch all registered users with optional filtering
 */
export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url)

  // Parse and validate query parameters
  const queryParams = {
    onChainOnly: searchParams.get('onChainOnly'),
    sortBy: searchParams.get('sortBy'),
    sortOrder: searchParams.get('sortOrder'),
    limit: searchParams.get('limit'),
    offset: searchParams.get('offset')
  }
  const filters = RegistryQuerySchema.parse(queryParams)

  // Optional auth - registry is public but RLS still applies
  const authUser = await optionalAuth(request).catch(() => null)

  // Build where clause
  const where = filters.onChainOnly ? { onChainRegistered: true } : {}

  // Build order by clause
  const orderBy = filters.sortBy ? {
    [filters.sortBy]: filters.sortOrder,
  } : { createdAt: 'desc' as const }

  // Fetch users from database with RLS (public registry, no auth required)
  const dbOperation = async (db: PrismaClient) => {
    const usersList = await db.user.findMany({
      where,
      orderBy,
      take: filters.limit,
      skip: filters.offset,
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profileImageUrl: true,
        walletAddress: true,
        isActor: true,
        onChainRegistered: true,
        nftTokenId: true,
        registrationTxHash: true,
        createdAt: true,
        virtualBalance: true,
        lifetimePnL: true,
        // Include relationship counts
        _count: {
          select: {
            positions: true,
            comments: true,
            reactions: true,
          },
        },
      },
    })

    // Get total count for pagination
    const count = await db.user.count({ where })

    return { users: usersList, totalCount: count }
  }

  const { users, totalCount } = (authUser && authUser.userId)
    ? await asUser(authUser, dbOperation)
    : await asPublic(dbOperation)

  const usersWithReputation = await Promise.all(
    users.map(async (user) => {
      let reputation: number | null = null
      if (user.onChainRegistered && user.nftTokenId) {
        reputation = await ReputationService.getOnChainReputation(user.id)
      }

      return {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
        walletAddress: user.walletAddress,
        isActor: user.isActor,
        onChainRegistered: user.onChainRegistered,
        nftTokenId: user.nftTokenId,
        registrationTxHash: user.registrationTxHash,
        createdAt: user.createdAt,
        virtualBalance: user.virtualBalance.toString(),
        lifetimePnL: user.lifetimePnL.toString(),
        reputation,
        stats: {
          positions: user._count.positions,
          comments: user._count.comments,
          reactions: user._count.reactions,
        },
      }
    })
  )

  logger.info('Registry fetched successfully', {
    total: totalCount,
    returned: usersWithReputation.length,
    onChainOnly: filters.onChainOnly
  }, 'GET /api/registry')

  return successResponse({
    users: usersWithReputation,
    pagination: {
      total: totalCount,
      limit: filters.limit || 100,
      offset: filters.offset || 0,
      hasMore: (filters.offset || 0) + users.length < totalCount,
    },
  })
})
