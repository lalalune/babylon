/**
 * A2A Load Test Scenarios
 * 
 * Test scenarios for Agent-to-Agent (A2A) protocol endpoints
 * to stress test rate limiting and performance under load.
 */

import type { LoadTestConfig } from './load-test-simulator';

/**
 * Generate A2A request body for a given method
 */
export function generateA2ARequest(method: string, params?: Record<string, unknown>) {
  return {
    jsonrpc: '2.0',
    method,
    params: params || {},
    id: Math.floor(Math.random() * 1000000)
  };
}

/**
 * Common A2A headers for agent authentication
 */
export function getA2AHeaders(agentId: string = 'test-agent-1') {
  return {
    'Content-Type': 'application/json',
    'x-agent-id': agentId,
    'x-agent-address': '0x1234567890123456789012345678901234567890',
    'x-agent-token-id': '1'
  };
}

/**
 * All implemented A2A methods with their parameters
 */
export const A2A_METHODS = {
  // Discovery & Info
  DISCOVER: { method: 'a2a.discover', params: {} },
  GET_INFO: { method: 'a2a.getInfo', params: { agentId: 'babylon-agent' } },
  
  // Market Operations
  GET_MARKET_DATA: { method: 'a2a.getMarketData', params: { marketId: '1' } },
  GET_MARKET_PRICES: { method: 'a2a.getMarketPrices', params: { marketIds: ['1', '2'] } },
  SUBSCRIBE_MARKET: { method: 'a2a.subscribeMarket', params: { marketId: '1' } },
  GET_PREDICTIONS: { method: 'a2a.getPredictions', params: {} },
  GET_PERPETUALS: { method: 'a2a.getPerpetuals', params: {} },
  GET_POSITIONS: { method: 'a2a.getPositions', params: {} },
  GET_TRADE_HISTORY: { method: 'a2a.getTradeHistory', params: {} },
  
  // User & Profile
  GET_BALANCE: { method: 'a2a.getBalance', params: {} },
  GET_USER_WALLET: { method: 'a2a.getUserWallet', params: {} },
  GET_USER_PROFILE: { method: 'a2a.getUserProfile', params: {} },
  UPDATE_PROFILE: { method: 'a2a.updateProfile', params: { bio: 'Test bio' } },
  SEARCH_USERS: { method: 'a2a.searchUsers', params: { query: 'test' } },
  GET_USER_STATS: { method: 'a2a.getUserStats', params: {} },
  
  // Social Features
  GET_FEED: { method: 'a2a.getFeed', params: {} },
  CREATE_POST: { method: 'a2a.createPost', params: { content: 'Test post' } },
  GET_FOLLOWERS: { method: 'a2a.getFollowers', params: {} },
  GET_FOLLOWING: { method: 'a2a.getFollowing', params: {} },
  
  // Coalitions
  PROPOSE_COALITION: { method: 'a2a.proposeCoalition', params: { name: 'Test Coalition', description: 'Test' } },
  JOIN_COALITION: { method: 'a2a.joinCoalition', params: { coalitionId: 'test-coalition-1' } },
  COALITION_MESSAGE: { method: 'a2a.coalitionMessage', params: { coalitionId: 'test-coalition-1', message: 'Hello' } },
  LEAVE_COALITION: { method: 'a2a.leaveCoalition', params: { coalitionId: 'test-coalition-1' } },
  
  // Analysis & Insights
  SHARE_ANALYSIS: { method: 'a2a.shareAnalysis', params: { marketId: '1', analysis: 'Bullish' } },
  REQUEST_ANALYSIS: { method: 'a2a.requestAnalysis', params: { marketId: '1' } },
  GET_ANALYSES: { method: 'a2a.getAnalyses', params: {} },
  
  // Payments (x402)
  PAYMENT_REQUEST: { method: 'a2a.paymentRequest', params: { amount: 100, description: 'Test payment' } },
  PAYMENT_RECEIPT: { method: 'a2a.paymentReceipt', params: { transactionId: 'test-tx-1' } },
  
  // Chats & Messaging
  GET_CHATS: { method: 'a2a.getChats', params: {} },
  GET_UNREAD_COUNT: { method: 'a2a.getUnreadCount', params: {} },
  
  // Notifications
  GET_NOTIFICATIONS: { method: 'a2a.getNotifications', params: {} },
  GET_GROUP_INVITES: { method: 'a2a.getGroupInvites', params: {} },
  
  // Pools
  GET_POOLS: { method: 'a2a.getPools', params: {} },
  GET_POOL_DEPOSITS: { method: 'a2a.getPoolDeposits', params: {} },
  
  // System & Stats
  GET_SYSTEM_STATS: { method: 'a2a.getSystemStats', params: {} },
  GET_LEADERBOARD: { method: 'a2a.getLeaderboard', params: {} },
  
  // Referrals
  GET_REFERRAL_CODE: { method: 'a2a.getReferralCode', params: {} },
  GET_REFERRALS: { method: 'a2a.getReferrals', params: {} },
  GET_REFERRAL_STATS: { method: 'a2a.getReferralStats', params: {} },
} as const;

