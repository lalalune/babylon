/**
 * Game Control API Route
 * 
 * POST /api/game/control - Start or pause the game
 */

import type { NextRequest } from 'next/server';
import { asSystem } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { BadRequestError, AuthorizationError } from '@/lib/errors';
import { logger } from '@/lib/logger';

interface ControlRequest {
  action: 'start' | 'pause';
}

export const POST = withErrorHandling(async (request: NextRequest) => {
  // Check for admin authorization
  const adminToken = request.headers.get('x-admin-token');
  const hasAdminSecret = !!process.env.ADMIN_TOKEN;
  const isAdmin = hasAdminSecret && adminToken === process.env.ADMIN_TOKEN;
  const isDev = process.env.NODE_ENV === 'development';

  if (!isAdmin && !isDev) {
    throw new AuthorizationError('Admin authorization required', 'game', 'control');
  }

  const body = await request.json() as ControlRequest;
  const { action } = body;

  if (!action || !['start', 'pause'].includes(action)) {
    throw new BadRequestError('Action must be "start" or "pause"');
  }

  // Get or create the continuous game - system operation (admin)
  const game = await asSystem(async (db) => {
    let gameState = await db.game.findFirst({
      where: { isContinuous: true },
    });

    if (!gameState) {
      // Create the game if it doesn't exist
      gameState = await db.game.create({
        data: {
          isContinuous: true,
          isRunning: action === 'start',
          currentDay: 1,
          startedAt: action === 'start' ? new Date() : null,
        },
      });
      logger.info(`Game created and ${action === 'start' ? 'started' : 'paused'}`, { gameId: gameState.id }, 'Game Control');
    } else {
      // Update the existing game
      const isRunning = action === 'start';
      const updateData: {
        isRunning: boolean;
        startedAt?: Date;
        pausedAt?: Date;
      } = {
        isRunning,
      };

      if (action === 'start') {
        updateData.startedAt = gameState.startedAt || new Date();
        updateData.pausedAt = undefined;
      } else {
        updateData.pausedAt = new Date();
      }

      gameState = await db.game.update({
        where: { id: gameState.id },
        data: updateData,
      });

      logger.info(`Game ${action === 'start' ? 'started' : 'paused'}`, { 
        gameId: gameState.id,
        isRunning: gameState.isRunning,
        currentDay: gameState.currentDay 
      }, 'Game Control');
    }

    return gameState;
  });

  return successResponse({
    success: true,
    action,
    game: {
      id: game.id,
      isRunning: game.isRunning,
      currentDay: game.currentDay,
      currentDate: game.currentDate.toISOString(),
      lastTickAt: game.lastTickAt?.toISOString(),
    },
  });
});

/**
 * GET /api/game/control - Get current game state
 */
export const GET = withErrorHandling(async (_request: NextRequest) => {
  const game = await asSystem(async (db) => {
    return await db.game.findFirst({
      where: { isContinuous: true },
    });
  });

  if (!game) {
    return successResponse({
      success: true,
      game: null,
      message: 'No game found. Use POST to create and start a game.',
    });
  }

  return successResponse({
    success: true,
    game: {
      id: game.id,
      isRunning: game.isRunning,
      isContinuous: game.isContinuous,
      currentDay: game.currentDay,
      currentDate: game.currentDate.toISOString(),
      speed: game.speed,
      startedAt: game.startedAt?.toISOString(),
      pausedAt: game.pausedAt?.toISOString(),
      lastTickAt: game.lastTickAt?.toISOString(),
      activeQuestions: game.activeQuestions,
    },
  });
});

