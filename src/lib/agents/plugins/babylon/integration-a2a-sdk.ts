/**
 * Babylon Plugin Integration Service - A2A SDK
 * 
 * Babylon A2A client implementation using @a2a-js/sdk
 */

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { agentWalletService } from '@/lib/agents/identity/AgentWalletService'
import { A2AClient } from '@a2a-js/sdk/client'
import type { Task, Message } from '@a2a-js/sdk'
import type { BabylonRuntime } from './types'
import type { AgentRuntime, Plugin } from '@elizaos/core'

function shouldAutoProvisionWallets(): boolean {
  return process.env.AUTO_CREATE_AGENT_WALLETS !== 'false'
}

/**
 * Initialize A2A SDK client for an agent
 */
async function initializeA2ASdkClient(
  agentUserId: string
): Promise<A2AClient> {
  const agent = await prisma.user.findUnique({
    where: { id: agentUserId }
  })

  if (!agent || !agent.isAgent) {
    throw new Error(`Agent user ${agentUserId} not found or not an agent`)
  }

  let walletAddress = agent.walletAddress

  if (!walletAddress && shouldAutoProvisionWallets()) {
    try {
      const walletResult = await agentWalletService.createAgentEmbeddedWallet(agentUserId)
      walletAddress = walletResult.walletAddress
      logger.info('Auto-provisioned embedded wallet for agent', {
        agentUserId,
        walletAddress
      }, 'BabylonIntegration')
    } catch (error) {
      logger.warn('Failed to auto-provision wallet for agent', {
        agentUserId,
        error: error instanceof Error ? error.message : String(error)
      }, 'BabylonIntegration')
    }
  }

  // Wallet is optional - A2A works without it (just won't have ERC-8004 headers)
  if (!walletAddress) {
    logger.info(
      'Agent has no wallet address - A2A will work without ERC-8004 headers',
      { agentUserId },
      'BabylonIntegration'
    )
  }

  // Get A2A endpoint URL - prioritize BABYLON_A2A_ENDPOINT, fallback to NEXT_PUBLIC_APP_URL
  const baseUrl = process.env.BABYLON_A2A_ENDPOINT || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const agentCardUrl = `${baseUrl}/.well-known/agent-card.json`

  logger.info('Initializing A2A client', {
    agentUserId,
    agentCardUrl,
    baseUrl,
    hasWallet: !!walletAddress
  }, 'BabylonIntegration')

  // Create A2A client from Agent Card URL
  // Use default fetch - authentication will be handled by server via headers
  // The SDK will handle standard A2A methods, extensions will use custom headers
  const a2aClient = await A2AClient.fromCardUrl(agentCardUrl)

  logger.info('✅ A2A SDK client created', { 
    agentUserId, 
    agentName: agent.displayName,
    agentCardUrl
  })

  return a2aClient
}

/**
 * Babylon A2A Client - uses message/send with skills
 * Converts a2a.* method calls to A2A protocol
 */
export class BabylonA2AClient {
  public readonly agentId: string
  private sdkClient: A2AClient
  // Stored for potential future use (ERC-8004 headers, etc.)
  // Prefixed with _ to indicate intentionally unused
  // @ts-expect-error - Intentionally unused, stored for future use
  private readonly _agentAddress?: string
  // @ts-expect-error - Intentionally unused, stored for future use
  private readonly _agentTokenId?: number

  constructor(sdkClient: A2AClient, agentId: string, agentAddress?: string, agentTokenId?: number) {
    this.sdkClient = sdkClient
    this._agentAddress = agentAddress
    this._agentTokenId = agentTokenId
    // These are intentionally unused but stored for potential future use
    this.agentId = agentId
    // agentAddress and agentTokenId stored for potential future use (ERC-8004 headers, etc.)
  }

  /**
   * Check if client is connected (always true for HTTP client)
   */
  isConnected(): boolean {
    return true
  }

