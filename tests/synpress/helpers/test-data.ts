/**
 * Test Data and Fixtures for Synpress E2E Tests
 */

/**
 * Test user data for creating posts, profiles, etc.
 */
export const TEST_USER = {
  username: 'test_user_' + Date.now(),
  displayName: 'Test User',
  bio: 'This is a test user account for E2E testing',
  email: process.env.PRIVY_TEST_EMAIL || '',
}

/**
 * Test post content
 */
export const TEST_POST = {
  content: 'This is a test post created during E2E testing at ' + new Date().toISOString(),
  shortContent: 'Test post',
}

/**
 * Test comment content
 */
export const TEST_COMMENT = {
  content: 'This is a test comment',
}

/**
 * Test market data
 */
export const TEST_MARKET = {
  amount: '1',
  shares: '10',
}

/**
 * Test pool data
 */
export const TEST_POOL = {
  depositAmount: '100',
  withdrawAmount: '50',
}

/**
 * Common page routes
 */
export const ROUTES = {
  HOME: '/',
  FEED: '/feed',
  GAME: '/game',
  MARKETS: '/markets',
  MARKETS_POOLS: '/markets/pools',
  MARKETS_PERPS: '/markets/perps',
  LEADERBOARD: '/leaderboard',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  CHATS: '/chats',
  NOTIFICATIONS: '/notifications',
  REFERRALS: '/referrals',
  REWARDS: '/rewards',
  REGISTRY: '/registry',
  API_DOCS: '/api-docs',
  ADMIN: '/admin',
  DEBUG: '/debug',
  AGENTS: '/agents',
  AGENTS_CREATE: '/agents/create',
}

/**
 * Common selectors
 */
export const SELECTORS = {
  // Navigation
  SIDEBAR: '[data-testid="sidebar"]',
  MOBILE_HEADER: '[data-testid="mobile-header"]',
  BOTTOM_NAV: '[data-testid="bottom-nav"]',
  
  // Auth
  LOGIN_BUTTON: 'button:has-text("Login"), button:has-text("Sign in")',
  LOGOUT_BUTTON: 'button:has-text("Logout"), button:has-text("Sign out")',
  
  // Posts
  POST_INPUT: '[data-testid="post-input"], textarea[placeholder*="What" i]',
  POST_BUTTON: 'button:has-text("Post")',
  POST_CARD: '[data-testid="post-card"]',
  LIKE_BUTTON: '[data-testid="like-button"], button[aria-label*="like" i]',
  COMMENT_BUTTON: '[data-testid="comment-button"], button[aria-label*="comment" i]',
  SHARE_BUTTON: '[data-testid="share-button"], button[aria-label*="share" i]',
  
  // Markets
  BUY_BUTTON: 'button:has-text("Buy")',
  SELL_BUTTON: 'button:has-text("Sell")',
  AMOUNT_INPUT: 'input[type="number"], input[placeholder*="amount" i]',
  
  // Pools
  DEPOSIT_BUTTON: 'button:has-text("Deposit")',
  WITHDRAW_BUTTON: 'button:has-text("Withdraw")',
  
  // Profile
  EDIT_PROFILE_BUTTON: 'button:has-text("Edit Profile"), button:has-text("Edit")',
  SAVE_BUTTON: 'button:has-text("Save")',
  FOLLOW_BUTTON: 'button:has-text("Follow")',
  UNFOLLOW_BUTTON: 'button:has-text("Unfollow"), button:has-text("Following")',
  
  // Common
  LOADING_SPINNER: '[data-testid="loading"], [data-testid="spinner"]',
  ERROR_MESSAGE: '[data-testid="error"], [role="alert"]',
  SUCCESS_MESSAGE: '[data-testid="success"]',
  MODAL: '[data-testid="modal"], [role="dialog"]',
  CLOSE_BUTTON: 'button[aria-label*="close" i], button:has-text("Close")',
}

/**
 * Wait times (in milliseconds)
 */
export const WAIT_TIMES = {
  SHORT: 1000,
  MEDIUM: 3000,
  LONG: 5000,
  EXTRA_LONG: 10000,
}

/**
 * Test timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  DEFAULT: 30000,
  EXTENDED: 60000,
  PAGE_LOAD: 30000,
  API_RESPONSE: 15000,
  WALLET_ACTION: 45000,
}

