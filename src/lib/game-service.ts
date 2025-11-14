/**
 * Game Service - API Wrapper
 * 
 * Provides access to the engine for API routes.
 * Engine is started via daemon (`bun run daemon`).
 * 
 * Note: Most operations query the database directly, which is updated by the daemon.
 * Engine status queries check if the daemon is running.
 * 
 * Vercel-compatible: No filesystem access, all data from database.
 */

import { db } from './database-service';
import { getEngine } from './engine';

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
    // Try to get stats from engine if running, otherwise query database directly
    const engine = getEngine();
    if (engine) {
      return await engine.getStats();
    }
    
    // Fallback to database directly (daemon writes here)
    return await db.getStats();
  }

  /**
   * Get all games from database
   */
  async getAllGames() {
    return await db.getAllGames();
  }

  /**
   * Get engine status.
   * Returns status indicating if daemon is running.
   */
  async getStatus() {
    const engine = getEngine();
    if (engine) {
      return await engine.getStatus();
    }
    
    // Engine not running (daemon not started)
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
