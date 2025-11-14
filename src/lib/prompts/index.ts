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
  type Actor,
} from './world-context';

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

