/**
 * Points Constants
 * 
 * Point award amounts for various actions in the rewards system.
 * Extracted to avoid bundling Prisma into client components.
 */

// Point award amounts
export const POINTS = {
  INITIAL_SIGNUP: 1000,
  PROFILE_COMPLETION: 1000, // Username + Profile Image + Bio (consolidated)
  FARCASTER_LINK: 1000,
  TWITTER_LINK: 1000,
  WALLET_CONNECT: 1000,
  SHARE_ACTION: 1000,
  SHARE_TO_TWITTER: 1000,
  REFERRAL_SIGNUP: 250,
} as const;

export type PointsReason =
  | 'initial_signup'
  | 'profile_completion'
  | 'farcaster_link'
  | 'twitter_link'
  | 'wallet_connect'
  | 'share_action'
  | 'share_to_twitter'
  | 'referral_signup'
  | 'admin_award'
  | 'admin_deduction'
  | 'purchase'; // x402 payment purchase

