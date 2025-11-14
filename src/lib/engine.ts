/**
 * Game Engine Singleton Wrapper
 * 
 * Provides singleton access to GameEngine for API routes and services.
 * 
 * IMPORTANT: The engine should be started via the daemon (`bun run daemon`), not auto-started.
 * This wrapper is for querying engine state and accessing the database.
 * 
 * To start the engine, run: `bun run daemon`
 */

import { PredictionPricing } from './prediction-pricing';
import { logger } from './logger';
import { GameEngine } from '@/engine/GameEngine';

// Re-export pricing for convenience (safe for client-side)
export { PredictionPricing as pricing };

// Singleton instance (only set when daemon starts the engine)
let engineInstance: GameEngine | null = null;

/**
 * Get the engine instance if it exists.
 * Returns null if engine is not running (should be started via daemon).
 * 
 * Note: This is used by API routes to check engine status.
 * The engine itself should be started via `bun run daemon`.
 */
export function getEngine(): GameEngine | null {
  // Only works on server side
  if (typeof window !== 'undefined') {
    throw new Error('GameEngine can only be accessed on the server side');
  }
  
  return engineInstance;
}

/**
 * Set the engine instance (called by daemon when it starts)
 * @internal - Only called by daemon process
 */
export function setEngineInstance(engine: GameEngine): void {
  engineInstance = engine;
}

/**
 * Clear the engine instance (called by daemon when it stops)
 * @internal - Only called by daemon process
 */
export function clearEngineInstance(): void {
  engineInstance = null;
}

/**
 * Initialize and start the engine.
 * 
 * NOTE: This should only be called by the daemon process (`bun run daemon`).
 * Do not call this from Next.js API routes or server components.
 * 
 * @deprecated Use daemon instead: `bun run daemon`
 */
export async function initializeEngine(): Promise<void> {
  logger.warn('initializeEngine() called. Engine should be started via daemon: bun run daemon', undefined, 'Engine');
  
  if (engineInstance) {
    logger.warn('Engine already initialized', undefined, 'Engine');
    return;
  }

  logger.info('STARTING BABYLON ENGINE (via initializeEngine)', undefined, 'Engine');

  const engine = new GameEngine({
    tickIntervalMs: 60000, // 1 minute ticks
    postsPerTick: 12,      // 12 LLM-generated posts per minute
    historyDays: 30,
  });
  
  await engine.initialize();
  engine.start();
  
  engineInstance = engine;
  
  logger.info('ENGINE RUNNING', undefined, 'Engine');
}

/**
 * Stop the engine.
 * 
 * NOTE: This should only be called by the daemon process on shutdown.
 * 
 * @deprecated Use daemon shutdown instead: Ctrl+C on daemon process
 */
export function stopEngine(): void {
  if (engineInstance) {
    engineInstance.stop();
    engineInstance = null;
  }
}
