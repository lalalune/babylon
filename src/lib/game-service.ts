/**
 * Game Service - API Wrapper
 * 
 * Provides access to game data for API routes.
 * Game tick runs automatically via cron (production) or local simulator (development).
 * 
 * Note: All operations query the database directly, which is updated by game tick.
 * 
 * Vercel-compatible: No filesystem access, all data from database.
 */

import { db } from './database-service';

class GameService {
  async getRecentPosts(limit = 100, offset = 0) {
    return await db.getRecentPosts(limit, offset);
  }

  async getPostsByActor(actorId: string, limit = 100) {
    return await db.getPostsByActor(actorId, limit);
  }

  async getCompanies() {
    return await db.getCompanies();
  }

  async getActiveQuestions() {
    return await db.getActiveQuestions();
  }

  /**
   * Get game statistics from database.
   * Works even if engine is not running (daemon writes to database).
   */
  async getStats() {
    return await db.getStats();
  }

  /**
   * Get all games from database
   */
  async getAllGames() {
    return await db.getAllGames();
  }

  /**
   * Get game status.
   * Returns status indicating if game is running and tick is active.
   */
  async getStatus() {
    // Check game state from database
    const gameState = await db.getGameState();
    return {
      isRunning: false,
      initialized: false,
      currentDay: gameState?.currentDay || 0,
      currentDate: gameState?.currentDate?.toISOString(),
      speed: 60000,
      lastTickAt: gameState?.lastTickAt?.toISOString(),
    };
  }

  async getRealtimePosts(limit = 100, offset = 0, actorId?: string) {
    // On Vercel: Read from database instead of filesystem
    // The daemon writes posts to database, so we can query them directly
    const posts = actorId 
      ? await db.getPostsByActor(actorId, limit)
      : await db.getRecentPosts(limit, offset);
    
    if (!posts || posts.length === 0) {
      return null;
    }

    return {
      posts: posts.map(post => ({
        id: post.id,
        content: post.content,
        authorId: post.authorId,
        author: post.authorId, // Post model doesn't have author field, use authorId
        timestamp: post.createdAt.toISOString(),
        createdAt: post.createdAt.toISOString(),
        gameId: post.gameId,
        dayNumber: post.dayNumber,
      })),
      total: posts.length,
    };
  }
}

export const gameService = new GameService();