  /**
   * Execute via A2A message/send with skills
   * Maps a2a.* methods to A2A protocol
   */
  private async executeViaA2A(
    action: string,
    params: Record<string, unknown>
  ): Promise<unknown> {
    // Map action to skill ID - comprehensive mapping for all 69+ A2A methods
    const skillMap: Record<string, string> = {
      // Portfolio & Balance
      'getBalance': 'portfolio-balance',
      'getPositions': 'portfolio-balance',
      'getUserWallet': 'portfolio-balance',
      'transferPoints': 'portfolio-balance',
      // Prediction Markets
      'getPredictions': 'prediction-markets',
      'buyShares': 'prediction-markets',
      'sellShares': 'prediction-markets',
      'getTrades': 'prediction-markets',
      'getTradeHistory': 'prediction-markets',
      // Perpetual Futures
      'getPerpetuals': 'perpetual-futures',
      'openPosition': 'perpetual-futures',
      'closePosition': 'perpetual-futures',
      // Market Data
      'getMarketData': 'prediction-markets',
      'getMarketPrices': 'prediction-markets',
      'subscribeMarket': 'prediction-markets',
      // Social Feed
      'getFeed': 'social-feed',
      'getPost': 'social-feed',
      'createPost': 'social-feed',
      'deletePost': 'social-feed',
      'likePost': 'social-feed',
      'unlikePost': 'social-feed',
      'sharePost': 'social-feed',
      'getComments': 'social-feed',
      'createComment': 'social-feed',
      'deleteComment': 'social-feed',
      'likeComment': 'social-feed',
      // User Management
      'getUserProfile': 'user-social-graph',
      'updateProfile': 'user-social-graph',
      'followUser': 'user-social-graph',
      'unfollowUser': 'user-social-graph',
      'getFollowers': 'user-social-graph',
      'getFollowing': 'user-social-graph',
      'searchUsers': 'user-social-graph',
      'favoriteProfile': 'user-social-graph',
      'unfavoriteProfile': 'user-social-graph',
      'getFavorites': 'user-social-graph',
      'getFavoritePosts': 'user-social-graph',
      // Messaging
      'getChats': 'messaging-chats',
      'getChatMessages': 'messaging-chats',
      'sendMessage': 'messaging-chats',
      'createGroup': 'messaging-chats',
      'leaveChat': 'messaging-chats',
      'getUnreadCount': 'messaging-chats',
      // Notifications
      'getNotifications': 'messaging-chats',
      'markNotificationsRead': 'messaging-chats',
      'getGroupInvites': 'messaging-chats',
      'acceptGroupInvite': 'messaging-chats',
      'declineGroupInvite': 'messaging-chats',
      // Stats & Discovery
      'getLeaderboard': 'stats-discovery',
      'getUserStats': 'stats-discovery',
      'getSystemStats': 'stats-discovery',
      'getReferrals': 'stats-discovery',
      'getReferralStats': 'stats-discovery',
      'getReferralCode': 'stats-discovery',
      'getReputation': 'stats-discovery',
      'getReputationBreakdown': 'stats-discovery',
      'getTrendingTags': 'stats-discovery',
      'getPostsByTag': 'stats-discovery',
      'getOrganizations': 'stats-discovery',
      // Agent Discovery
      'discoverAgents': 'stats-discovery',
      'getAgentInfo': 'stats-discovery',
      // Payments
      'paymentRequest': 'portfolio-balance',
      'paymentReceipt': 'portfolio-balance',
      // Moderation
      'blockUser': 'user-social-graph',
      'unblockUser': 'user-social-graph',
      'muteUser': 'user-social-graph',
      'unmuteUser': 'user-social-graph',
      'reportUser': 'user-social-graph',
      'reportPost': 'social-feed',
      'getBlocks': 'user-social-graph',
      'getMutes': 'user-social-graph',
      'checkBlockStatus': 'user-social-graph',
      'checkMuteStatus': 'user-social-graph'
    }
    
    const skillId = skillMap[action] || 'portfolio-balance'
    const messageText = JSON.stringify({ action, params })
    
    try {
      const response = await this.sdkClient.sendMessage({
        message: {
          kind: 'message',
          messageId: crypto.randomUUID(),
          role: 'user',
          parts: [{
            kind: 'text',
            text: messageText,
            metadata: {
              skillId
            }
          }]
        }
      })

      // Handle response - extract Task or Message
      let task: Task | undefined
      if ('result' in response && response.result) {
        const result = response.result
        if (typeof result === 'object' && result !== null && 'kind' in result) {
          if (result.kind === 'task') {
            task = result as Task
          } else if (result.kind === 'message') {
            // Direct message response
            const msg = result as Message
            const dataPart = msg.parts.find(p => p.kind === 'data')
            return dataPart ? (dataPart as { data: unknown }).data : {}
          }
        }
      }

      if (!task) {
        throw new Error('Expected task response from A2A')
      }

      // Poll for completion
      const maxWaitMs = 30000
      const startTime = Date.now()
      while (Date.now() - startTime < maxWaitMs) {
        const taskResponse = await this.sdkClient.getTask({ id: task.id })
        
        if ('result' in taskResponse && taskResponse.result) {
          const result = taskResponse.result as { task?: Task }
          if (result.task) {
            task = result.task
          }
        }

        const state = task.status?.state
        if (state === 'completed') {
          if (task.artifacts && task.artifacts.length > 0) {
            const artifact = task.artifacts[0]
            if (artifact) {
              const dataPart = artifact.parts.find(p => p.kind === 'data')
              return dataPart ? (dataPart as { data: unknown }).data : {}
            }
          }
          return {}
        }
        
        if (state === 'failed' || state === 'canceled' || state === 'rejected') {
          const messagePart = task.status?.message?.parts?.[0]
          const errorText = messagePart && 'text' in messagePart ? messagePart.text : 'Unknown error'
          throw new Error(`Task ${state}: ${errorText}`)
        }

        await new Promise(resolve => setTimeout(resolve, 500))
      }

      throw new Error('Task did not complete within timeout')
    } catch (error) {
      logger.error('A2A execution failed', { error, action, skillId }, 'BabylonA2AClient')
      throw error
    }
  }

