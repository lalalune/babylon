/**
 * Game Assets API
 * 
 * @route GET /api/game-assets
 * @access Public (optional authentication for RLS)
 * 
 * @description
 * Returns game assets including group chats, actors, and other game-related
 * data needed for client-side game initialization. Designed for Vercel
 * serverless deployment where file system access is limited.
 * 
 * **Assets Included:**
 * - **Group Chats:** All game-related group chat rooms
 *   - ID and name for each chat
 *   - Associated with continuous game
 *   - Used for multi-player discussions
 * 
 * **Optional Authentication:**
 * - If authenticated: Returns assets with RLS (Row-Level Security) applied
 * - If unauthenticated: Returns public game assets
 * 
 * **Vercel Compatibility:**
 * Assets are fetched from database rather than filesystem to support
 * serverless deployments. Static assets (actors data, etc.) should be
 * fetched directly from the public directory by clients.
 * 
 * **Client Integration:**
 * ```typescript
 * // Fetch additional static assets directly
 * const actors = await fetch('/data/actors-full.json').then(r => r.json());
 * const questions = await fetch('/data/questions.json').then(r => r.json());
 * // Or use the API endpoint
 * const actors = await fetch('/api/actors').then(r => r.json());
 * ```
 * 
 * @returns {object} Game assets
 * @property {boolean} success - Operation success
 * @property {object} assets - Game assets object
 * @property {array} assets.groupChats - Array of group chat objects
 * 
 * **Group Chat Object:**
 * @property {string} id - Chat ID
 * @property {string} name - Chat name/title
 * 
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Get game assets (public)
 * const response = await fetch('/api/game-assets');
 * const { assets } = await response.json();
 * 
 * // Display group chats
 * assets.groupChats.forEach(chat => {
 *   console.log(`Chat: ${chat.name} (${chat.id})`);
 * });
 * 
 * // Combine with static assets
 * const [gameAssets, actors] = await Promise.all([
 *   fetch('/api/game-assets').then(r => r.json()),
 *   fetch('/data/actors-full.json').then(r => r.json())
 * ]);
 * ```
 * 
 * **Authenticated Access:**
 * ```typescript
 * // With authentication
 * const response = await fetch('/api/game-assets', {
 *   headers: { 'Authorization': `Bearer ${token}` }
 * });
 * // Returns assets visible to authenticated user (RLS applied)
 * ```
 * 
 * @see {@link /lib/db/context} Database context with RLS
 * @see {@link /public/data/actors-full.json} Static actor data (generated)
 * @see {@link /public/data/README.md} Actor data structure documentation
 * @see {@link /api/games} Games listing endpoint
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
  // have the client fetch from /data/actors-full.json or /api/actors directly
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
