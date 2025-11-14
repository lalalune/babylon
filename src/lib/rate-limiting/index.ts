/**
 * Rate Limiting and Duplicate Detection
 * 
 * Centralized exports for rate limiting functionality
 */

export {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
  resetRateLimit,
  clearAllRateLimits,
  getRateLimitStatus,
  cleanupRateLimits,
} from './user-rate-limiter';

export {
  checkDuplicate,
  DUPLICATE_DETECTION_CONFIGS,
  clearDuplicates,
  clearAllDuplicates,
  cleanupDuplicates,
  getDuplicateStats,
} from './duplicate-detector';

export {
  applyRateLimit,
  applyDuplicateDetection,
  checkRateLimitAndDuplicates,
  rateLimitError,
  duplicateContentError,
  addRateLimitHeaders,
} from './middleware';

