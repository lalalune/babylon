/**
 * API Route: /api/game-assets
 * Methods: GET (get game assets including groupChats)
 *
 * Vercel-compatible: Reads from public directory via HTTP or returns from database
 */

import type { NextRequest } from 'next/server'
import { optionalAuth } from '@/lib/api/auth-middleware'
import { asUser, asPublic } from '@/lib/db/context'
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger';

export const GET = withErrorHandling(async (_request: NextRequest) => {
  // Optional auth - game assets are public but RLS still applies
  const authUser = await optionalAuth(_request).catch(() => null)

  // Get group chats from database with RLS
  const groupChats = (authUser && authUser.userId)
    ? await asUser(authUser, async (db) => {
        return await db.chat.findMany({
        where: {
          isGroup: true,
          gameId: 'continuous',
        },
        select: {
          id: true,
          name: true,
          // Map to expected format
        },
      })
      })
    : await asPublic(async (db) => {
        return await db.chat.findMany({
        where: {
          isGroup: true,
          gameId: 'continuous',
        },
        select: {
          id: true,
          name: true,
          // Map to expected format
        },
      })
      })

  // If you need additional game assets, store them in database or
  // have the client fetch from /data/actors.json directly (public folder)
  const assets = {
    groupChats: groupChats.map(chat => ({
      id: chat.id,
      name: chat.name,
    })),
  };

  logger.info('Game assets fetched successfully', { groupChatsCount: groupChats.length }, 'GET /api/game-assets')

  return successResponse({
    success: true,
    assets,
  });
})
