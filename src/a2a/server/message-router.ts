/**
 * A2A Message Router
 * Routes JSON-RPC 2.0 messages to appropriate handlers
 */

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  A2AServerConfig,
  AgentConnection,
  AgentProfile,
  MarketData,
  Coalition,
  MarketAnalysis,
  AnalysisRequest
} from '../types';
import {
  A2AMethod,
  ErrorCode
} from '../types'
import type { JsonRpcResult } from '@/types/json-rpc'
import type { PaymentVerificationParams, PaymentVerificationResult } from '@/types/payments'
import type { RegistryClient } from '@/types/a2a-server'
import type { X402Manager } from '@/types/a2a-server'
import type { IAgent0Client } from '@/agents/agent0/types'
import type { IUnifiedDiscoveryService } from '@/agents/agent0/types'
import { logger } from '../utils/logger'
import { prisma } from '@/lib/database-service'
import { getAnalysisService } from '../services/analysis-service'

// Typed parameter interfaces for each method
interface DiscoverParams {
  filters?: {
    strategies?: string[]
    minReputation?: number
    markets?: string[]
  }
  limit?: number
}

interface GetAgentInfoParams {
  agentId: string
}

interface GetMarketDataParams {
  marketId: string
}

interface GetMarketPricesParams {
  marketId: string
}

interface SubscribeMarketParams {
  marketId: string
}

interface ProposeCoalitionParams {
  name: string
  targetMarket: string
  strategy: string
  minMembers: number
  maxMembers: number
}

interface JoinCoalitionParams {
  coalitionId: string
}

interface CoalitionMessageParams {
  coalitionId: string
  messageType: 'analysis' | 'vote' | 'action' | 'coordination'
  content: Record<string, string | number | boolean | null>
}

interface LeaveCoalitionParams {
  coalitionId: string
}

interface RequestAnalysisParams {
  marketId: string
  paymentOffer?: string
  deadline: number
}

interface PaymentRequestParams {
  to: string
  amount: string
  service: string
  metadata?: Record<string, string | number | boolean | null>
  from?: string
}

interface PaymentReceiptParams {
  requestId: string
  txHash: string
}

export class MessageRouter {
  private config: Required<A2AServerConfig>
  private registryClient: RegistryClient | null = null
  private x402Manager: X402Manager | null = null
  private agent0Client: IAgent0Client | null = null // Agent0Client - optional for external agent support
  private unifiedDiscovery: IUnifiedDiscoveryService | null = null // UnifiedDiscoveryService - optional for enhanced discovery
  private marketSubscriptions: Map<string, Set<string>> = new Map() // marketId -> Set of agentIds
  private coalitions: Map<string, Coalition> = new Map()
  private server: { broadcast: (agentIds: string[], message: unknown) => void } | null = null // WebSocket server for broadcasting
  private analysisService = getAnalysisService() // Centralized analysis storage
  private analysisRequests: Map<string, AnalysisRequest> = new Map() // requestId -> request

  constructor(
    config: Required<A2AServerConfig>,
    registryClient?: RegistryClient,
    x402Manager?: X402Manager,
    agent0Client?: IAgent0Client | null,
    unifiedDiscovery?: IUnifiedDiscoveryService | null,
    server?: { broadcast: (agentIds: string[], message: unknown) => void } | null
  ) {
    this.config = config
    this.registryClient = registryClient || null
    this.x402Manager = x402Manager || null
    this.agent0Client = agent0Client || null
    this.unifiedDiscovery = unifiedDiscovery || null
    this.server = server || null
  }

