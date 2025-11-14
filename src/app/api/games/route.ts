/**
 * Games API Route
 *
 * GET /api/games - Get all games
 */

import type { NextRequest } from 'next/server'
import { gameService } from '@/lib/game-service';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger';

export const GET = withErrorHandling(async (_request: NextRequest) => {
  const games = await gameService.getAllGames();

  logger.info('Games fetched successfully', { count: games.length }, 'GET /api/games')

  return successResponse({
    success: true,
    games,
    count: games.length,
  });
})

