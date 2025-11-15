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
  MarketData
} from '@/types/a2a';
import {
  A2AMethod,
  ErrorCode
} from '@/types/a2a'
import type { PaymentVerificationParams, PaymentVerificationResult } from '@/types/payments'
import type { RegistryClient } from '@/types/a2a-server'
import type { X402Manager } from '@/types/a2a-server'
import type { IAgent0Client } from '@/agents/agent0/types'
import type { IUnifiedDiscoveryService } from '@/agents/agent0/types'
import type {
  A2ABalanceResponse,
  A2APositionsResponse,
  A2AUserWalletResponse,
  A2APerpPosition,
  A2AMarketPosition
} from '@/types/a2a-responses'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import {
  DiscoverParamsSchema,
  GetAgentInfoParamsSchema,
  GetMarketDataParamsSchema,
  GetMarketPricesParamsSchema,
  SubscribeMarketParamsSchema,
  PaymentRequestParamsSchema,
  PaymentReceiptParamsSchema,
} from './validation'

// Typed parameter interfaces for each method
// Note: These types are inferred from schemas but kept for potential future use

export class MessageRouter {
  private config: A2AServerConfig
  private registryClient?: RegistryClient
  private x402Manager?: X402Manager
  private agent0Client?: IAgent0Client
  private unifiedDiscovery?: IUnifiedDiscoveryService
  private marketSubscriptions: Map<string, Set<string>> = new Map() // marketId -> Set of agentIds