/**
 * Generate endpoint configuration for load testing
 */
function generateA2AEndpoint(
  methodConfig: { method: string; params: Record<string, unknown> },
  weight: number,
  agentId: string = 'test-agent-1'
) {
  return {
    path: '/api/a2a',
    method: 'POST' as const,
    weight,
    headers: getA2AHeaders(agentId),
    body: generateA2ARequest(methodConfig.method, methodConfig.params)
  };
}

/**
 * Light A2A load test: 50 agents, focus on read operations
 */
export const A2A_LIGHT_SCENARIO: LoadTestConfig = {
  concurrentUsers: 50,
  durationSeconds: 60,
  rampUpSeconds: 10,
  thinkTimeMs: 1000,
  endpoints: [
    generateA2AEndpoint(A2A_METHODS.GET_BALANCE, 0.20),
    generateA2AEndpoint(A2A_METHODS.GET_POSITIONS, 0.20),
    generateA2AEndpoint(A2A_METHODS.GET_USER_PROFILE, 0.15),
    generateA2AEndpoint(A2A_METHODS.GET_PREDICTIONS, 0.15),
    generateA2AEndpoint(A2A_METHODS.GET_FEED, 0.15),
    generateA2AEndpoint(A2A_METHODS.GET_LEADERBOARD, 0.10),
    generateA2AEndpoint(A2A_METHODS.GET_SYSTEM_STATS, 0.05),
  ]
};

/**
 * Normal A2A load test: 100 agents, mixed read/write operations
 */
export const A2A_NORMAL_SCENARIO: LoadTestConfig = {
  concurrentUsers: 100,
  durationSeconds: 120,
  rampUpSeconds: 20,
  thinkTimeMs: 500,
  endpoints: [
    // High-frequency reads
    generateA2AEndpoint(A2A_METHODS.GET_BALANCE, 0.15),
    generateA2AEndpoint(A2A_METHODS.GET_POSITIONS, 0.15),
    generateA2AEndpoint(A2A_METHODS.GET_USER_PROFILE, 0.10),
    generateA2AEndpoint(A2A_METHODS.GET_PREDICTIONS, 0.10),
    generateA2AEndpoint(A2A_METHODS.GET_FEED, 0.10),
    generateA2AEndpoint(A2A_METHODS.GET_MARKET_DATA, 0.10),
    generateA2AEndpoint(A2A_METHODS.GET_LEADERBOARD, 0.08),
    generateA2AEndpoint(A2A_METHODS.GET_TRADE_HISTORY, 0.07),
    generateA2AEndpoint(A2A_METHODS.GET_CHATS, 0.05),
    generateA2AEndpoint(A2A_METHODS.GET_NOTIFICATIONS, 0.05),
    // Some writes
    generateA2AEndpoint(A2A_METHODS.CREATE_POST, 0.03),
    generateA2AEndpoint(A2A_METHODS.SHARE_ANALYSIS, 0.02),
  ]
};

/**
 * Heavy A2A load test: 200 agents, stress test all endpoints
 */
