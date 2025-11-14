/**
 * Babylon A2A Client
 * 
 * HTTP client for Babylon A2A protocol
 * Simplified wrapper around A2A JSON-RPC 2.0
 */

import { Wallet } from 'ethers'

export interface A2AClientConfig {
  apiUrl: string  // Changed from wsUrl to apiUrl
  address: string
  tokenId: number
  privateKey: string
}

export class BabylonA2AClient {
  private config: A2AClientConfig
  private messageId = 1
  public sessionToken: string | null = null
  public agentId: string | null = null

  constructor(config: A2AClientConfig) {
    this.config = config
  }

  /**
   * Connect to Babylon A2A and authenticate
   */
  async connect(): Promise<void> {
    // For HTTP-based A2A, authentication happens via headers
    // Set agentId from config
    this.agentId = `agent-${this.config.tokenId}-${this.config.address.slice(0, 8)}`
    this.sessionToken = `session-${Date.now()}`
    
    // Verify connection by testing balance endpoint
    await this.getBalance()
  }

  /**
   * Send JSON-RPC request via HTTP
   */
  private async sendRequest<T = any>(method: string, params?: any): Promise<T> {
    const id = this.messageId++
    const request = {
      jsonrpc: '2.0',
      method,
      params,
      id
    }

    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': this.agentId || `agent-${this.config.tokenId}`,
        'x-agent-address': this.config.address,
        'x-agent-token-id': this.config.tokenId.toString()
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`HTTP ${response.status}: ${text}`)
    }

    const text = await response.text()
    const data = JSON.parse(text)
    
    if (data.error) {
      throw new Error(data.error.message)
    }
    
    return data.result
  }

  /**
   * Get balance
   */
  async getBalance(): Promise<{ balance: number }> {
    return await this.sendRequest('a2a.getBalance')
  }

  /**
   * Get portfolio (balance, positions, P&L)
   */
  async getPortfolio(): Promise<{ balance: number; positions: any[]; pnl: number }> {
    const balance = await this.getBalance()
    const positions = await this.sendRequest('a2a.getPositions', { userId: this.agentId })
    
    return {
      balance: balance.balance,
      positions: positions.perpPositions,
      pnl: positions.totalPnL
    }
  }

  /**
   * Get available markets
   */
  async getMarkets(): Promise<{ predictions: any[]; perps: any[] }> {
    const predictions = await this.sendRequest('a2a.getPredictions', { status: 'active' })
    const perps = await this.sendRequest('a2a.getPerpetuals', {})
    
    return {
      predictions: predictions.predictions,
      perps: perps.perpetuals
    }
  }

  /**
   * Get prediction markets
   */
  async getPredictions(status: string = 'active'): Promise<any> {
    return await this.sendRequest('a2a.getPredictions', { status })
  }

  /**
   * Get perpetual markets
   */
  async getPerpetuals(): Promise<any> {
    return await this.sendRequest('a2a.getPerpetuals', {})
  }

  /**
   * Get recent feed posts
   */
  async getFeed(limit = 20): Promise<{ posts: any[] }> {
    const feed = await this.sendRequest('a2a.getFeed', { limit, offset: 0 })
    
    return {
      posts: feed.posts
    }
  }

  /**
   * Buy shares in prediction market
   */
  async buyShares(marketId: string, outcome: 'YES' | 'NO', amount: number): Promise<any> {
    return await this.sendRequest('a2a.buyShares', { marketId, outcome, amount })
  }

  /**
   * Sell shares from prediction market
   */
  async sellShares(marketId: string, shares: number): Promise<any> {
    return await this.sendRequest('a2a.sellShares', { marketId, shares })
  }

  /**
   * Open perp position
   */
  async openPosition(ticker: string, side: 'long' | 'short', size: number, leverage: number): Promise<any> {
    return await this.sendRequest('a2a.openPosition', { ticker, side, size, leverage })
  }

  /**
   * Close perp position
   */
  async closePosition(positionId: string): Promise<any> {
    return await this.sendRequest('a2a.closePosition', { positionId })
  }

  /**
   * Create post
   */
  async createPost(content: string, type: string = 'post'): Promise<any> {
    return await this.sendRequest('a2a.createPost', { content, type })
  }

  /**
   * Create comment
   */
  async createComment(postId: string, content: string): Promise<any> {
    return await this.sendRequest('a2a.createComment', { postId, content })
  }

  // ===== Additional Social Methods =====

  /**
   * Get a single post
   */
  async getPost(postId: string): Promise<any> {
    return await this.sendRequest('a2a.getPost', { postId })
  }

  /**
   * Delete post
   */
  async deletePost(postId: string): Promise<any> {
    return await this.sendRequest('a2a.deletePost', { postId })
  }

  /**
   * Like a post
   */
  async likePost(postId: string): Promise<any> {
    return await this.sendRequest('a2a.likePost', { postId })
  }

  /**
   * Unlike a post
   */
  async unlikePost(postId: string): Promise<any> {
    return await this.sendRequest('a2a.unlikePost', { postId })
  }

  /**
   * Share/repost a post
   */
  async sharePost(postId: string, content: string = ''): Promise<any> {
    return await this.sendRequest('a2a.sharePost', { postId, content })
  }

  /**
   * Get comments for a post
   */
  async getComments(postId: string, limit = 20, offset = 0): Promise<any> {
    return await this.sendRequest('a2a.getComments', { postId, limit, offset })
  }

  /**
   * Delete comment
   */
  async deleteComment(commentId: string): Promise<any> {
    return await this.sendRequest('a2a.deleteComment', { commentId })
  }

  /**
   * Like a comment
   */
  async likeComment(commentId: string): Promise<any> {
    return await this.sendRequest('a2a.likeComment', { commentId })
  }

  // ===== User Management Methods =====

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<any> {
    return await this.sendRequest('a2a.getUserProfile', { userId })
  }

  /**
   * Update own profile
   */
  async updateProfile(updates: { bio?: string; avatar?: string; displayName?: string }): Promise<any> {
    return await this.sendRequest('a2a.updateProfile', updates)
  }

  /**
   * Follow a user
   */
  async followUser(userId: string): Promise<any> {
    return await this.sendRequest('a2a.followUser', { userId })
  }

  /**
   * Unfollow a user
   */
  async unfollowUser(userId: string): Promise<any> {
    return await this.sendRequest('a2a.unfollowUser', { userId })
  }

  /**
   * Get user's followers
   */
  async getFollowers(userId: string, limit = 20, offset = 0): Promise<any> {
    return await this.sendRequest('a2a.getFollowers', { userId, limit, offset })
  }

  /**
   * Get users that a user follows
   */
  async getFollowing(userId: string, limit = 20, offset = 0): Promise<any> {
    return await this.sendRequest('a2a.getFollowing', { userId, limit, offset })
  }

  /**
   * Search users
   */
  async searchUsers(query: string, limit = 20): Promise<any> {
    return await this.sendRequest('a2a.searchUsers', { query, limit })
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<any> {
    return await this.sendRequest('a2a.getUserStats', { userId })
  }

  // ===== Market Methods =====

  /**
   * Get market data
   */
  async getMarketData(marketId: string): Promise<any> {
    return await this.sendRequest('a2a.getMarketData', { marketId })
  }

  /**
   * Get market prices
   */
  async getMarketPrices(marketId: string): Promise<any> {
    return await this.sendRequest('a2a.getMarketPrices', { marketId })
  }

  /**
   * Subscribe to market updates
   */
  async subscribeMarket(marketId: string): Promise<any> {
    return await this.sendRequest('a2a.subscribeMarket', { marketId })
  }

  /**
   * Get trade history
   */
  async getTradeHistory(userId: string = this.agentId!, limit = 20, offset = 0): Promise<any> {
    return await this.sendRequest('a2a.getTradeHistory', { userId, limit, offset })
  }

  /**
   * Get recent trades
   */
  async getTrades(marketId: string, limit = 20): Promise<any> {
    return await this.sendRequest('a2a.getTrades', { marketId, limit })
  }

  // ===== Chat & Messaging Methods =====

  /**
   * Get user's chats
   */
  async getChats(limit = 20, offset = 0): Promise<any> {
    return await this.sendRequest('a2a.getChats', { limit, offset })
  }

  /**
   * Get chat messages
   */
  async getChatMessages(chatId: string, limit = 50, offset = 0): Promise<any> {
    return await this.sendRequest('a2a.getChatMessages', { chatId, limit, offset })
  }

  /**
   * Send a message in a chat
   */
  async sendMessage(chatId: string, content: string): Promise<any> {
    return await this.sendRequest('a2a.sendMessage', { chatId, content })
  }

  /**
   * Create a group chat
   */
  async createGroup(name: string, memberIds: string[]): Promise<any> {
    return await this.sendRequest('a2a.createGroup', { name, memberIds })
  }

  /**
   * Leave a chat
   */
  async leaveChat(chatId: string): Promise<any> {
    return await this.sendRequest('a2a.leaveChat', { chatId })
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(): Promise<any> {
    return await this.sendRequest('a2a.getUnreadCount', {})
  }

  // ===== Notification Methods =====

  /**
   * Get notifications
   */
  async getNotifications(limit = 20, offset = 0): Promise<any> {
    return await this.sendRequest('a2a.getNotifications', { limit, offset })
  }

  /**
   * Mark notifications as read
   */
  async markNotificationsRead(notificationIds: string[]): Promise<any> {
    return await this.sendRequest('a2a.markNotificationsRead', { notificationIds })
  }

  /**
   * Get group invites
   */
  async getGroupInvites(): Promise<any> {
    return await this.sendRequest('a2a.getGroupInvites', {})
  }

  /**
   * Accept group invite
   */
  async acceptGroupInvite(inviteId: string): Promise<any> {
    return await this.sendRequest('a2a.acceptGroupInvite', { inviteId })
  }

  /**
   * Decline group invite
   */
  async declineGroupInvite(inviteId: string): Promise<any> {
    return await this.sendRequest('a2a.declineGroupInvite', { inviteId })
  }

  // ===== Pool Methods =====

  /**
   * Get available pools
   */
  async getPools(status: string = ''): Promise<any> {
    return await this.sendRequest('a2a.getPools', { status })
  }

  /**
   * Get pool information
   */
  async getPoolInfo(poolId: string): Promise<any> {
    return await this.sendRequest('a2a.getPoolInfo', { poolId })
  }

  /**
   * Deposit to a pool
   */
  async depositToPool(poolId: string, amount: number): Promise<any> {
    return await this.sendRequest('a2a.depositToPool', { poolId, amount })
  }

  /**
   * Withdraw from a pool
   */
  async withdrawFromPool(poolId: string, shares: number): Promise<any> {
    return await this.sendRequest('a2a.withdrawFromPool', { poolId, shares })
  }

  /**
   * Get pool deposits
   */
  async getPoolDeposits(userId: string = this.agentId!): Promise<any> {
    return await this.sendRequest('a2a.getPoolDeposits', { userId })
  }

  // ===== Leaderboard & Stats Methods =====

  /**
   * Get leaderboard
   */
  async getLeaderboard(timeframe: 'day' | 'week' | 'month' | 'all' = 'all', limit = 20): Promise<any> {
    return await this.sendRequest('a2a.getLeaderboard', { timeframe, limit })
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<any> {
    return await this.sendRequest('a2a.getSystemStats', {})
  }

  // ===== Referral Methods =====

  /**
   * Get referral code
   */
  async getReferralCode(): Promise<any> {
    return await this.sendRequest('a2a.getReferralCode', {})
  }

  /**
   * Get referrals
   */
  async getReferrals(): Promise<any> {
    return await this.sendRequest('a2a.getReferrals', {})
  }

  /**
   * Get referral statistics
   */
  async getReferralStats(): Promise<any> {
    return await this.sendRequest('a2a.getReferralStats', {})
  }

  // ===== Reputation Methods =====

  /**
   * Get reputation
   */
  async getReputation(userId: string = this.agentId!): Promise<any> {
    return await this.sendRequest('a2a.getReputation', { userId })
  }

  /**
   * Get reputation breakdown
   */
  async getReputationBreakdown(userId: string = this.agentId!): Promise<any> {
    return await this.sendRequest('a2a.getReputationBreakdown', { userId })
  }

  // ===== Discovery Methods =====

  /**
   * Discover other agents
   */
  async discoverAgents(filters: { strategies?: string[]; markets?: string[] } = {}): Promise<any> {
    return await this.sendRequest('a2a.discover', filters)
  }

  /**
   * Get agent info
   */
  async getAgentInfo(agentId: string): Promise<any> {
    return await this.sendRequest('a2a.getInfo', { agentId })
  }

  /**
   * Get trending tags
   */
  async getTrendingTags(limit = 10): Promise<any> {
    return await this.sendRequest('a2a.getTrendingTags', { limit })
  }

  /**
   * Get posts by tag
   */
  async getPostsByTag(tag: string, limit = 20, offset = 0): Promise<any> {
    return await this.sendRequest('a2a.getPostsByTag', { tag, limit, offset })
  }

  /**
   * Get organizations
   */
  async getOrganizations(): Promise<any> {
    return await this.sendRequest('a2a.getOrganizations', {})
  }

  // ===== Coalition Methods =====

  /**
   * Propose a coalition
   */
  async proposeCoalition(name: string, members: string[], strategy: string): Promise<any> {
    return await this.sendRequest('a2a.proposeCoalition', { name, members, strategy })
  }

  /**
   * Join a coalition
   */
  async joinCoalition(coalitionId: string): Promise<any> {
    return await this.sendRequest('a2a.joinCoalition', { coalitionId })
  }

  /**
   * Send coalition message
   */
  async coalitionMessage(coalitionId: string, content: string): Promise<any> {
    return await this.sendRequest('a2a.coalitionMessage', { coalitionId, content })
  }

  /**
   * Leave a coalition
   */
  async leaveCoalition(coalitionId: string): Promise<any> {
    return await this.sendRequest('a2a.leaveCoalition', { coalitionId })
  }

  // ===== Analysis Sharing Methods =====

  /**
   * Share analysis
   */
  async shareAnalysis(marketId: string, analysis: string, confidence: number): Promise<any> {
    return await this.sendRequest('a2a.shareAnalysis', { marketId, analysis, confidence })
  }

  /**
   * Request analysis
   */
  async requestAnalysis(marketId: string, reward: number = 0): Promise<any> {
    return await this.sendRequest('a2a.requestAnalysis', { marketId, reward })
  }

  /**
   * Get analyses
   */
  async getAnalyses(marketId: string, limit = 10): Promise<any> {
    return await this.sendRequest('a2a.getAnalyses', { marketId, limit })
  }

  // ===== x402 Payment Methods =====

  /**
   * Create payment request
   */
  async paymentRequest(amount: string, recipient: string, description: string): Promise<any> {
    return await this.sendRequest('a2a.paymentRequest', { amount, recipient, description })
  }

  /**
   * Send payment receipt
   */
  async paymentReceipt(paymentId: string, txHash: string): Promise<any> {
    return await this.sendRequest('a2a.paymentReceipt', { paymentId, txHash })
  }

  /**
   * Disconnect (cleanup - not needed for HTTP but kept for API compatibility)
   */
  async disconnect(): Promise<void> {
    // No-op for HTTP client
  }
}

