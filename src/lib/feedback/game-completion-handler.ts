/**
 * Game Completion Handler
 *
 * Orchestrates automatic feedback generation when games complete.
 * Integrates with GameEngine lifecycle and manages auto-feedback generator.
 */

import { logger } from '@/lib/logger'
import { autoFeedbackGenerator } from './auto-feedback-generator'
import type { GameEngine } from '@/engine/GameEngine'

/**
 * Game Completion Handler Service
 *
 * Manages the lifecycle of automatic feedback generation in response to game events.
 */
export class GameCompletionHandler {
  private static instance: GameCompletionHandler | null = null
  private isActive = false

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(): GameCompletionHandler {
    if (!GameCompletionHandler.instance) {
      GameCompletionHandler.instance = new GameCompletionHandler()
    }
    return GameCompletionHandler.instance
  }

  /**
   * Start handling game completions
   *
   * Initializes auto-feedback generator and connects it to game engine events.
   *
   * @param gameEngine - GameEngine instance to monitor
   */
  start(gameEngine: GameEngine): void {
    if (this.isActive) {
      logger.warn('Game completion handler already active', undefined, 'GameCompletionHandler')
      return
    }

    try {
      // Initialize auto-feedback generator
      autoFeedbackGenerator.initialize(gameEngine)

      // Listen for engine lifecycle events
      gameEngine.on('started', () => {
        logger.info('Game engine started - auto-feedback active', undefined, 'GameCompletionHandler')
      })

      gameEngine.on('stopped', () => {
        logger.info('Game engine stopped - pausing auto-feedback', undefined, 'GameCompletionHandler')
      })

      gameEngine.on('error', (error: Error) => {
        logger.error('Game engine error detected', { error }, 'GameCompletionHandler')
      })

      this.isActive = true
      logger.info('Game completion handler started successfully', undefined, 'GameCompletionHandler')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to start game completion handler: ${errorMessage}`, { error }, 'GameCompletionHandler')
      throw error
    }
  }

  /**
   * Stop handling game completions
   *
   * Disconnects from game engine and stops auto-feedback generation.
   */
  stop(): void {
    if (!this.isActive) {
      logger.warn('Game completion handler not active', undefined, 'GameCompletionHandler')
      return
    }

    try {
      autoFeedbackGenerator.stop()
      this.isActive = false
      logger.info('Game completion handler stopped', undefined, 'GameCompletionHandler')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to stop game completion handler: ${errorMessage}`, { error }, 'GameCompletionHandler')
      throw error
    }
  }

  /**
   * Get current handler status
   */
  getStatus(): {
    isActive: boolean
    autoFeedbackStatus: { isListening: boolean; hasEngine: boolean }
  } {
    return {
      isActive: this.isActive,
      autoFeedbackStatus: autoFeedbackGenerator.getStatus(),
    }
  }

  /**
   * Check if handler is ready to process completions
   */
  isReady(): boolean {
    const status = autoFeedbackGenerator.getStatus()
    return this.isActive && status.isListening && status.hasEngine
  }
}

/**
 * Export singleton instance
 */
export const gameCompletionHandler = GameCompletionHandler.getInstance()
