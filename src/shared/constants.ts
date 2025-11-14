/**
 * Shared Constants for Babylon Game
 *
 * Centralized constants to eliminate magic strings across codebase
 */

/**
 * Actor tier levels (influence and prominence)
 */
export const ACTOR_TIERS = {
  S_TIER: 'S_TIER',
  A_TIER: 'A_TIER',
  B_TIER: 'B_TIER',
  C_TIER: 'C_TIER',
} as const;

export type ActorTier = (typeof ACTOR_TIERS)[keyof typeof ACTOR_TIERS];

/**
 * Feed Widget Configuration
 * These thresholds are used for determining what qualifies as breaking news or upcoming events
 */
export const FEED_WIDGET_CONFIG = {
  // Breaking News thresholds
  TRENDING_HOURS: 4, // Hours before an event is considered "trending"
  PRICE_TRENDING_HOURS: 2, // Hours before a price update is considered "trending"
  SIGNIFICANT_PRICE_CHANGE_PERCENT: 2, // Minimum % change to be considered significant
  MIN_PRICE_CHANGE_PERCENT: 0.5, // Minimum % change for any price update to show
  ATH_THRESHOLD_PERCENT: 2, // Minimum % change to qualify as ATH
  
  // Upcoming Events thresholds
  UPCOMING_EVENTS_DAYS: 7, // Days ahead to show upcoming events
  LIVE_EVENT_HOURS: 2, // Hours before event to mark as "LIVE"
  HINT_SHOW_DAYS: 1, // Days before event to show hint
  
  // Display limits
  MAX_BREAKING_NEWS_ITEMS: 3,
  MAX_UPCOMING_EVENTS: 3,
  MAX_WORLD_EVENTS_QUERY: 100,
  MAX_PRICE_UPDATES_QUERY: 50,
  MAX_POSTS_QUERY: 100,
} as const;

/**
 * Feed post types
 */
export const POST_TYPES = {
  WORLD_EVENT: 'world_event',
  REACTION: 'reaction',
  NEWS: 'news',
  THREAD: 'thread',
  RUMOR: 'rumor',
  POST: 'post',
  REPLY: 'reply',
} as const;

export type PostType = (typeof POST_TYPES)[keyof typeof POST_TYPES];

/**
 * Day ranges for escalation rules
 * Content gets progressively more chaotic as the game progresses
 */
export const DAY_RANGES = {
  EARLY: { min: 1, max: 10 },    // Days 1-10: Setup, introductions
  MID: { min: 11, max: 20 },     // Days 11-20: Rising action
  LATE: { min: 21, max: 30 },    // Days 21-30: Peak chaos
} as const;

/**
 * Organization types
 */
export const ORG_TYPES = {
  TECH_COMPANY: 'tech_company',
  MEDIA_OUTLET: 'media_outlet',
  GOVERNMENT: 'government',
  NONPROFIT: 'nonprofit',
  CRYPTO: 'crypto',
} as const;

export type OrgType = (typeof ORG_TYPES)[keyof typeof ORG_TYPES];

/**
 * Actor selection counts for game generation
 */
export const ACTOR_COUNTS = {
  MAIN: 3,
  SUPPORTING: 15,
  EXTRAS: 50,
} as const;

/**
 * Scenario and question counts
 */
export const GAME_STRUCTURE = {
  SCENARIOS: 3,
  QUESTIONS_PER_SCENARIO: 1,
  DAYS: 30,
} as const;

/**
 * Feed generation targets
 */
export const FEED_TARGETS = {
  MIN_POSTS: 300,
  MAX_POSTS: 500,
  MIN_GROUP_MESSAGES: 100,
  MAX_GROUP_MESSAGES: 200,
} as const;

/**
 * Escalation rules for content intensity
 * Controls how wild content can get based on day number
 */
export function getEscalationLevel(day: number): 'mild' | 'moderate' | 'intense' {
  if (day <= DAY_RANGES.EARLY.max) return 'mild';
  if (day <= DAY_RANGES.MID.max) return 'moderate';
  return 'intense';
}
