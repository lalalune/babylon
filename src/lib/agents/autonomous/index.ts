/**
 * Autonomous Agent Services
 * Centralized exports for all autonomous behaviors
 */

// Main coordinator (use this for all autonomous operations)
// Using regular coordinator - trajectory recording handled separately for agents that need it
export { autonomousCoordinator, type AutonomousTickResult } from './AutonomousCoordinator'

// With trajectory recording (for RL training)
export { AutonomousCoordinatorWithRecording } from '@/lib/autonomous/AutonomousCoordinatorWithRecording'

// Individual services (for specific use cases)
export { autonomousA2AService } from './AutonomousA2AService'
export { autonomousBatchResponseService } from './AutonomousBatchResponseService'
export { autonomousTradingService } from './AutonomousTradingService'
export { autonomousPostingService } from './AutonomousPostingService'
export { autonomousCommentingService } from './AutonomousCommentingService'
export { autonomousDMService } from './AutonomousDMService'
export { autonomousGroupChatService } from './AutonomousGroupChatService'
