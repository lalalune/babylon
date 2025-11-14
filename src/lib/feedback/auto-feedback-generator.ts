/**
 * Auto-Feedback Generator
 *
 * Listens to game completion events and automatically generates feedback for agents.
 * Integrates with GameEngine event emitters and reputation service.
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/database-service'
import {
  generateGameCompletionFeedback,
  type GameMetrics,
} from '@/lib/reputation/reputation-service'
import type { GameEngine } from '@/engine/GameEngine'

interface GameCompletionEvent {
  agentId: string
  gameId: string
  won: boolean
  outcome: boolean
  reputationChange: number
  timestamp: string
}

/**
 * Auto-Feedback Generator Service
 *
 * Singleton service that listens to game events and generates feedback automatically.
 */
export class AutoFeedbackGenerator {
  private static instance: AutoFeedbackGenerator | null = null
  private gameEngine: GameEngine | null = null
  private isListening = false

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(): AutoFeedbackGenerator {
    if (!AutoFeedbackGenerator.instance) {
      AutoFeedbackGenerator.instance = new AutoFeedbackGenerator()
    }
    return AutoFeedbackGenerator.instance
  }

  /**
   * Initialize and start listening to game engine events
   *
   * @param gameEngine - GameEngine instance to listen to
   */
  initialize(gameEngine: GameEngine): void {
    if (this.isListening) {
      logger.warn('Auto-feedback generator already listening', undefined, 'AutoFeedback')
      return
    }

    this.gameEngine = gameEngine
    this.startListening()
    logger.info('Auto-feedback generator initialized and listening', undefined, 'AutoFeedback')
  }

  /**
   * Start listening to game completion events
   */
  private startListening(): void {
    if (!this.gameEngine) {
      logger.error('Cannot start listening: game engine not initialized', undefined, 'AutoFeedback')
      return
    }

    this.gameEngine.on('gameCompleted', (event: GameCompletionEvent) => {
      this.handleGameCompletion(event).catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to handle game completion: ${errorMessage}`, { error, event }, 'AutoFeedback')
      })
    })

    this.isListening = true
    logger.info('Started listening for game completion events', undefined, 'AutoFeedback')
  }

  /**
   * Stop listening to events
   */
  stop(): void {
    if (this.gameEngine) {
      this.gameEngine.removeAllListeners('gameCompleted')
      this.isListening = false
      logger.info('Stopped listening for game completion events', undefined, 'AutoFeedback')
    }
  }

  /**
   * Handle game completion event and generate feedback
   *
   * @param event - Game completion event data
   */
  private async handleGameCompletion(event: GameCompletionEvent): Promise<void> {
    logger.info('Processing game completion for auto-feedback', {
      agentId: event.agentId,
      gameId: event.gameId,
      won: event.won,
    }, 'AutoFeedback')

    try {
      // Fetch agent's performance metrics for this game
      const metrics = await this.calculateGameMetrics(event)

      if (!metrics) {
        logger.warn('Could not calculate metrics for game completion', { event }, 'AutoFeedback')
        return
      }

      // Generate automatic feedback
      await generateGameCompletionFeedback(event.agentId, event.gameId, metrics)

      logger.info('Successfully generated auto-feedback', {
        agentId: event.agentId,
        gameId: event.gameId,
      }, 'AutoFeedback')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to generate auto-feedback: ${errorMessage}`, { error, event }, 'AutoFeedback')
      throw error
    }
  }

  /**
   * Calculate game performance metrics from database
   *
   * @param event - Game completion event
   * @returns GameMetrics or null if data unavailable
   */
  private async calculateGameMetrics(event: GameCompletionEvent): Promise<GameMetrics | null> {
    try {
      // Fetch user's positions for this market
      const positions = await prisma.position.findMany({
        where: {
          userId: event.agentId,
          questionId: Number(event.gameId),
          status: 'resolved',
        },
        include: {
          question: true,
        },
      })

      if (positions.length === 0) {
        logger.warn('No resolved positions found for game completion', {
          agentId: event.agentId,
          gameId: event.gameId,
        }, 'AutoFeedback')
        return null
      }

      // Calculate aggregate metrics
      const totalPnL = positions.reduce((sum, pos) => {
        const pnl = pos.pnl ? Number(pos.pnl) : 0
        return sum + pnl
      }, 0)

      const totalInvested = positions.reduce((sum, pos) => {
        const amount = pos.amount ? Number(pos.amount) : 0
        return sum + amount
      }, 0)

      const startingBalance = totalInvested
      const finalBalance = startingBalance + totalPnL

      // Count correct predictions (simplified - assumes YES/NO binary outcomes)
      const correctDecisions = positions.filter((pos) => {
        const predictedYes = pos.outcome === true
        const actualOutcome = event.outcome
        return predictedYes === actualOutcome
      }).length

      // Calculate risk management score based on position sizing
      const maxPositionSize = Math.max(...positions.map(p => Number(p.amount || 0)))
      const avgPositionSize = totalInvested / positions.length
      const riskScore = maxPositionSize > 0 ? Math.min(1.0, avgPositionSize / maxPositionSize) : 0.5

      return {
        won: event.won,
        pnl: totalPnL,
        positionsClosed: positions.length,
        finalBalance,
        startingBalance,
        decisionsCorrect: correctDecisions,
        decisionsTotal: positions.length,
        riskManagement: riskScore,
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to calculate game metrics: ${errorMessage}`, { error, event }, 'AutoFeedback')
      return null
    }
  }

  /**
   * Get current status
   */
  getStatus(): { isListening: boolean; hasEngine: boolean } {
    return {
      isListening: this.isListening,
      hasEngine: this.gameEngine !== null,
    }
  }
}

/**
 * Export singleton instance
 */
export const autoFeedbackGenerator = AutoFeedbackGenerator.getInstance()
