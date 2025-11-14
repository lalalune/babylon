/**
 * HTTP-based A2A Client
 * 
 * Simple client for A2A protocol over HTTP (no WebSocket)
 * Uses JSON-RPC 2.0 over HTTP POST requests
 */

import type { JsonRpcRequest, JsonRpcResponse, JsonRpcParams } from '@/types/a2a'

export interface HttpA2AClientConfig {
  /** A2A endpoint URL (e.g. http://localhost:3000/api/a2a) */
  endpoint: string
  /** Agent ID for authentication */
  agentId: string
  /** Agent address (optional) */
  address?: string
  /** Agent token ID (optional) */
  tokenId?: number
  /** Request timeout in ms */
  timeout?: number
}

export class HttpA2AClient {
  private config: HttpA2AClientConfig
  private requestId = 0

  constructor(config: HttpA2AClientConfig) {
    this.config = {
      timeout: 30000,
      ...config
    }
  }

  /**
   * Send a JSON-RPC request
   */
  async request(method: string, params?: unknown): Promise<unknown> {
    const id = ++this.requestId
    
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params: params as JsonRpcParams | undefined,
      id
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Agent-Id': this.config.agentId,
        ...(this.config.address && { 'X-Agent-Address': this.config.address }),
        ...(this.config.tokenId && { 'X-Agent-Token-Id': this.config.tokenId.toString() })
      },
      body: JSON.stringify(request),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result: JsonRpcResponse = await response.json()

    if (result.error) {
      throw new Error(`A2A Error [${result.error.code}]: ${result.error.message}`)
    }

    return result.result
  }

  /**
   * Market Data Methods
   */
  async getMarketData(marketId: string) {
    return this.request('a2a.getMarketData', { marketId })
  }

  async getMarketPrices(marketId: string) {
    return this.request('a2a.getMarketPrices', { marketId })
  }

  async subscribeMarket(marketId: string) {
    return this.request('a2a.subscribeMarket', { marketId })
  }

  /**
   * Portfolio Methods
   */
  async getBalance(userId?: string) {
    return this.request('a2a.getBalance', userId ? { userId } : {})
  }

  async getPositions(userId?: string) {
    return this.request('a2a.getPositions', userId ? { userId } : {})
  }

  async getUserWallet(userId: string) {
    return this.request('a2a.getUserWallet', { userId })
  }

  /**
   * Agent Discovery Methods
   */
  async discoverAgents(filters?: {
    strategies?: string[]
    markets?: string[]
    minReputation?: number
  }, limit?: number) {
    return this.request('a2a.discoverAgents', { filters, limit })
  }

  async getAgentInfo(agentId: string) {
    return this.request('a2a.getAgentInfo', { agentId })
  }

  /**
   * Coalition Methods
   */
  async proposeCoalition(params: {
    name: string
    strategy: string
    targetMarket?: string
  }) {
    return this.request('a2a.proposeCoalition', params)
  }

  async joinCoalition(coalitionId: string) {
    return this.request('a2a.joinCoalition', { coalitionId })
  }

  async leaveCoalition(coalitionId: string) {
    return this.request('a2a.leaveCoalition', { coalitionId })
  }

  async sendCoalitionMessage(params: {
    coalitionId: string
    messageType: string
    content: unknown
  }) {
    return this.request('a2a.coalitionMessage', params)
  }

  /**
   * Analysis Sharing Methods
   */
  async shareAnalysis(analysis: {
    marketId: string
    prediction: number
    confidence: number
    reasoning?: string
    dataPoints?: unknown[]
    timestamp: number
  }) {
    return this.request('a2a.shareAnalysis', analysis)
  }

  async requestAnalysis(params: {
    marketId: string
    paymentOffer?: string
    deadline: number
  }) {
    return this.request('a2a.requestAnalysis', params)
  }

  async getAnalyses(marketId: string, limit?: number) {
    return this.request('a2a.getAnalyses', { marketId, limit })
  }

  /**
   * Send a generic JSON-RPC request (alias for request)
   * Kept for backward compatibility with old code
   */
  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    return this.request(method, params)
  }

  /**
   * Check if client is connected (always true for HTTP)
   * Kept for backward compatibility
   */
  isConnected(): boolean {
    return true
  }

  /**
   * Close the client (no-op for HTTP, kept for API compatibility)
   */
  async close(): Promise<void> {
    // No cleanup needed for HTTP
  }
}

/**
 * Create an HTTP-based A2A client
 */
export function createHttpA2AClient(config: HttpA2AClientConfig): HttpA2AClient {
  return new HttpA2AClient(config)
}