  /**
   * Core request method - uses A2A protocol
   */
  async request(method: string, params?: unknown): Promise<unknown> {
    if (method.startsWith('a2a.')) {
      // Map a2a.* methods to actions
      const action = method.replace('a2a.', '').replace(/([A-Z])/g, '_$1').toLowerCase()
      // Convert back to camelCase for skill mapping
      const camelAction = action.split('_').map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
      return this.executeViaA2A(camelAction, (params || {}) as Record<string, unknown>)
    }
    throw new Error(`Method ${method} must use A2A protocol`)
  }

  /**
   * Alias for request() for backward compatibility with providers
   */
  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    return this.request(method, params)
  }

  // ==================== Market Data Methods ====================
  async getMarketData(marketId: string) {
    return this.request('a2a.getMarketData', { marketId })
  }

  async getMarketPrices(marketId: string) {
    return this.request('a2a.getMarketPrices', { marketId })
  }

  async subscribeMarket(marketId: string) {
    return this.request('a2a.subscribeMarket', { marketId })
  }

  // ==================== Portfolio Methods ====================
  async getBalance(userId?: string) {
    return this.request('a2a.getBalance', userId ? { userId } : {})
  }

  async getPositions(userId?: string) {
    return this.request('a2a.getPositions', userId ? { userId } : {})
  }

  async getUserWallet(userId: string) {
    return this.request('a2a.getUserWallet', { userId })
  }

  // ==================== Agent Discovery Methods ====================
  async discoverAgents(filters?: {
    strategies?: string[]
    markets?: string[]
    minReputation?: number
  }, limit?: number) {
    return this.request('a2a.discover', { filters, limit })
  }

  async getAgentInfo(agentId: string) {
    return this.request('a2a.getInfo', { agentId })
  }

  // ==================== Trading Methods ====================
  async getPredictions(params?: { userId?: string; status?: 'active' | 'resolved' }) {
    return this.request('a2a.getPredictions', params || {})
  }

  async getPerpetuals() {
    return this.request('a2a.getPerpetuals', {})
  }

  async buyShares(marketId: string, outcome: 'YES' | 'NO', amount: number) {
    return this.request('a2a.buyShares', { marketId, outcome, amount })
  }

  async sellShares(positionId: string, shares: number) {
    return this.request('a2a.sellShares', { positionId, shares })
  }

  async openPosition(ticker: string, side: 'LONG' | 'SHORT', amount: number, leverage: number) {
    return this.request('a2a.openPosition', { ticker, side, amount, leverage })
  }

  async closePosition(positionId: string) {
    return this.request('a2a.closePosition', { positionId })
  }

  async getTrades(params?: { limit?: number; marketId?: string }) {
    return this.request('a2a.getTrades', params || {})
  }

  async getTradeHistory(userId: string, limit?: number) {
    return this.request('a2a.getTradeHistory', { userId, limit })
  }

  // ==================== Social Features ====================
  async getFeed(params?: { limit?: number; offset?: number; following?: boolean; type?: 'post' | 'article' }) {
    return this.request('a2a.getFeed', params || {})
  }

  async getPost(postId: string) {
    return this.request('a2a.getPost', { postId })
  }

  async createPost(content: string, type: 'post' | 'article' = 'post') {
    return this.request('a2a.createPost', { content, type })
  }

  async deletePost(postId: string) {
    return this.request('a2a.deletePost', { postId })
  }

  async likePost(postId: string) {
    return this.request('a2a.likePost', { postId })
  }

  async unlikePost(postId: string) {
    return this.request('a2a.unlikePost', { postId })
  }

  async sharePost(postId: string, comment?: string) {
    return this.request('a2a.sharePost', { postId, comment })
  }

  async getComments(postId: string, limit?: number) {
    return this.request('a2a.getComments', { postId, limit })
  }

  async createComment(postId: string, content: string) {
    return this.request('a2a.createComment', { postId, content })
  }

  async deleteComment(commentId: string) {
    return this.request('a2a.deleteComment', { commentId })
  }

  async likeComment(commentId: string) {
    return this.request('a2a.likeComment', { commentId })
  }

  // ==================== User Management ====================
  async getUserProfile(userId: string) {
    return this.request('a2a.getUserProfile', { userId })
  }

  async updateProfile(params: {
    displayName?: string
    bio?: string
    username?: string
    profileImageUrl?: string
  }) {
    return this.request('a2a.updateProfile', params)
  }

  async followUser(userId: string) {
    return this.request('a2a.followUser', { userId })
  }

  async unfollowUser(userId: string) {
    return this.request('a2a.unfollowUser', { userId })
  }

  async getFollowers(userId: string, limit?: number) {
    return this.request('a2a.getFollowers', { userId, limit })
  }

  async getFollowing(userId: string, limit?: number) {
    return this.request('a2a.getFollowing', { userId, limit })
  }

  async searchUsers(query: string, limit?: number) {
    return this.request('a2a.searchUsers', { query, limit })
  }

  // ==================== Messaging ====================
  async getChats(filter?: 'all' | 'dms' | 'groups') {
    return this.request('a2a.getChats', filter ? { filter } : {})
  }

  async getChatMessages(chatId: string, limit?: number, offset?: number) {
    return this.request('a2a.getChatMessages', { chatId, limit, offset })
  }

  async sendMessage(chatId: string, content: string) {
    return this.request('a2a.sendMessage', { chatId, content })
  }

  async createGroup(name: string, memberIds: string[], description?: string) {
    return this.request('a2a.createGroup', { name, memberIds, description })
  }

  async leaveChat(chatId: string) {
    return this.request('a2a.leaveChat', { chatId })
  }

  async getUnreadCount() {
    return this.request('a2a.getUnreadCount', {})
  }

  // ==================== Notifications ====================
  async getNotifications(limit?: number) {
    return this.request('a2a.getNotifications', { limit })
  }

  async markNotificationsRead(notificationIds: string[]) {
    return this.request('a2a.markNotificationsRead', { notificationIds })
  }

  async getGroupInvites() {
    return this.request('a2a.getGroupInvites', {})
  }

  async acceptGroupInvite(inviteId: string) {
    return this.request('a2a.acceptGroupInvite', { inviteId })
  }

  async declineGroupInvite(inviteId: string) {
    return this.request('a2a.declineGroupInvite', { inviteId })
  }

  // ==================== Stats & Discovery ====================
  async getLeaderboard(params?: {
    page?: number
    pageSize?: number
    pointsType?: 'all' | 'earned' | 'referral'
    minPoints?: number
  }) {
    return this.request('a2a.getLeaderboard', params || {})
  }

  async getUserStats(userId: string) {
    return this.request('a2a.getUserStats', { userId })
  }

  async getSystemStats() {
    return this.request('a2a.getSystemStats', {})
  }

  async getReferrals() {
    return this.request('a2a.getReferrals', {})
  }

  async getReferralStats() {
    return this.request('a2a.getReferralStats', {})
  }

  async getReferralCode() {
    return this.request('a2a.getReferralCode', {})
  }

  async getReputation(userId?: string) {
    return this.request('a2a.getReputation', userId ? { userId } : {})
  }

  async getReputationBreakdown(userId: string) {
    return this.request('a2a.getReputationBreakdown', { userId })
  }

  async getTrendingTags(limit?: number) {
    return this.request('a2a.getTrendingTags', { limit })
  }

  async getPostsByTag(tag: string, limit?: number, offset?: number) {
    return this.request('a2a.getPostsByTag', { tag, limit, offset })
  }

  async getOrganizations(limit?: number) {
    return this.request('a2a.getOrganizations', { limit })
  }

  // ==================== Payments (x402) ====================
  async paymentRequest(params: {
    to: string
    amount: string
    service: string
    metadata?: Record<string, unknown>
    from?: string
  }) {
    return this.request('a2a.paymentRequest', params)
  }

  async paymentReceipt(requestId: string, txHash: string) {
    return this.request('a2a.paymentReceipt', { requestId, txHash })
  }

  // ==================== Moderation Methods ====================
  async blockUser(userId: string, reason?: string) {
    return this.request('a2a.blockUser', { userId, reason })
  }

  async unblockUser(userId: string) {
    return this.request('a2a.unblockUser', { userId })
  }

  async muteUser(userId: string, reason?: string) {
    return this.request('a2a.muteUser', { userId, reason })
  }

  async unmuteUser(userId: string) {
    return this.request('a2a.unmuteUser', { userId })
  }

  async reportUser(params: {
    userId: string
    category: 'spam' | 'harassment' | 'hate_speech' | 'violence' | 'misinformation' | 'inappropriate' | 'impersonation' | 'self_harm' | 'other'
    reason: string
    evidence?: string
  }) {
    return this.request('a2a.reportUser', params)
  }

  async reportPost(params: {
    postId: string
    category: 'spam' | 'harassment' | 'hate_speech' | 'violence' | 'misinformation' | 'inappropriate' | 'impersonation' | 'self_harm' | 'other'
    reason: string
    evidence?: string
  }) {
    return this.request('a2a.reportPost', params)
  }

  async getBlocks(params?: { limit?: number; offset?: number }) {
    return this.request('a2a.getBlocks', params || {})
  }

  async getMutes(params?: { limit?: number; offset?: number }) {
    return this.request('a2a.getMutes', params || {})
  }

  async checkBlockStatus(userId: string) {
    return this.request('a2a.checkBlockStatus', { userId })
  }

  async checkMuteStatus(userId: string) {
    return this.request('a2a.checkMuteStatus', { userId })
  }

  // ==================== Points Transfer ====================
  async transferPoints(recipientId: string, amount: number, message?: string) {
    return this.request('a2a.transferPoints', { recipientId, amount, message })
  }

  // ==================== Favorites ====================
  async favoriteProfile(userId: string) {
    return this.request('a2a.favoriteProfile', { userId })
  }

  async unfavoriteProfile(userId: string) {
    return this.request('a2a.unfavoriteProfile', { userId })
  }

  async getFavorites(params?: { limit?: number; offset?: number }) {
    return this.request('a2a.getFavorites', params || {})
  }

  async getFavoritePosts(params?: { limit?: number; offset?: number }) {
    return this.request('a2a.getFavoritePosts', params || {})
  }

  async close(): Promise<void> {
    // No cleanup needed
  }
}

