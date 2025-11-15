/**
 * User-level Rate Limiting Utility
 * 
 * Implements a sliding window rate limiter with per-user tracking.
 * Supports different rate limits for different actions.
 */

import { logger } from '@/lib/logger';

interface RateLimitRecord {
  count: number;
  windowStart: number;
  recentActions: number[]; // Timestamps of recent actions for sliding window
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  actionType: string;
}

// In-memory store for rate limit records
// In production, you might want to use Redis for distributed rate limiting
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Predefined rate limit configurations for different actions
 */
export const RATE_LIMIT_CONFIGS = {
  // Content creation
  CREATE_POST: { maxRequests: 3, windowMs: 60000, actionType: 'create_post' }, // 3 posts per minute
  CREATE_COMMENT: { maxRequests: 10, windowMs: 60000, actionType: 'create_comment' }, // 10 comments per minute
  
  // Interactions
  LIKE_POST: { maxRequests: 20, windowMs: 60000, actionType: 'like_post' }, // 20 likes per minute
  LIKE_COMMENT: { maxRequests: 20, windowMs: 60000, actionType: 'like_comment' }, // 20 likes per minute
  SHARE_POST: { maxRequests: 5, windowMs: 60000, actionType: 'share_post' }, // 5 shares per minute
  
  // Social actions
  FOLLOW_USER: { maxRequests: 10, windowMs: 60000, actionType: 'follow_user' }, // 10 follows per minute
  UNFOLLOW_USER: { maxRequests: 10, windowMs: 60000, actionType: 'unfollow_user' }, // 10 unfollows per minute
  
  // Messages
  SEND_MESSAGE: { maxRequests: 20, windowMs: 60000, actionType: 'send_message' }, // 20 messages per minute
  
  // Uploads
  UPLOAD_IMAGE: { maxRequests: 5, windowMs: 60000, actionType: 'upload_image' }, // 5 uploads per minute
  
  // Profile updates
  UPDATE_PROFILE: { maxRequests: 5, windowMs: 60000, actionType: 'update_profile' }, // 5 updates per minute
  
  // Agent actions
  GENERATE_AGENT_PROFILE: { maxRequests: 5, windowMs: 60000, actionType: 'generate_agent_profile' }, // 5 generations per minute
  GENERATE_AGENT_FIELD: { maxRequests: 10, windowMs: 60000, actionType: 'generate_agent_field' }, // 10 field generations per minute
  
  // Market actions
  OPEN_POSITION: { maxRequests: 10, windowMs: 60000, actionType: 'open_position' }, // 10 positions per minute
  CLOSE_POSITION: { maxRequests: 10, windowMs: 60000, actionType: 'close_position' }, // 10 positions per minute
  BUY_PREDICTION: { maxRequests: 10, windowMs: 60000, actionType: 'buy_prediction' }, // 10 buys per minute
  SELL_PREDICTION: { maxRequests: 10, windowMs: 60000, actionType: 'sell_prediction' }, // 10 sells per minute
  
  // Admin actions (more generous limits)
  ADMIN_ACTION: { maxRequests: 100, windowMs: 60000, actionType: 'admin_action' }, // 100 admin actions per minute
  
  // Default fallback
  DEFAULT: { maxRequests: 30, windowMs: 60000, actionType: 'default' }, // 30 requests per minute
} as const;

/**
 * Check if user has exceeded rate limit for a specific action
 * Uses sliding window algorithm for accurate rate limiting
 */
export function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): { allowed: boolean; retryAfter?: number; remaining?: number } {
  const key = `${userId}:${config.actionType}`;
  const now = Date.now();
  
  // Get or create rate limit record
  let record = rateLimitStore.get(key);
  
  if (!record) {
    record = {
      count: 0,
      windowStart: now,
      recentActions: [],
    };
    rateLimitStore.set(key, record);
  }
  
  // Remove actions outside the current window (sliding window)
  const windowStart = now - config.windowMs;
  record.recentActions = record.recentActions.filter(timestamp => timestamp > windowStart);
  
  // Check if user has exceeded the limit
  if (record.recentActions.length >= config.maxRequests) {
    const oldestAction = record.recentActions[0];
    const retryAfter = oldestAction ? Math.ceil((oldestAction + config.windowMs - now) / 1000) : Math.ceil(config.windowMs / 1000);
    
    logger.warn('Rate limit exceeded', {
      userId,
      actionType: config.actionType,
      attempts: record.recentActions.length,
      maxRequests: config.maxRequests,
      retryAfter,
    });
    
    return {
      allowed: false,
      retryAfter,
      remaining: 0,
    };
  }
  
  // Record this action
  record.recentActions.push(now);
  record.count = record.recentActions.length;
  record.windowStart = now;
  
  const remaining = config.maxRequests - record.recentActions.length;
  
  logger.debug('Rate limit check passed', {
    userId,
    actionType: config.actionType,
    count: record.recentActions.length,
    maxRequests: config.maxRequests,
    remaining,
  });
  
  return {
    allowed: true,
    remaining,
  };
}

/**
 * Reset rate limit for a specific user and action
 * Useful for testing or manual intervention
 */
export function resetRateLimit(userId: string, actionType: string): void {
  const key = `${userId}:${actionType}`;
  rateLimitStore.delete(key);
  logger.info('Rate limit reset', { userId, actionType });
}

/**
 * Clear all rate limit records
 * Useful for testing
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
  logger.info('All rate limits cleared');
}

/**
 * Get current rate limit status for a user and action
 */
export function getRateLimitStatus(
  userId: string,
  config: RateLimitConfig
): { count: number; remaining: number; resetAt: Date } {
  const key = `${userId}:${config.actionType}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record) {
    return {
      count: 0,
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs),
    };
  }
  
  // Remove expired actions
  const windowStart = now - config.windowMs;
  const validActions = record.recentActions.filter(timestamp => timestamp > windowStart);
  
  const oldestAction = validActions[0] || now;
  
  return {
    count: validActions.length,
    remaining: Math.max(0, config.maxRequests - validActions.length),
    resetAt: new Date(oldestAction + config.windowMs),
  };
}

/**
 * Cleanup old rate limit records periodically
 * Should be called periodically (e.g., every 5 minutes) to prevent memory leaks
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  let cleanedCount = 0;
  
  for (const [key, record] of rateLimitStore.entries()) {
    // Remove records where all actions are older than maxAge
    const hasRecentActions = record.recentActions.some(timestamp => now - timestamp < maxAge);
    
    if (!hasRecentActions) {
      rateLimitStore.delete(key);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    logger.info('Cleaned up old rate limit records', { cleanedCount, totalRemaining: rateLimitStore.size });
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000);
}