export const A2A_HEAVY_SCENARIO: LoadTestConfig = {
  concurrentUsers: 200,
  durationSeconds: 300,
  rampUpSeconds: 30,
  thinkTimeMs: 200,
  maxRps: 500,
  endpoints: [
    // Discovery & Info
    generateA2AEndpoint(A2A_METHODS.DISCOVER, 0.05),
    generateA2AEndpoint(A2A_METHODS.GET_INFO, 0.05),
    
    // Market Operations (30%)
    generateA2AEndpoint(A2A_METHODS.GET_MARKET_DATA, 0.08),
    generateA2AEndpoint(A2A_METHODS.GET_MARKET_PRICES, 0.07),
    generateA2AEndpoint(A2A_METHODS.GET_PREDICTIONS, 0.08),
    generateA2AEndpoint(A2A_METHODS.GET_POSITIONS, 0.07),
    
    // User & Profile (25%)
    generateA2AEndpoint(A2A_METHODS.GET_BALANCE, 0.10),
    generateA2AEndpoint(A2A_METHODS.GET_USER_WALLET, 0.05),
    generateA2AEndpoint(A2A_METHODS.GET_USER_PROFILE, 0.05),
    generateA2AEndpoint(A2A_METHODS.GET_USER_STATS, 0.05),
    
    // Social Features (20%)
    generateA2AEndpoint(A2A_METHODS.GET_FEED, 0.10),
    generateA2AEndpoint(A2A_METHODS.GET_FOLLOWERS, 0.05),
    generateA2AEndpoint(A2A_METHODS.GET_FOLLOWING, 0.05),
    
    // Chats & Notifications (10%)
    generateA2AEndpoint(A2A_METHODS.GET_CHATS, 0.05),
    generateA2AEndpoint(A2A_METHODS.GET_NOTIFICATIONS, 0.05),
    
    // System Stats (10%)
    generateA2AEndpoint(A2A_METHODS.GET_SYSTEM_STATS, 0.05),
    generateA2AEndpoint(A2A_METHODS.GET_LEADERBOARD, 0.05),
  ]
};

/**
 * Stress test: Test rate limiting with rapid requests
 * This should trigger rate limit errors (429)
 */
export const A2A_RATE_LIMIT_STRESS: LoadTestConfig = {
  concurrentUsers: 10, // 10 agents
  durationSeconds: 120,
  rampUpSeconds: 5,
  thinkTimeMs: 0, // No think time - rapid fire
  maxRps: 200, // 200 RPS total = 20 RPS per agent (should hit 100/min limit)
  endpoints: [
    generateA2AEndpoint(A2A_METHODS.GET_BALANCE, 0.50),
    generateA2AEndpoint(A2A_METHODS.GET_POSITIONS, 0.50),
  ]
};

/**
 * Multi-agent coalition stress test
 * Simulates multiple agents collaborating
 */
export const A2A_COALITION_STRESS: LoadTestConfig = {
  concurrentUsers: 50,
  durationSeconds: 180,
  rampUpSeconds: 20,
  thinkTimeMs: 500,
  endpoints: [
    // Coalition operations
    generateA2AEndpoint(A2A_METHODS.PROPOSE_COALITION, 0.10, 'agent-1'),
    generateA2AEndpoint(A2A_METHODS.JOIN_COALITION, 0.15, 'agent-2'),
    generateA2AEndpoint(A2A_METHODS.COALITION_MESSAGE, 0.30, 'agent-1'),
    generateA2AEndpoint(A2A_METHODS.SHARE_ANALYSIS, 0.25, 'agent-3'),
    generateA2AEndpoint(A2A_METHODS.REQUEST_ANALYSIS, 0.10, 'agent-2'),
    generateA2AEndpoint(A2A_METHODS.GET_ANALYSES, 0.10, 'agent-1'),
  ]
};

/**
 * All A2A test scenarios
 */
export const A2A_TEST_SCENARIOS = {
  LIGHT: A2A_LIGHT_SCENARIO,
  NORMAL: A2A_NORMAL_SCENARIO,
  HEAVY: A2A_HEAVY_SCENARIO,
  RATE_LIMIT: A2A_RATE_LIMIT_STRESS,
  COALITION: A2A_COALITION_STRESS,
} as const;