  /**
   * Route incoming JSON-RPC message to appropriate handler
   */
  async route(
    agentId: string,
    request: JsonRpcRequest,
    connection: AgentConnection
  ): Promise<JsonRpcResponse> {
    if (!connection.authenticated) {
      return this.errorResponse(
        request.id,
        ErrorCode.NOT_AUTHENTICATED,
        'Connection not authenticated'
      )
    }

    switch (request.method) {
      case A2AMethod.DISCOVER_AGENTS:
        return await this.handleDiscover(agentId, request)
      case A2AMethod.GET_AGENT_INFO:
        return await this.handleGetAgentInfo(agentId, request)
      case A2AMethod.GET_MARKET_DATA:
        return await this.handleGetMarketData(agentId, request)
      case A2AMethod.GET_MARKET_PRICES:
        return await this.handleGetMarketPrices(agentId, request)
      case A2AMethod.SUBSCRIBE_MARKET:
        return await this.handleSubscribeMarket(agentId, request)
      case A2AMethod.PROPOSE_COALITION:
        return await this.handleProposeCoalition(agentId, request)
      case A2AMethod.JOIN_COALITION:
        return await this.handleJoinCoalition(agentId, request)
      case A2AMethod.COALITION_MESSAGE:
        return await this.handleCoalitionMessage(agentId, request)
      case A2AMethod.LEAVE_COALITION:
        return await this.handleLeaveCoalition(agentId, request)
      case A2AMethod.SHARE_ANALYSIS:
        return await this.handleShareAnalysis(agentId, request)
      case A2AMethod.REQUEST_ANALYSIS:
        return await this.handleRequestAnalysis(agentId, request)
      case A2AMethod.GET_ANALYSES:
        return await this.handleGetAnalyses(agentId, request)
      case A2AMethod.PAYMENT_REQUEST:
        return await this.handlePaymentRequest(agentId, request)
      case A2AMethod.PAYMENT_RECEIPT:
        return await this.handlePaymentReceipt(agentId, request)
      default:
        return this.errorResponse(
          request.id,
          ErrorCode.METHOD_NOT_FOUND,
          `Method ${request.method} not found`
        )
    }
  }

  // ==================== Helper Methods ====================

  /**
   * Log request for tracking and debugging
   */
  private logRequest(agentId: string, method: string): void {
    logger.debug(`Agent ${agentId} -> ${method}`)
  }

  // ==================== Agent Discovery ====================

  private async handleDiscover(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.DISCOVER_AGENTS)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const discoverRequest = request.params as DiscoverParams
    let agents: AgentProfile[] = []

    if (this.unifiedDiscovery) {
      const filters = {
        strategies: discoverRequest.filters?.strategies,
        markets: discoverRequest.filters?.markets,
        minReputation: discoverRequest.filters?.minReputation,
        includeExternal: process.env.AGENT0_ENABLED === 'true'
      }
      
      agents = await this.unifiedDiscovery.discoverAgents(filters)
      logger.debug(`UnifiedDiscovery found ${agents.length} agents`)
    }

    if (agents.length === 0 && this.registryClient?.discoverAgents) {
      agents = await this.registryClient.discoverAgents(discoverRequest.filters)
      logger.debug(`Local registry found ${agents.length} agents`)
    }

    // Apply limit if specified
    if (discoverRequest.limit && discoverRequest.limit > 0) {
      agents = agents.slice(0, discoverRequest.limit)
    }