/**
 * Initialize A2A client
 */
export async function initializeAgentA2AClient(
  agentUserId: string
): Promise<BabylonA2AClient> {
  const agent = await prisma.user.findUnique({
    where: { id: agentUserId },
    select: { walletAddress: true, agent0TokenId: true }
  })

  const sdkClient = await initializeA2ASdkClient(agentUserId)
  const walletAddress = agent?.walletAddress || undefined
  const agent0TokenId = agent?.agent0TokenId || undefined
  return new BabylonA2AClient(
    sdkClient,
    agentUserId,
    walletAddress,
    agent0TokenId
  )
}

/**
 * Enhance agent runtime with Babylon plugin
 */
export async function enhanceRuntimeWithBabylon(
  runtime: AgentRuntime,
  agentUserId: string,
  plugin: Plugin
): Promise<void> {
  const babylonRuntime = runtime as BabylonRuntime

  // A2A is REQUIRED - initialize client
  let a2aClient: BabylonA2AClient | undefined
  try {
    a2aClient = await initializeAgentA2AClient(agentUserId)
    babylonRuntime.a2aClient = a2aClient as unknown as typeof babylonRuntime.a2aClient
    
    logger.info('✅ Babylon plugin registered with A2A client', { 
      agentUserId,
      pluginName: plugin.name,
      providersCount: plugin.providers?.length || 0,
      actionsCount: plugin.actions?.length || 0,
      a2aConnected: true,
      a2aEndpoint: process.env.NEXT_PUBLIC_APP_URL || process.env.BABYLON_A2A_ENDPOINT || 'http://localhost:3000'
    })
  } catch (error) {
    // Log detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    // Get agent info for error logging
    const agent = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: { walletAddress: true }
    })
    
    logger.error('❌ A2A client initialization FAILED', {
      agentUserId,
      error: errorMessage,
      stack: errorStack,
      agentCardUrl: `${process.env.BABYLON_A2A_ENDPOINT || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/.well-known/agent-card.json`,
      baseUrl: process.env.BABYLON_A2A_ENDPOINT || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      hasWallet: !!agent?.walletAddress
    }, 'BabylonIntegration')
    
    // Don't throw - allow plugin registration but log error
    // Providers/actions will check isConnected() and fail gracefully
    // This allows graceful degradation if A2A endpoint is temporarily unavailable
  }
  
  runtime.registerPlugin(plugin)
  
  const a2aMode = a2aClient?.isConnected() ? 'a2a' : 'database-fallback'
  logger.info('Babylon plugin registered', { 
    agentUserId,
    mode: a2aMode,
    a2aEnabled: !!a2aClient?.isConnected()
  })
}

/**
 * Disconnect A2A client for an agent
 */
export async function disconnectAgentA2AClient(runtime: AgentRuntime): Promise<void> {
  const babylonRuntime = runtime as BabylonRuntime
  
  if (!babylonRuntime.a2aClient?.isConnected()) {
    return
  }

  try {
    if (babylonRuntime.a2aClient && 'close' in babylonRuntime.a2aClient) {
      await (babylonRuntime.a2aClient as { close: () => Promise<void> }).close()
    }
    babylonRuntime.a2aClient = undefined
    
    logger.info('A2A client disconnected', { agentId: runtime.agentId })
  } catch (error) {
    logger.error('Failed to disconnect A2A client', error, 'BabylonIntegration')
  }
}

/**
 * Check if agent runtime has active A2A connection
 */
export function hasActiveA2AConnection(runtime: AgentRuntime): boolean {
  const babylonRuntime = runtime as BabylonRuntime
  return !!babylonRuntime.a2aClient?.isConnected()
}

