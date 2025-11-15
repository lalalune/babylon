/**
 * Prompt Utilities
 * 
 * Utilities for working with feed prompts and world context
 */

// World context generation
export {
  generateWorldContext,
  generateWorldActors,
  generateCurrentMarkets,
  generateActivePredictions,
  generateRecentTrades,
  getParodyActorNames,
  getForbiddenRealNames,
  type WorldContextOptions,
} from './world-context';

// Re-export ActorData from shared types for convenience
export type { ActorData } from '@/shared/types';

// Output validation
export {
  validateFeedPost,
  validatePostBatch,
  validateNoRealNames,
  validateNoHashtags,
  validateNoEmojis,
  validateCharacterLimit,
  CHARACTER_LIMITS,
  type ValidationResult,
} from './validate-output';