    return {
      jsonrpc: '2.0',
      result: {
        agents,
        total: agents.length
      } as unknown as JsonRpcResult,
      id: request.id
    }
  }

  private async handleGetAgentInfo(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.GET_AGENT_INFO)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const agentInfo = request.params as unknown as GetAgentInfoParams
    
    if (!agentInfo.agentId || typeof agentInfo.agentId !== 'string') {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: agentId is required'
      )
    }

    // Check if it's an external agent (agent0-{tokenId} format)
    if (agentInfo.agentId.startsWith('agent0-')) {
      const tokenId = parseInt(agentInfo.agentId.replace('agent0-', ''), 10)
      
      if (!isNaN(tokenId)) {
        if (this.agent0Client) {
          const profile = await this.agent0Client.getAgentProfile(tokenId)
          if (profile) {
            const agentProfile: AgentProfile = {
              agentId: agentInfo.agentId,
              tokenId: profile.tokenId,
              address: profile.walletAddress,
              name: profile.name,
              endpoint: profile.capabilities?.actions?.includes('a2a') ? '' : '',
              capabilities: profile.capabilities || {
                strategies: [],
                markets: [],
                actions: [],
                version: '1.0.0'
              },
              reputation: {
                totalBets: 0,
                winningBets: 0,
                accuracyScore: profile.reputation?.accuracyScore || 0,
                trustScore: profile.reputation?.trustScore || 0,
                totalVolume: '0',
                profitLoss: 0,
                isBanned: false
              },
              isActive: true
            }
            
            return {
              jsonrpc: '2.0',
              result: agentProfile as unknown as JsonRpcResult,
              id: request.id
            }
          }
        }
        
        if (this.unifiedDiscovery) {
          const profile = await this.unifiedDiscovery.getAgent(agentInfo.agentId)
          if (profile) {
            return {
              jsonrpc: '2.0',
              result: profile as unknown as JsonRpcResult,
              id: request.id
            }
          }
        }
      }
    }
    
    // Query ERC-8004 registry (local agents)
    if (this.registryClient) {
      // Extract token ID from agentId (format: "agent-{tokenId}")
      const tokenId = parseInt(agentInfo.agentId.replace('agent-', ''), 10)
      if (!isNaN(tokenId)) {
        const profile = this.registryClient?.getAgentProfile 
          ? await this.registryClient.getAgentProfile(tokenId)
          : null
        if (profile) {
          return {
            jsonrpc: '2.0',
            result: profile as unknown as JsonRpcResult,
            id: request.id
          }
        }
      }
    }

    return this.errorResponse(
      request.id,
      ErrorCode.AGENT_NOT_FOUND,
        `Agent ${agentInfo.agentId} not found`
    )
  }

  // ==================== Market Operations ====================

  private async handleGetMarketData(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.GET_MARKET_DATA)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const marketRequest = request.params as unknown as GetMarketDataParams
    
    if (!marketRequest.marketId || typeof marketRequest.marketId !== 'string') {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: marketId is required'
      )
    }

    const market = await prisma.market.findUnique({
      where: { id: marketRequest.marketId }
    })
    
    if (!market) {
      return this.errorResponse(
        request.id,
        ErrorCode.MARKET_NOT_FOUND,
        `Market ${marketRequest.marketId} not found`
      )
    }
    
    const yesShares = Number(market.yesShares)
    const noShares = Number(market.noShares)
    const liquidity = Number(market.liquidity)
    
    const totalShares = yesShares + noShares
    const yesPrice = totalShares === 0 ? 0.5 : yesShares / totalShares
    const noPrice = totalShares === 0 ? 0.5 : noShares / totalShares
    
    const marketData: MarketData = {
      marketId: market.id,
      question: market.question,
      outcomes: ['YES', 'NO'],
      prices: [yesPrice, noPrice],
      volume: '0',
      liquidity: liquidity.toString(),
      resolveAt: market.endDate.getTime(),
      resolved: market.resolved
    }

    return {
      jsonrpc: '2.0',
      result: marketData as unknown as JsonRpcResult,
      id: request.id
    }
  }

  private async handleGetMarketPrices(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.GET_MARKET_PRICES)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const pricesRequest = request.params as unknown as GetMarketPricesParams
    
    if (!pricesRequest.marketId || typeof pricesRequest.marketId !== 'string') {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: marketId is required'
      )
    }
    const market = await prisma.market.findUnique({
      where: { id: pricesRequest.marketId }
    })
    
    if (!market) {
      return this.errorResponse(
        request.id,
        ErrorCode.MARKET_NOT_FOUND,
        `Market ${pricesRequest.marketId} not found`
      )
    }
    
    const yesShares = Number(market.yesShares)
    const noShares = Number(market.noShares)
    
    const totalShares = yesShares + noShares
    const yesPrice = totalShares === 0 ? 0.5 : yesShares / totalShares
    const noPrice = totalShares === 0 ? 0.5 : noShares / totalShares
    
    return {
      jsonrpc: '2.0',
      result: {
        marketId: market.id,
        prices: [
          { outcome: 'YES', price: yesPrice },
          { outcome: 'NO', price: noPrice }
        ],
        timestamp: Date.now()
      } as unknown as JsonRpcResult,
      id: request.id
    }
  }

  private async handleSubscribeMarket(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.SUBSCRIBE_MARKET)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const subscriptionRequest = request.params as unknown as SubscribeMarketParams
    
    if (!subscriptionRequest.marketId || typeof subscriptionRequest.marketId !== 'string') {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: marketId is required'
      )
    }

    // Add agent to subscription set for this market
    if (!this.marketSubscriptions.has(subscriptionRequest.marketId)) {
      this.marketSubscriptions.set(subscriptionRequest.marketId, new Set())
    }
    this.marketSubscriptions.get(subscriptionRequest.marketId)!.add(agentId)
    return {
      jsonrpc: '2.0',
      result: {
        subscribed: true,
        marketId: subscriptionRequest.marketId
      },
      id: request.id
    }
  }

  // ==================== Coalition Operations ====================

  private async handleProposeCoalition(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.PROPOSE_COALITION)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const proposal = request.params as unknown as ProposeCoalitionParams
    
    if (!proposal.name || !proposal.targetMarket || !proposal.strategy) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: name, targetMarket, and strategy are required'
      )
    }
    const coalitionId = `coalition-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const coalition: Coalition = {
      id: coalitionId,
      name: proposal.name,
      members: [agentId],
      strategy: proposal.strategy,
      targetMarket: proposal.targetMarket,
      createdAt: Date.now(),
      active: true
    }

    this.coalitions.set(coalitionId, coalition)

    return {
      jsonrpc: '2.0',
      result: {
        coalitionId,
        proposal: coalition
      } as unknown as JsonRpcResult,
      id: request.id
    }
  }

  private async handleJoinCoalition(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.JOIN_COALITION)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const joinRequest = request.params as unknown as JoinCoalitionParams
    
    if (!joinRequest.coalitionId || typeof joinRequest.coalitionId !== 'string') {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: coalitionId is required'
      )
    }

    const coalition = this.coalitions.get(joinRequest.coalitionId)
    if (!coalition) {
      return this.errorResponse(
        request.id,
        ErrorCode.COALITION_NOT_FOUND,
        'Coalition not found'
      )
    }

    // Add member if not already present
    if (!coalition.members.includes(agentId)) {
      coalition.members.push(agentId)
    }

    return {
      jsonrpc: '2.0',
      result: {
        joined: true,
        coalition
      } as unknown as JsonRpcResult,
      id: request.id
    }
  }

  private async handleCoalitionMessage(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.COALITION_MESSAGE)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const messageData = request.params as unknown as CoalitionMessageParams
    
    if (!messageData.coalitionId || !messageData.messageType) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: coalitionId and messageType are required'
      )
    }

    const coalition = this.coalitions.get(messageData.coalitionId)
    if (!coalition) {
      return this.errorResponse(
        request.id,
        ErrorCode.COALITION_NOT_FOUND,
        'Coalition not found'
      )
    }

    if (!coalition.members.includes(agentId)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Agent not a member of coalition'
      )
    }

    // Broadcast message to coalition members
    const coalitionNotification = {
      jsonrpc: '2.0',
      method: 'a2a.coalition_notification',
      params: {
        coalitionId: messageData.coalitionId,
        from: agentId,
        messageType: messageData.messageType,
        content: messageData.content,
        timestamp: Date.now()
      }
    }
    
    // Get list of members to broadcast to (excluding sender)
    const recipients = coalition.members.filter(memberId => memberId !== agentId)
    
    // Broadcast using server if available
    if (this.server && recipients.length > 0) {
      this.server.broadcast(recipients, coalitionNotification)
      logger.debug(`Broadcasted coalition message to ${recipients.length} members`)
    }

    return {
      jsonrpc: '2.0',
      result: {
        delivered: true,
        recipients: recipients.length
      } as unknown as JsonRpcResult,
      id: request.id
    }
  }

  private async handleLeaveCoalition(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.LEAVE_COALITION)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const leaveRequest = request.params as unknown as LeaveCoalitionParams
    
    if (!leaveRequest.coalitionId || typeof leaveRequest.coalitionId !== 'string') {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: coalitionId is required'
      )
    }

    const coalition = this.coalitions.get(leaveRequest.coalitionId)
    if (!coalition) {
      return this.errorResponse(
        request.id,
        ErrorCode.COALITION_NOT_FOUND,
        'Coalition not found'
      )
    }

    // Remove member
    coalition.members = coalition.members.filter(id => id !== agentId)

    // Deactivate if no members left
    if (coalition.members.length === 0) {
      coalition.active = false
    }

    return {
      jsonrpc: '2.0',
      result: {
        left: true
      },
      id: request.id
    }
  }

  // ==================== Information Sharing ====================

  private async handleShareAnalysis(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.SHARE_ANALYSIS)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const analysis = request.params as unknown as MarketAnalysis

    // Validate analysis has required fields
    if (!analysis.marketId || !analysis.timestamp) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Analysis must include marketId and timestamp'
      )
    }

    // Store analysis using centralized service
    const analysisId = this.analysisService.storeAnalysis(analysis.marketId, analysis)
    
    logger.info(`Agent ${agentId} shared analysis for market ${analysis.marketId}`)
    
    // Distribute to interested parties (agents subscribed to this market)
    const subscribers = this.marketSubscriptions.get(analysis.marketId)
    if (subscribers && subscribers.size > 0 && this.server) {
      const notification = {
        jsonrpc: '2.0',
        method: 'a2a.analysis_shared',
        params: {
          analysisId,
          marketId: analysis.marketId,
          analyst: agentId,
          prediction: analysis.prediction,
          confidence: analysis.confidence,
          timestamp: analysis.timestamp
        }
      }
      
      // Broadcast to all subscribers except the analyst
      const recipients = Array.from(subscribers).filter(id => id !== agentId)
      if (recipients.length > 0) {
        this.server.broadcast(recipients, notification)
        logger.debug(`Distributed analysis to ${recipients.length} subscribers`)
      }
    }
    
    return {
      jsonrpc: '2.0',
      result: {
        shared: true,
        analysisId,
        distributed: subscribers?.size || 0
      } as unknown as JsonRpcResult,
      id: request.id
    }
  }

  private async handleRequestAnalysis(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.REQUEST_ANALYSIS)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const analysisRequest = request.params as unknown as RequestAnalysisParams
    
    if (!analysisRequest.marketId || !analysisRequest.deadline) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Analysis request must include marketId and deadline'
      )
    }

    // Store analysis request
    const requestId = `request-${agentId}-${Date.now()}`
    const request_data: AnalysisRequest = {
      marketId: analysisRequest.marketId,
      requester: agentId,
      paymentOffer: analysisRequest.paymentOffer,
      deadline: analysisRequest.deadline,
      requestId,
      timestamp: Date.now()
    }
    this.analysisRequests.set(requestId, request_data)
    
    logger.info(`Agent ${agentId} requesting analysis for market ${analysisRequest.marketId}, deadline: ${analysisRequest.deadline}`)
    
    // Broadcast to capable agents (agents subscribed to this market or with analysis capabilities)
    const subscribers = this.marketSubscriptions.get(analysisRequest.marketId)
    const notification = {
      jsonrpc: '2.0',
      method: 'a2a.analysis_requested',
      params: {
        requestId,
        marketId: analysisRequest.marketId,
        requester: agentId,
        paymentOffer: analysisRequest.paymentOffer,
        deadline: analysisRequest.deadline
      }
    }
    
    let broadcastCount = 0
    if (subscribers && subscribers.size > 0 && this.server) {
      // Broadcast to all subscribers except the requester
      const recipients = Array.from(subscribers).filter(id => id !== agentId)
      if (recipients.length > 0) {
        this.server.broadcast(recipients, notification)
        broadcastCount = recipients.length
        logger.debug(`Broadcasted analysis request to ${recipients.length} agents`)
      }
    }
    
    return {
      jsonrpc: '2.0',
      result: {
        requestId,
        broadcasted: true,
        recipients: broadcastCount
      } as unknown as JsonRpcResult,
      id: request.id
    }
  }

  /**
   * Get shared analyses for a market
   */
  private async handleGetAnalyses(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.GET_ANALYSES)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const params = request.params as { marketId: string; limit?: number }
    
    if (!params.marketId || typeof params.marketId !== 'string') {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: marketId is required'
      )
    }
    
    // Get analyses for this market using analysis service
    const limit = params.limit || 50
    const analyses = this.analysisService.getAnalyses(params.marketId, limit)
    
    // Filter out sensitive data (signatures, detailed dataPoints)
    const publicAnalyses = analyses.map((a: MarketAnalysis) => ({
      marketId: a.marketId,
      analyst: a.analyst,
      prediction: a.prediction,
      confidence: a.confidence,
      reasoning: a.reasoning,
      timestamp: a.timestamp
    }))
    
    return {
      jsonrpc: '2.0',
      result: {
        marketId: params.marketId,
        analyses: publicAnalyses,
        total: publicAnalyses.length
      } as unknown as JsonRpcResult,
      id: request.id
    }
  }

  // ==================== x402 Micropayments ====================

  private async handlePaymentRequest(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.PAYMENT_REQUEST)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const paymentRequest = request.params as unknown as PaymentRequestParams
    
    if (!paymentRequest.to || !paymentRequest.amount || !paymentRequest.service) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: to, amount, and service are required'
      )
    }
    if (!this.config.enableX402) {
      return this.errorResponse(
        request.id,
        ErrorCode.METHOD_NOT_FOUND,
        'x402 payments not enabled'
      )
    }

    if (!this.x402Manager) {
      return this.errorResponse(
        request.id,
        ErrorCode.INTERNAL_ERROR,
        'Payment system not configured'
      )
    }

    const from = paymentRequest.from || ''

    const createdPaymentRequest = this.x402Manager.createPaymentRequest(
      from,
      paymentRequest.to,
      paymentRequest.amount,
      paymentRequest.service,
      paymentRequest.metadata as Record<string, string | number | boolean | null> | undefined
    )

    return {
      jsonrpc: '2.0',
      result: {
        requestId: createdPaymentRequest.requestId,
        amount: createdPaymentRequest.amount,
        expiresAt: createdPaymentRequest.expiresAt
      },
      id: request.id
    }
  }

  private async handlePaymentReceipt(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.PAYMENT_RECEIPT)
    
    // Validate and type params
    if (!request.params || typeof request.params !== 'object' || Array.isArray(request.params)) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: expected object'
      )
    }
    
    const receipt = request.params as unknown as PaymentReceiptParams
    
    if (!receipt.requestId || !receipt.txHash) {
      return this.errorResponse(
        request.id,
        ErrorCode.INVALID_PARAMS,
        'Invalid params: requestId and txHash are required'
      )
    }
    if (!this.config.enableX402) {
      return this.errorResponse(
        request.id,
        ErrorCode.METHOD_NOT_FOUND,
        'x402 payments not enabled'
      )
    }

    if (!this.x402Manager) {
      return this.errorResponse(
        request.id,
        ErrorCode.INTERNAL_ERROR,
        'Payment system not configured'
      )
    }

    const storedPaymentRequest = this.x402Manager.getPaymentRequest(receipt.requestId)
    if (!storedPaymentRequest) {
      return this.errorResponse(
        request.id,
        ErrorCode.PAYMENT_FAILED,
        'Payment request not found or expired'
      )
    }

    const verificationData: PaymentVerificationParams = {
      requestId: receipt.requestId,
      txHash: receipt.txHash,
      from: storedPaymentRequest.from,
      to: storedPaymentRequest.to,
      amount: storedPaymentRequest.amount,
      timestamp: Date.now(),
      confirmed: false
    }
    const verificationResult: PaymentVerificationResult = await this.x402Manager.verifyPayment(verificationData)

    if (!verificationResult.verified) {
      return {
        jsonrpc: '2.0',
        result: {
          verified: false,
          message: verificationResult.error || 'Payment verification failed'
        },
        id: request.id
      }
    }

    return {
      jsonrpc: '2.0',
      result: {
        verified: true,
        message: 'Payment verified successfully'
      },
      id: request.id
    }
  }

  // ==================== Utility Methods ====================

  private errorResponse(id: string | number | null, code: number, message: string): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      error: {
        code,
        message
      },
      id
    }
  }

  /**
   * Get subscribers for a market (used by server for notifications)
   */
  getMarketSubscribers(marketId: string): string[] {
    const subscribers = this.marketSubscriptions.get(marketId)
    return subscribers ? Array.from(subscribers) : []
  }

  /**
   * Get active coalitions for an agent
   */
  getAgentCoalitions(agentId: string): Coalition[] {
    return Array.from(this.coalitions.values()).filter(
      c => c.active && c.members.includes(agentId)
    )
  }
}
