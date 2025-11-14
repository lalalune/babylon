/**
 * Game Control API
 * 
 * @route POST /api/game/control - Start or pause game
 * @route GET /api/game/control - Get current game state
 * @access POST: Admin (requires ADMIN_TOKEN or dev environment)
 * @access GET: Public
 * 
 * @description
 * Controls the main continuous game engine, allowing administrators to start,
 * pause, and monitor the game state. The game engine drives all in-game events,
 * time progression, market updates, and NPC behaviors.
 * 
 * **POST - Game Control Actions**
 * 
 * Start or pause the game engine. Creates the continuous game if it doesn't
 * exist. Only accessible to administrators or in development mode.
 * 
 * **Actions:**
 * - **start:** Starts the game engine, beginning time progression and events
 * - **pause:** Pauses the game engine, freezing all game state
 * 
 * **Authentication:**
 * Requires `x-admin-token` header matching `ADMIN_TOKEN` environment variable,
 * or must be running in development mode (`NODE_ENV=development`).
 * 
 * @param {string} action - Control action: 'start' | 'pause' (required)
 * 
 * @returns {object} Game state after action
 * @property {boolean} success - Operation success
 * @property {string} action - Action that was performed
 * @property {object} game - Current game state
 * 
 * **GET - Get Game State**
 * 
 * Returns the current state of the continuous game including running status,
 * current day, and timing information. Publicly accessible for monitoring.
 * 
 * @returns {object} Current game state
 * @property {boolean} success - Operation success
 * @property {object|null} game - Game state (null if no game exists)
 * 
 * **Game State Object:**
 * @property {string} id - Game ID
 * @property {boolean} isRunning - Whether game is running
 * @property {boolean} isContinuous - Continuous mode flag
 * @property {number} currentDay - Current day in game timeline
 * @property {string} currentDate - Current game date (ISO)
 * @property {number} speed - Game speed multiplier
 * @property {string} startedAt - When game started (ISO)
 * @property {string} pausedAt - When game was paused (ISO)
 * @property {string} lastTickAt - Last game tick timestamp (ISO)
 * @property {number} activeQuestions - Number of active questions
 * 
 * @throws {400} Invalid action (POST)
 * @throws {401} Unauthorized - admin token required (POST)
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Start the game (admin only)
 * const response = await fetch('/api/game/control', {
 *   method: 'POST',
 *   headers: {
 *     'x-admin-token': process.env.ADMIN_TOKEN
 *   },
 *   body: JSON.stringify({ action: 'start' })
 * });
 * 
 * // Pause the game (admin only)
 * await fetch('/api/game/control', {
 *   method: 'POST',
 *   headers: { 'x-admin-token': process.env.ADMIN_TOKEN },
 *   body: JSON.stringify({ action: 'pause' })
 * });
 * 
 * // Get current game state (public)
 * const state = await fetch('/api/game/control');
 * const { game } = await state.json();
 * console.log(`Game is ${game.isRunning ? 'running' : 'paused'}`);
 * console.log(`Current day: ${game.currentDay}`);
 * ```
 * 
 * **Admin Authentication:**
 * ```typescript
 * // Set in environment
 * ADMIN_TOKEN=your-secret-token
 * 
 * // Use in requests
 * headers: { 'x-admin-token': process.env.ADMIN_TOKEN }
 * ```
 * 
 * @see {@link /lib/game-service} Game engine implementation
 * @see {@link /lib/serverless-game-tick} Game tick logic
 * @see {@link /api/cron/game-tick} Game tick cron job
 */

import type { NextRequest } from 'next/server';
import { asSystem } from '@/lib/db/context';
import { withErrorHandling, successResponse } from '@/lib/errors/error-handler';
import { BadRequestError, AuthorizationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';

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
      const now = new Date();
      gameState = await db.game.create({
        data: {
          id: await generateSnowflakeId(),
          isContinuous: true,
          isRunning: action === 'start',
          currentDay: 1,
          startedAt: action === 'start' ? now : null,
          createdAt: now,
          updatedAt: now,
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

