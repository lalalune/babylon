/**
 * Babylon A2A Client
 * 
 * Official A2A SDK implementation using @a2a-js/sdk.
 * All interactions follow the official A2A protocol via message/send with Tasks and Messages.
 * Implements all Babylon features as official A2A Skills.
 */

import { A2AClient } from '@a2a-js/sdk/client'
import type { AgentCard, Message, Task, TextPart, DataPart, SendMessageResponse } from '@a2a-js/sdk'
import type { JsonValue } from '../../../src/types/a2a'

export interface BabylonA2AClientConfig {
  /** Base URL of Babylon server (e.g., http://localhost:3000) */
  baseUrl: string
  /** Agent wallet address */
  address: string
  /** Agent token ID from ERC-8004 registry */
  tokenId: number
  /** Private key for signing (optional, for authenticated requests) */
  privateKey?: string
  /** Babylon-issued API key for A2A server authentication */
  apiKey: string
}

/**
 * Official A2A Client for Babylon
 * 
 * Uses message/send to interact with Babylon's A2A server.
 * All operations are sent as Messages with Parts (TextPart, DataPart).
 */
export class BabylonA2AClient {
  private client?: A2AClient
  private clientPromise?: Promise<A2AClient>
  private config: BabylonA2AClientConfig
  private agentCard: AgentCard | null = null
  public agentId: string | null = null

  constructor(config: BabylonA2AClientConfig) {
    this.config = config
    this.agentId = `agent-${config.tokenId}-${config.address.slice(0, 8)}`
  }
  
  /**
   * Get or initialize the A2A client (lazy initialization)
   */
  private async getClient(): Promise<A2AClient> {
    if (this.client) {
      return this.client
    }
    
    if (!this.clientPromise) {
      const agentCardUrl = `${this.config.baseUrl}/.well-known/agent-card`
      this.clientPromise = A2AClient.fromCardUrl(agentCardUrl, {
        fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
          // Add authentication headers
          const headers = new Headers(init?.headers)
          headers.set('x-agent-id', this.agentId!)
          headers.set('x-agent-address', this.config.address)
          headers.set('x-agent-token-id', this.config.tokenId.toString())
          if (this.config.apiKey) {
            headers.set('x-babylon-api-key', this.config.apiKey)
          }
          return fetch(url, { ...init, headers })
        }
      })
    }
    
