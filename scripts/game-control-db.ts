#!/usr/bin/env bun
/**
 * Game Control (Direct Database)
 * 
 * Direct database script to start/pause the game (works without running server)
 * 
 * Usage:
 *   bun run scripts/game-control-db.ts start   - Start the game
 *   bun run scripts/game-control-db.ts pause   - Pause the game
 *   bun run scripts/game-control-db.ts status  - Check game status
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';

async function controlGame(action: 'start' | 'pause') {
  try {
    // Get or create the continuous game
    let game = await prisma.game.findFirst({
      where: { isContinuous: true },
    });

    if (!game) {
      // Create the game if it doesn't exist
      game = await prisma.game.create({
        data: {
          isContinuous: true,
          isRunning: action === 'start',
          currentDay: 1,
          startedAt: action === 'start' ? new Date() : null,
        },
      });
      logger.info(`✅ Game created and ${action === 'start' ? 'started' : 'paused'}!`, { gameId: game.id }, 'Game Control');
    } else {
      // Update the existing game
      const isRunning = action === 'start';
      const updateData: {
        isRunning: boolean;
        startedAt?: Date;
        pausedAt?: Date | null;
      } = {
        isRunning,
      };

      if (action === 'start') {
        updateData.startedAt = game.startedAt || new Date();
        updateData.pausedAt = null;
      } else {
        updateData.pausedAt = new Date();
      }

      game = await prisma.game.update({
        where: { id: game.id },
        data: updateData,
      });

      logger.info(`✅ Game ${action === 'start' ? 'started' : 'paused'}!`, { 
        gameId: game.id,
        isRunning: game.isRunning,
        currentDay: game.currentDay 
      }, 'Game Control');
    }

    logger.info('Game Details:', {
      id: game.id,
      isRunning: game.isRunning,
      currentDay: game.currentDay,
      lastTickAt: game.lastTickAt?.toISOString() || 'Never',
    }, 'Game Control');

  } catch (error) {
    logger.error(`Error ${action}ing game:`, error, 'Game Control');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function getStatus() {
  try {
    const game = await prisma.game.findFirst({
      where: { isContinuous: true },
    });

    if (!game) {
      logger.warn('⚠️  No game found. Use "bun run game:start" to create and start one.', undefined, 'Game Control');
      return;
    }

    logger.info('', undefined, 'Game Control');
    logger.info('═'.repeat(60), undefined, 'Game Control');
    logger.info('📊 Game Status', undefined, 'Game Control');
    logger.info('═'.repeat(60), undefined, 'Game Control');
    logger.info(`   Status: ${game.isRunning ? '✅ RUNNING' : '⏸️  PAUSED'}`, undefined, 'Game Control');
    logger.info(`   Current Day: ${game.currentDay}`, undefined, 'Game Control');
    logger.info(`   Current Date: ${game.currentDate.toLocaleString()}`, undefined, 'Game Control');
    logger.info(`   Active Questions: ${game.activeQuestions}`, undefined, 'Game Control');
    logger.info(`   Speed: ${game.speed}ms between ticks`, undefined, 'Game Control');
    logger.info(`   Last Tick: ${game.lastTickAt ? game.lastTickAt.toLocaleString() : 'Never'}`, undefined, 'Game Control');
    
    if (game.startedAt) {
      logger.info(`   Started At: ${game.startedAt.toLocaleString()}`, undefined, 'Game Control');
    }
    
    if (game.pausedAt) {
      logger.info(`   Paused At: ${game.pausedAt.toLocaleString()}`, undefined, 'Game Control');
    }
    
    logger.info('═'.repeat(60), undefined, 'Game Control');
    logger.info('', undefined, 'Game Control');

    if (!game.isRunning) {
      logger.info('💡 To start the game, run: bun run game:start', undefined, 'Game Control');
    } else {
      logger.info('💡 To pause the game, run: bun run game:pause', undefined, 'Game Control');
    }
  } catch (error) {
    logger.error('Error getting game status:', error, 'Game Control');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const action = process.argv[2];

  if (!action) {
    logger.info('Usage:', undefined, 'Game Control');
    logger.info('  bun run game:start   - Start the game', undefined, 'Game Control');
    logger.info('  bun run game:pause   - Pause the game', undefined, 'Game Control');
    logger.info('  bun run game:status  - Check game status', undefined, 'Game Control');
    process.exit(1);
  }

  switch (action) {
    case 'start':
      await controlGame('start');
      break;
    case 'pause':
      await controlGame('pause');
      break;
    case 'status':
      await getStatus();
      break;
    default:
      logger.error(`Unknown action: ${action}`, undefined, 'Game Control');
      logger.info('Valid actions: start, pause, status', undefined, 'Game Control');
      process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Script failed:', error, 'Game Control');
  process.exit(1);
});
