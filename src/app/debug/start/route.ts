/**
 * Debug: Start Game
 * GET /debug/start - Start the game (browser-accessible)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest) {
  try {
    // Get or create the continuous game (this will also verify DB connection)
    let game = await prisma.game.findFirst({
      where: { isContinuous: true },
    });

    if (!game) {
      // Create the game if it doesn't exist
      game = await prisma.game.create({
        data: {
          isContinuous: true,
          isRunning: true,
          currentDay: 1,
          startedAt: new Date(),
        },
      });
      logger.info('Game created and started', { gameId: game.id }, 'Debug');
    } else if (!game.isRunning) {
      // Start the paused game
      game = await prisma.game.update({
        where: { id: game.id },
        data: {
          isRunning: true,
          startedAt: game.startedAt || new Date(),
          pausedAt: null,
        },
      });
      logger.info('Game started', { gameId: game.id }, 'Debug');
    } else {
      logger.info('Game already running', { gameId: game.id }, 'Debug');
    }

    return NextResponse.json({
      success: true,
      message: '✅ Game started successfully!',
      game: {
        id: game.id,
        isRunning: game.isRunning,
        currentDay: game.currentDay,
        currentDate: game.currentDate.toISOString(),
        lastTickAt: game.lastTickAt?.toISOString(),
        activeQuestions: game.activeQuestions,
      },
    });
  } catch (error) {
    logger.error('Error starting game:', error, 'Debug');
    
    // Check if it's a database connection error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isDbError = errorMessage.includes('connect') || 
                      errorMessage.includes('database') || 
                      errorMessage.includes('ECONNREFUSED');
    
    return NextResponse.json(
      {
        success: false,
        error: isDbError ? 'Database connection failed' : 'Failed to start game',
        message: isDbError 
          ? 'Cannot connect to database. Check DATABASE_URL environment variable.' 
          : errorMessage,
        details: errorMessage,
      },
      { status: isDbError ? 503 : 500 }
    );
  }
}

