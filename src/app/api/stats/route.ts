/**
 * Stats API Route
 *
 * GET /api/stats - Get database stats
 */

import type { NextRequest } from 'next/server'
import { gameService } from '@/lib/game-service';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler'
import { logger } from '@/lib/logger';

export const GET = withErrorHandling(async (_request: NextRequest) => {
  const stats = await gameService.getStats();
  const status = await gameService.getStatus();

  logger.info('Stats fetched successfully', { stats, engineStatus: status }, 'GET /api/stats')

  return successResponse({
    success: true,
    stats,
    engineStatus: status,
  });
})

