/**
 * Games Listing API
 * 
 * @route GET /api/games
 * @access Public
 * 
 * @description
 * Returns a list of all games in the system. Games represent different
 * game instances or scenarios, including the main continuous game and
 * any archived or completed games.
 * 
 * **Game Information Includes:**
 * - Game ID and identifiers
 * - Running status (active/paused)
 * - Current day/date in game time
 * - Timing information (started, paused, last tick)
 * - Game configuration (speed, continuous mode)
 * - Active questions/events
 * 
 * **Use Cases:**
 * - Display list of available games
 * - Show game history
 * - Monitor game states
 * - Game selection interfaces
 * 
 * @returns {object} Games list response
 * @property {boolean} success - Operation success status
 * @property {array} games - Array of game objects
 * @property {number} count - Total games count
 * 
 * **Game Object:**
 * @property {string} id - Unique game identifier
 * @property {boolean} isRunning - Whether game is currently running
 * @property {boolean} isContinuous - Continuous vs episodic game
 * @property {number} currentDay - Current day in game timeline
 * @property {string} currentDate - Current date in game timeline
 * @property {number} speed - Game speed multiplier
 * @property {string} startedAt - ISO timestamp when game started
 * @property {string} pausedAt - ISO timestamp when game was paused
 * @property {string} lastTickAt - ISO timestamp of last game tick
 * 
 * @throws {500} Internal server error
 * 
 * @example
 * ```typescript
 * // Get all games
 * const response = await fetch('/api/games');
 * const { games, count } = await response.json();
 * 
 * // Display game information
 * games.forEach(game => {
 *   console.log(`Game ${game.id}:`);
 *   console.log(`  Status: ${game.isRunning ? 'Running' : 'Paused'}`);
 *   console.log(`  Day: ${game.currentDay}`);
 * });
 * ```
 * 
 * @see {@link /lib/game-service} Game service implementation
 * @see {@link /lib/serverless-game-tick} Game tick engine
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