  constructor(
    config: A2AServerConfig | Partial<A2AServerConfig>,
    registryClient?: RegistryClient,
    x402Manager?: X402Manager,
    agent0Client?: IAgent0Client,
    unifiedDiscovery?: IUnifiedDiscoveryService
  ) {
    // Set defaults for missing config
    this.config = {
      port: config.port ?? 0,
      host: config.host ?? '0.0.0.0',
      maxConnections: config.maxConnections ?? 1000,
      messageRateLimit: config.messageRateLimit ?? 100,
      authTimeout: config.authTimeout ?? 30000,
      enableX402: config.enableX402 ?? false,
      enableCoalitions: config.enableCoalitions ?? true,
      logLevel: config.logLevel ?? 'info',
      registryClient: registryClient,
      agent0Client: agent0Client,
      unifiedDiscovery: unifiedDiscovery
    }
    this.registryClient = registryClient
    this.x402Manager = x402Manager
    this.agent0Client = agent0Client
    this.unifiedDiscovery = unifiedDiscovery
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
      case A2AMethod.PAYMENT_REQUEST:
        return await this.handlePaymentRequest(agentId, request)
      case A2AMethod.PAYMENT_RECEIPT:
        return await this.handlePaymentReceipt(agentId, request)
      case A2AMethod.GET_BALANCE:
      case 'a2a.getBalance':
        return await this.handleGetBalance(agentId, request)
      case A2AMethod.GET_POSITIONS:
      case 'a2a.getPositions':
        return await this.handleGetPositions(agentId, request)
      case A2AMethod.GET_USER_WALLET:
      case 'a2a.getUserWallet':
        return await this.handleGetUserWallet(agentId, request)
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
    
    const parseResult = DiscoverParamsSchema.safeParse(request.params);
    if (!parseResult.success) {
      return this.errorResponse(request.id, ErrorCode.INVALID_PARAMS, 'Invalid params for discoverAgents');
    }
    const discoverRequest = parseResult.data;

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
      agents = await this.registryClient.discoverAgents(discoverRequest.filters ?? undefined)
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
      },
      id: request.id
    }
  }

  private async handleGetAgentInfo(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.GET_AGENT_INFO)
    
    const parseResult = GetAgentInfoParamsSchema.safeParse(request.params);
    if (!parseResult.success) {
      return this.errorResponse(request.id, ErrorCode.INVALID_PARAMS, 'Invalid params for getAgentInfo');
    }
    const agentInfo = parseResult.data;
    
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
              capabilities: profile.capabilities ?? {
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
              result: agentProfile,
              id: request.id
            }
          }
        }
        
        if (this.unifiedDiscovery) {
          const profile = await this.unifiedDiscovery.getAgent(agentInfo.agentId)
          if (profile) {
            return {
              jsonrpc: '2.0',
              result: profile,
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
            result: profile,
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
    
    const parseResult = GetMarketDataParamsSchema.safeParse(request.params);
    if (!parseResult.success) {
      return this.errorResponse(request.id, ErrorCode.INVALID_PARAMS, 'Invalid params for getMarketData');
    }
    const marketRequest = parseResult.data;

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
      result: marketData,
      id: request.id
    }
  }

  private async handleGetMarketPrices(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.GET_MARKET_PRICES)
    
    const parseResult = GetMarketPricesParamsSchema.safeParse(request.params);
    if (!parseResult.success) {
      return this.errorResponse(request.id, ErrorCode.INVALID_PARAMS, 'Invalid params for getMarketPrices');
    }
    const pricesRequest = parseResult.data;

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
      },
      id: request.id
    }
  }

  private async handleSubscribeMarket(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.SUBSCRIBE_MARKET)
    
    const parseResult = SubscribeMarketParamsSchema.safeParse(request.params);
    if (!parseResult.success) {
      return this.errorResponse(request.id, ErrorCode.INVALID_PARAMS, 'Invalid params for subscribeMarket');
    }
    const subscriptionRequest = parseResult.data;

    // Add agent to subscription set for this market
    if (!this.marketSubscriptions.has(subscriptionRequest.marketId)) {
      this.marketSubscriptions.set(subscriptionRequest.marketId, new Set())
    }
    this.marketSubscriptions.get(subscriptionRequest.marketId)?.add(agentId)
    return {
      jsonrpc: '2.0',
      result: {
        subscribed: true,
        marketId: subscriptionRequest.marketId
      },
      id: request.id
    }
  }

  // ==================== User Data Operations ====================

  private async handleGetBalance(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, 'a2a.getBalance')
    
    try {
      // Get userId from params or use agentId
      const params = request.params as { userId?: string } | undefined
      const userId = params?.userId || agentId
      
      // Fetch balance from database
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          virtualBalance: true,
          totalDeposited: true,
          totalWithdrawn: true,
          lifetimePnL: true,
          reputationPoints: true,
        }
      })
      
      if (!user) {
        return this.errorResponse(
          request.id,
          ErrorCode.AGENT_NOT_FOUND,
          `User ${userId} not found`
        )
      }
      
      const balanceResponse: A2ABalanceResponse = {
        balance: Number(user.virtualBalance),
        totalDeposited: Number(user.totalDeposited),
        totalWithdrawn: Number(user.totalWithdrawn),
        lifetimePnL: Number(user.lifetimePnL),
        reputationPoints: user.reputationPoints || 0
      }

      return {
        jsonrpc: '2.0',
        result: balanceResponse,
        id: request.id
      }
    } catch (error) {
      logger.error('Error fetching balance', error)
      return this.errorResponse(
        request.id,
        ErrorCode.INTERNAL_ERROR,
        'Failed to fetch balance'
      )
    }
  }

  private async handleGetPositions(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, 'a2a.getPositions')
    
    try {
      const params = request.params as { userId?: string } | undefined
      const userId = params?.userId || agentId
      
      // Fetch positions from database
      const [perpPositions, predictionPositions] = await Promise.all([
        prisma.perpPosition.findMany({
          where: {
            userId,
            closedAt: null,
          },
          select: {
            id: true,
            ticker: true,
            side: true,
            entryPrice: true,
            currentPrice: true,
            size: true,
            leverage: true,
            unrealizedPnL: true,
            liquidationPrice: true,
          }
        }),
        prisma.position.findMany({
          where: {
            userId,
          },
          include: {
            Market: {
              select: {
                id: true,
                question: true,
                yesShares: true,
                noShares: true,
                resolved: true,
                resolution: true,
              }
            }
          }
        })
      ])
      
      // Format perp positions
      const formattedPerpPositions: A2APerpPosition[] = perpPositions.map(p => ({
        id: p.id,
        ticker: p.ticker,
        side: p.side === 'long' || p.side === 'short' ? p.side : 'long', // Ensure valid side
        size: Number(p.size),
        entryPrice: Number(p.entryPrice),
        currentPrice: Number(p.currentPrice),
        leverage: p.leverage,
        unrealizedPnL: Number(p.unrealizedPnL),
        liquidationPrice: Number(p.liquidationPrice),
      }))
      
      // Format prediction positions
      const formattedMarketPositions: A2AMarketPosition[] = predictionPositions.map(p => {
        const yesShares = Number(p.Market.yesShares)
        const noShares = Number(p.Market.noShares)
        const totalShares = yesShares + noShares
        const currentPrice = totalShares === 0 ? 0.5 : (p.side ? yesShares / totalShares : noShares / totalShares)
        const avgPrice = Number(p.avgPrice)
        const shares = Number(p.shares)
        const unrealizedPnL = (currentPrice * shares) - (avgPrice * shares)

        return {
          id: p.id,
          marketId: p.Market.id,
          question: p.Market.question,
          side: p.side ? 'YES' : 'NO', // Convert boolean to string
          shares,
          avgPrice,
          currentPrice,
          unrealizedPnL,
        }
      })
      
      const positionsResponse: A2APositionsResponse = {
        perpPositions: formattedPerpPositions,
        marketPositions: formattedMarketPositions,
      }

      return {
        jsonrpc: '2.0',
        result: positionsResponse,
        id: request.id
      }
    } catch (error) {
      logger.error('Error fetching positions', error)
      return this.errorResponse(
        request.id,
        ErrorCode.INTERNAL_ERROR,
        'Failed to fetch positions'
      )
    }
  }

  private async handleGetUserWallet(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, 'a2a.getUserWallet')
    
    try {
      const params = request.params as { userId: string } | undefined
      if (!params?.userId) {
        return this.errorResponse(
          request.id,
          ErrorCode.INVALID_PARAMS,
          'userId is required'
        )
      }
      
      const userId = params.userId
      
      // Fetch both balance and positions
      const [balanceResponse, positionsResponse] = await Promise.all([
        this.handleGetBalance(agentId, { ...request, params: { userId } }),
        this.handleGetPositions(agentId, { ...request, params: { userId } })
      ])
      
      if (balanceResponse.error || positionsResponse.error) {
        return this.errorResponse(
          request.id,
          ErrorCode.INTERNAL_ERROR,
          'Failed to fetch wallet data'
        )
      }
      
      const walletResponse: A2AUserWalletResponse = {
        balance: balanceResponse.result as A2ABalanceResponse,
        positions: positionsResponse.result as A2APositionsResponse,
      }

      return {
        jsonrpc: '2.0',
        result: walletResponse,
        id: request.id
      }
    } catch (error) {
      logger.error('Error fetching user wallet', error)
      return this.errorResponse(
        request.id,
        ErrorCode.INTERNAL_ERROR,
        'Failed to fetch user wallet'
      )
    }
  }

  // ==================== x402 Micropayments ====================

  private async handlePaymentRequest(agentId: string, request: JsonRpcRequest): Promise<JsonRpcResponse> {
    this.logRequest(agentId, A2AMethod.PAYMENT_REQUEST)
    
    const parseResult = PaymentRequestParamsSchema.safeParse(request.params);
    if (!parseResult.success) {
        return this.errorResponse(request.id, ErrorCode.INVALID_PARAMS, 'Invalid params for payment request');
    }
    const paymentRequest = parseResult.data;

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

    const createdPaymentRequest = await this.x402Manager.createPaymentRequest(
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
    
    const parseResult = PaymentReceiptParamsSchema.safeParse(request.params);
    if (!parseResult.success) {
        return this.errorResponse(request.id, ErrorCode.INVALID_PARAMS, 'Invalid params for payment receipt');
    }
    const receipt = parseResult.data;

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

    const storedPaymentRequest = await this.x402Manager.getPaymentRequest(receipt.requestId)
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
}