    this.client = await this.clientPromise
    return this.client
  }

  /**
   * Connect to Babylon and fetch agent card
   */
  async connect(): Promise<void> {
    try {
      // Initialize client
      const client = await this.getClient()
      
      // Get agent card
      this.agentCard = await (client as unknown as { agentCardPromise?: Promise<AgentCard> }).agentCardPromise || null

      // Verify connection by sending a test message
      await this.sendMessage('ping', { operation: 'stats.system', params: {} })
    } catch (error) {
      throw new Error(`Failed to connect to Babylon A2A: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Send a message to Babylon using official A2A protocol
   * 
   * @param text Text content of the message
   * @param command Structured command data (action + params)
   * @returns Task or Message response
   */
  async sendMessage(text: string, command: Record<string, unknown>): Promise<Task | Message> {
    if (!command || typeof command.operation !== 'string') {
      throw new Error('A2A command must include an operation string (e.g., "social.create_post", "markets.buy_shares")')
    }

    const structuredCommand = {
      operation: command.operation,
      params: command.params || {}
    }
    const parts: Array<TextPart | DataPart> = [
      {
        kind: 'text',
        text
      }
    ]

    parts.push({
      kind: 'data',
      data: structuredCommand
    })

    const message: Message = {
      kind: 'message',
      messageId: `msg-${Date.now()}-${Math.random()}`,
      role: 'user',
      parts,
      contextId: this.agentId || undefined
    }

    const client = await this.getClient()
    const response = await client.sendMessage({ message })

    if (client.isErrorResponse(response)) {
      throw new Error(`A2A Error [${response.error.code}]: ${response.error.message}`)
    }

    // Response can be either a Message or Task
    if ('task' in response.result) {
      return response.result.task
    } else if ('message' in response.result) {
      return response.result.message
    } else {
      // Fallback - check if result itself is a Task or Message
      const result = response.result as unknown
      if (result && typeof result === 'object' && 'kind' in result) {
        if (result.kind === 'task' || result.kind === 'message') {
          return result as Task | Message
        }
      }
      throw new Error('Unexpected response format')
    }
  }

  // normalizeCommand removed - now using operation/params format directly

  /**
   * Get task status
   */
  async getTask(taskId: string): Promise<Task> {
    const client = await this.getClient()
    const response = await client.getTask({ taskId })

    if (client.isErrorResponse(response)) {
      throw new Error(`A2A Error [${response.error.code}]: ${response.error.message}`)
    }

    return response.result.task
  }

  /**
   * Wait for task to complete and return final result
   */
  async waitForTask(taskId: string, maxWaitMs: number = 30000): Promise<Task> {
    const startTime = Date.now()
    const pollInterval = 1000

    while (Date.now() - startTime < maxWaitMs) {
      const task = await this.getTask(taskId)
      
      if (task.status.state === 'completed' || task.status.state === 'failed' || task.status.state === 'canceled') {
        return task
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }

    throw new Error(`Task ${taskId} did not complete within ${maxWaitMs}ms`)
  }

  /**
   * Extract result from task artifacts or messages
   */
  private extractResult(taskOrMessage: Task | Message): Record<string, JsonValue> {
    if (taskOrMessage.kind === 'task') {
      // It's a Task
      const task = taskOrMessage as Task
      if (task.artifacts && task.artifacts.length > 0) {
        // Extract from artifacts
        const artifact = task.artifacts[0]
        if (artifact.parts) {
          for (const part of artifact.parts) {
            if (part.kind === 'data') {
              return (part as DataPart).data as Record<string, JsonValue>
            }
          }
        }
      }
      // Check last message in history
      if (task.history && task.history.length > 0) {
        const lastMessage = task.history[task.history.length - 1]
        if (lastMessage.parts) {
          for (const part of lastMessage.parts) {
            if (part.kind === 'data') {
              return (part as DataPart).data as Record<string, JsonValue>
            }
          }
        }
      }
      // Check status message
      if (task.status?.message?.parts) {
        for (const part of task.status.message.parts) {
          if (part.kind === 'data') {
            return (part as DataPart).data as Record<string, unknown>
          }
        }
      }
      return {}
    } else {
      // It's a Message
      const message = taskOrMessage as Message
      if (message.parts) {
        for (const part of message.parts) {
          if (part.kind === 'data') {
            return (part as DataPart).data as Record<string, unknown>
          }
        }
      }
      return {}
    }
  }

  // ===== Trading Methods (via message/send) =====

  /**
   * Buy prediction market shares
   * NOTE: This operation is not yet supported by the executor
   * The executor currently only supports: social.create_post, social.get_feed, markets.list_prediction, users.search, stats.system, stats.leaderboard
   */
  async buyShares(marketId: string, outcome: 'YES' | 'NO', amount: number): Promise<Record<string, JsonValue>> {
    throw new Error('markets.buy_shares operation not yet supported by executor. Only basic operations are available.')
  }

  /**
   * Sell prediction market shares
   */
  async sellShares(positionId: string, shares: number): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Sell ${shares} shares from position ${positionId}`,
      {
        operation: 'markets.sell_shares',
        params: {
          positionId,
          shares
        }
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Open perpetual position
   */
  async openPosition(ticker: string, side: 'LONG' | 'SHORT', amount: number, leverage: number): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Open ${side} position on ${ticker} with $${amount} at ${leverage}x leverage`,
      {
        operation: 'markets.open_perp_position',
        params: {
          ticker,
          side,
          amount,
          leverage
        }
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Close perpetual position
   */
  async closePosition(positionId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Close position ${positionId}`,
      {
        operation: 'markets.close_perp_position',
        params: {
          positionId
        }
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Get predictions (query skill)
   * SUPPORTED: Uses markets.list_prediction operation
   */
  async getPredictions(params?: { userId?: string; status?: 'active' | 'resolved' }): Promise<{ predictions: Array<Record<string, unknown>> }> {
    const response = await this.sendMessage(
      'What prediction markets are available?',
      {
        operation: 'markets.list_prediction',
        params: params || {}
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { predictions: result.predictions as Array<Record<string, unknown>> || [] }
    }

    const result = this.extractResult(response)
    return { predictions: result.predictions as Array<Record<string, unknown>> || [] }
  }

  /**
   * Get perpetuals (query skill)
   */
  async getPerpetuals(): Promise<{ perpetuals: Array<Record<string, unknown>> }> {
    const response = await this.sendMessage(
      'What perpetual futures markets are available?',
      {
        operation: 'markets.list_perpetuals',
        params: {}
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { perpetuals: result.perpetuals as Array<Record<string, unknown>> || [] }
    }

    const result = this.extractResult(response)
    return { perpetuals: result.perpetuals as Array<Record<string, unknown>> || [] }
  }

  /**
   * Get all markets
   */
  async getMarkets(): Promise<{ predictions: Array<Record<string, unknown>>; perps: Array<Record<string, unknown>> }> {
    const [predictions, perps] = await Promise.all([
      this.getPredictions({ status: 'active' }),
      this.getPerpetuals()
    ])
    return {
      predictions: predictions.predictions || [],
      perps: perps.perpetuals || []
    }
  }

  /**
   * Get balance (query skill)
   */
  async getBalance(): Promise<{ balance: number }> {
    const response = await this.sendMessage(
      'What is my current balance?',
      {
        operation: 'portfolio.get_balance',
        params: {}
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { balance: result.balance as number || 0 }
    }

    const result = this.extractResult(response)
    return { balance: result.balance as number || 0 }
  }

  /**
   * Get positions (query skill)
   */
  async getPositions(userId?: string): Promise<{ perpPositions: Array<Record<string, unknown>>; totalPnL: number }> {
    const response = await this.sendMessage(
      userId ? `What are user ${userId}'s positions?` : 'What are my current positions?',
      {
        operation: 'portfolio.get_positions',
        params: userId ? { userId } : {}
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return {
        perpPositions: result.perpPositions as Array<Record<string, unknown>> || [],
        totalPnL: result.totalPnL as number || 0
      }
    }

    const result = this.extractResult(response)
    return {
      perpPositions: result.perpPositions as Array<Record<string, unknown>> || [],
      totalPnL: result.totalPnL as number || 0
    }
  }

  /**
   * Get portfolio (combines balance and positions)
   */
  async getPortfolio(): Promise<{ balance: number; positions: Array<Record<string, unknown>>; pnl: number }> {
    const [balance, positions] = await Promise.all([
      this.getBalance(),
      this.getPositions()
    ])

    return {
      balance: balance.balance,
      positions: positions.perpPositions || [],
      pnl: positions.totalPnL || 0
    }
  }

  /**
   * Get feed (query skill)
   * SUPPORTED: Uses social.get_feed operation
   */
  async getFeed(params?: { limit?: number; offset?: number; following?: boolean; type?: 'post' | 'article' }): Promise<{ posts: Array<Record<string, unknown>> }> {
    const response = await this.sendMessage(
      'Show me recent posts from the feed',
      {
        operation: 'social.get_feed',
        params: params || {}
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { posts: result.posts as Array<Record<string, unknown>> || [] }
    }

    const result = this.extractResult(response)
    return { posts: result.posts as Array<Record<string, unknown>> || [] }
  }

  /**
   * Create post (action skill)
   * SUPPORTED: Uses social.create_post operation
   */
  async createPost(content: string, type: 'post' | 'article' = 'post'): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Post: ${content}`,
      {
        operation: 'social.create_post',
        params: {
          content,
          type
        }
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Create comment (action skill)
   */
  async createComment(postId: string, content: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Comment on post ${postId}: ${content}`,
      {
        operation: 'social.create_comment',
        params: {
          postId,
          content
        }
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Like post (action skill)
   */
  async likePost(postId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Like post ${postId}`,
      {
        operation: 'social.like_post',
        params: {
          postId
        }
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Send message (action skill)
   */
  async sendMessageToChat(chatId: string, content: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Send message to chat ${chatId}: ${content}`,
      {
        skill: 'direct-messenger',
        action: 'send_message',
        chatId,
        content
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Get chats (query skill)
   */
  async getChats(filter?: 'all' | 'dms' | 'groups'): Promise<{ chats: Array<Record<string, unknown>> }> {
    const response = await this.sendMessage(
      'What are my chats?',
      {
        skill: 'direct-messenger',
        action: 'get_chats',
        filter
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { chats: result.chats as Array<Record<string, unknown>> || [] }
    }

    const result = this.extractResult(response)
    return { chats: result.chats as Array<Record<string, unknown>> || [] }
  }

  /**
   * Get notifications (query skill)
   */
  async getNotifications(limit?: number): Promise<{ notifications: Array<Record<string, unknown>> }> {
    const response = await this.sendMessage(
      'What are my notifications?',
      {
        skill: 'notification-manager',
        action: 'get_notifications',
        limit
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { notifications: result.notifications as Array<Record<string, unknown>> || [] }
    }

    const result = this.extractResult(response)
    return { notifications: result.notifications as Array<Record<string, unknown>> || [] }
  }

  /**
   * Get leaderboard (query skill)
   * SUPPORTED: Uses stats.leaderboard operation
   */
  async getLeaderboard(params?: {
    page?: number
    pageSize?: number
    pointsType?: 'all' | 'earned' | 'referral'
    minPoints?: number
    limit?: number
  }): Promise<{ leaderboard: Array<Record<string, unknown>> }> {
    const response = await this.sendMessage(
      'Show me the leaderboard',
      {
        operation: 'stats.leaderboard',
        params: params || {}
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { leaderboard: result.leaderboard as Array<Record<string, unknown>> || [] }
    }

    const result = this.extractResult(response)
    return { leaderboard: result.leaderboard as Array<Record<string, unknown>> || [] }
  }

  /**
   * Get user profile (query skill)
   */
  async getUserProfile(userId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Show me user ${userId}'s profile`,
      {
        skill: 'profile-manager',
        action: 'get_user_profile',
        userId
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Get system stats (query skill)
   * SUPPORTED: Uses stats.system operation
   */
  async getSystemStats(): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      'What are the system statistics?',
      {
        operation: 'stats.system',
        params: {}
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Get reputation (query skill)
   */
  async getReputation(userId?: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      userId ? `What is user ${userId}'s reputation?` : 'What is my reputation?',
      {
        skill: 'stats-researcher',
        action: 'get_reputation',
        userId
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Get trending tags (query skill)
   */
  async getTrendingTags(limit?: number): Promise<{ tags: Array<Record<string, unknown>> }> {
    const response = await this.sendMessage(
      'What topics are trending?',
      {
        skill: 'stats-researcher',
        action: 'get_trending_tags',
        limit
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { tags: result.tags as Array<Record<string, unknown>> || [] }
    }

    const result = this.extractResult(response)
    return { tags: result.tags as Array<Record<string, unknown>> || [] }
  }

  /**
   * Get organizations (query skill)
   */
  async getOrganizations(limit?: number): Promise<{ organizations: Array<Record<string, unknown>> }> {
    const response = await this.sendMessage(
      'What organizations/perpetual markets are available?',
      {
        skill: 'market-researcher',
        action: 'get_organizations',
        limit
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { organizations: result.organizations as Array<Record<string, unknown>> || [] }
    }

    const result = this.extractResult(response)
    return { organizations: result.organizations as Array<Record<string, unknown>> || [] }
  }

  /**
   * Search users (query skill)
   * SUPPORTED: Uses users.search operation
   */
  async searchUsers(query: string, limit?: number): Promise<{ users: Array<Record<string, unknown>> }> {
    const response = await this.sendMessage(
      `Search for users: ${query}`,
      {
        operation: 'users.search',
        params: {
          query,
          limit
        }
      }
    )

    if ('status' in response) {
      const task = await this.waitForTask(response.id)
      const result = this.extractResult(task)
      return { users: result.users as Array<Record<string, unknown>> || [] }
    }

    const result = this.extractResult(response)
    return { users: result.users as Array<Record<string, unknown>> || [] }
  }

  /**
   * Follow user (action skill)
   */
  async followUser(userId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Follow user ${userId}`,
      {
        skill: 'user-relationship-manager',
        action: 'follow_user',
        userId
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  /**
   * Unfollow user (action skill)
   */
  async unfollowUser(userId: string): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Unfollow user ${userId}`,
      {
        skill: 'user-relationship-manager',
        action: 'unfollow_user',
        userId
      }
    )

    if (response.kind === 'task') {
      const task = response as Task
      if (task.status.state !== 'completed' && task.status.state !== 'failed' && task.status.state !== 'canceled') {
        const completedTask = await this.waitForTask(task.id)
        return this.extractResult(completedTask)
      }
      return this.extractResult(task)
    }
    
    return this.extractResult(response)
  }

  // Moderation Operations

  /**
   * Block a user
   */
  async blockUser(params: { userId: string; reason?: string }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Block user ${params.userId}`,
      {
        operation: 'moderation.block_user',
        params
      }
    )

    return this.extractResult(response)
  }

  /**
   * Unblock a user
   */
  async unblockUser(params: { userId: string }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Unblock user ${params.userId}`,
      {
        operation: 'moderation.unblock_user',
        params
      }
    )

    return this.extractResult(response)
  }

  /**
   * Mute a user
   */
  async muteUser(params: { userId: string; reason?: string }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Mute user ${params.userId}`,
      {
        operation: 'moderation.mute_user',
        params
      }
    )

    return this.extractResult(response)
  }

  /**
   * Unmute a user
   */
  async unmuteUser(params: { userId: string }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Unmute user ${params.userId}`,
      {
        operation: 'moderation.unmute_user',
        params
      }
    )

    return this.extractResult(response)
  }

  /**
   * Report a user
   */
  async reportUser(params: {
    userId: string;
    category: string;
    reason: string;
    evidence?: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Report user ${params.userId} for ${params.category}`,
      {
        operation: 'moderation.report_user',
        params
      }
    )

    return this.extractResult(response)
  }

  /**
   * Report a post
   */
  async reportPost(params: {
    postId: string;
    category: string;
    reason: string;
    evidence?: string;
  }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Report post ${params.postId} for ${params.category}`,
      {
        operation: 'moderation.report_post',
        params
      }
    )

    return this.extractResult(response)
  }

  /**
   * Get list of blocked users
   */
  async getBlocks(params?: { limit?: number; offset?: number }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      'Get my blocked users list',
      {
        operation: 'moderation.get_blocks',
        params: params || {}
      }
    )

    return this.extractResult(response)
  }

  /**
   * Get list of muted users
   */
  async getMutes(params?: { limit?: number; offset?: number }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      'Get my muted users list',
      {
        operation: 'moderation.get_mutes',
        params: params || {}
      }
    )

    return this.extractResult(response)
  }

  /**
   * Check if a user is blocked
   */
  async checkBlockStatus(params: { userId: string }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Check if user ${params.userId} is blocked`,
      {
        operation: 'moderation.check_block_status',
        params
      }
    )

    return this.extractResult(response)
  }

  /**
   * Check if a user is muted
   */
  async checkMuteStatus(params: { userId: string }): Promise<Record<string, JsonValue>> {
    const response = await this.sendMessage(
      `Check if user ${params.userId} is muted`,
      {
        operation: 'moderation.check_mute_status',
        params
      }
    )

    return this.extractResult(response)
  }

  /**
   * Disconnect (cleanup)
   */
  async disconnect(): Promise<void> {
    // No-op for HTTP client, but kept for API compatibility
  }
}

