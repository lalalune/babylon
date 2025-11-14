/**
 * MessageRouter Tests
 * Unit tests for the message router
 */

import { describe, test, expect, beforeEach } from 'bun:test'
import { MessageRouter } from '../../server/message-router'
import type {
  JsonRpcRequest,
  A2AServerConfig,
  AgentConnection,
  AgentCapabilities
} from '../../types'
import { A2AMethod, ErrorCode } from '../../types'

describe('MessageRouter', () => {
  let router: MessageRouter
  let config: Required<A2AServerConfig>
  let mockConnection: AgentConnection

  beforeEach(() => {
    config = {
      port: 8081,
      host: '0.0.0.0',
      maxConnections: 1000,
      messageRateLimit: 100,
      authTimeout: 30000,
      enableX402: true,
      enableCoalitions: true,
      logLevel: 'info'
    }

    const capabilities: AgentCapabilities = {
      strategies: ['momentum'],
      markets: ['prediction'],
      actions: ['analyze'],
      version: '1.0.0'
    }

    mockConnection = {
      agentId: 'agent-1',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      tokenId: 1,
      capabilities,
      authenticated: true,
      connectedAt: Date.now(),
      lastActivity: Date.now()
    }

    router = new MessageRouter(config)
  })

  describe('Method Not Found', () => {
    test('should return error for unknown method', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'unknown.method',
        id: 1
      }

      const response = await router.route('agent-1', request, mockConnection)

      expect(response.jsonrpc).toBe('2.0')
      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(ErrorCode.METHOD_NOT_FOUND)
      expect(response.id).toBe(1)
    })
  })

  describe('Agent Discovery', () => {
    test('should handle discover agents request', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.DISCOVER_AGENTS,
        params: {
          filters: {
            strategies: ['momentum']
          },
          limit: 10
        },
        id: 1
      }

      const response = await router.route('agent-1', request, mockConnection)

      expect(response.jsonrpc).toBe('2.0')
      expect(response.result).toBeDefined()
      expect(response.result.agents).toBeDefined()
      expect(Array.isArray(response.result.agents)).toBe(true)
      expect(response.result.total).toBeDefined()
      expect(response.id).toBe(1)
    })

    test('should handle get agent info request', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.GET_AGENT_INFO,
        params: { agentId: 'agent-123' },
        id: 1
      }

      const response = await router.route('agent-1', request, mockConnection)

      expect(response.jsonrpc).toBe('2.0')
      // Without registry client, should return error
      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(ErrorCode.AGENT_NOT_FOUND)
    })
  })

  describe('Market Operations', () => {
    test('should handle market subscription', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.SUBSCRIBE_MARKET,
        params: { marketId: 'market-123' },
        id: 1
      }

      const response = await router.route('agent-1', request, mockConnection)

      expect(response.jsonrpc).toBe('2.0')
      expect(response.result).toBeDefined()
      expect(response.result.subscribed).toBe(true)
      expect(response.result.marketId).toBe('market-123')
    })

    test('should track market subscribers', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.SUBSCRIBE_MARKET,
        params: { marketId: 'market-123' },
        id: 1
      }

      await router.route('agent-1', request, mockConnection)
      await router.route('agent-2', request, mockConnection)

      const subscribers = router.getMarketSubscribers('market-123')
      expect(subscribers.length).toBe(2)
      expect(subscribers).toContain('agent-1')
      expect(subscribers).toContain('agent-2')
    })

    test('should return empty array for market with no subscribers', () => {
      const subscribers = router.getMarketSubscribers('market-nonexistent')
      expect(subscribers.length).toBe(0)
    })
  })

  describe('Coalition Operations', () => {
    test('should propose coalition', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.PROPOSE_COALITION,
        params: {
          name: 'Alpha Coalition',
          targetMarket: 'market-123',
          strategy: 'momentum',
          minMembers: 2,
          maxMembers: 5
        },
        id: 1
      }

      const response = await router.route('agent-1', request, mockConnection)

      expect(response.jsonrpc).toBe('2.0')
      expect(response.result).toBeDefined()
      expect(response.result.coalitionId).toBeDefined()
      expect(response.result.proposal).toBeDefined()
      expect(response.result.proposal.name).toBe('Alpha Coalition')
      expect(response.result.proposal.members).toContain('agent-1')
    })

    test('should join coalition', async () => {
      // First create a coalition
      const proposeRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.PROPOSE_COALITION,
        params: {
          name: 'Test Coalition',
          targetMarket: 'market-123',
          strategy: 'momentum',
          minMembers: 2,
          maxMembers: 5
        },
        id: 1
      }

      const proposeResponse = await router.route('agent-1', proposeRequest, mockConnection)
      const coalitionId = proposeResponse.result.coalitionId

      // Now join it with another agent
      const joinRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.JOIN_COALITION,
        params: { coalitionId },
        id: 2
      }

      const joinResponse = await router.route('agent-2', joinRequest, mockConnection)

      expect(joinResponse.jsonrpc).toBe('2.0')
      expect(joinResponse.result).toBeDefined()
      expect(joinResponse.result.joined).toBe(true)
      expect(joinResponse.result.coalition.members).toContain('agent-1')
      expect(joinResponse.result.coalition.members).toContain('agent-2')
    })

    test('should reject joining non-existent coalition', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.JOIN_COALITION,
        params: { coalitionId: 'non-existent' },
        id: 1
      }

      const response = await router.route('agent-1', request, mockConnection)

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(ErrorCode.COALITION_NOT_FOUND)
    })

    test('should leave coalition', async () => {
      // Create coalition
      const proposeRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.PROPOSE_COALITION,
        params: {
          name: 'Test Coalition',
          targetMarket: 'market-123',
          strategy: 'momentum',
          minMembers: 2,
          maxMembers: 5
        },
        id: 1
      }

      const proposeResponse = await router.route('agent-1', proposeRequest, mockConnection)
      const coalitionId = proposeResponse.result.coalitionId

      // Leave it
      const leaveRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.LEAVE_COALITION,
        params: { coalitionId },
        id: 2
      }

      const leaveResponse = await router.route('agent-1', leaveRequest, mockConnection)

      expect(leaveResponse.result).toBeDefined()
      expect(leaveResponse.result.left).toBe(true)
    })

    test('should get agent coalitions', async () => {
      // Create coalition
      const proposeRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.PROPOSE_COALITION,
        params: {
          name: 'Test Coalition',
          targetMarket: 'market-123',
          strategy: 'momentum',
          minMembers: 2,
          maxMembers: 5
        },
        id: 1
      }

      await router.route('agent-1', proposeRequest, mockConnection)

      const coalitions = router.getAgentCoalitions('agent-1')
      expect(coalitions.length).toBe(1)
      expect(coalitions[0].name).toBe('Test Coalition')
      expect(coalitions[0].members).toContain('agent-1')
    })
  })

  describe('Information Sharing', () => {
    test('should handle share analysis', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.SHARE_ANALYSIS,
        params: {
          marketId: 'market-123',
          analyst: 'agent-1',
          prediction: 0.75,
          confidence: 0.85,
          reasoning: 'Strong momentum',
          dataPoints: {},
          timestamp: Date.now()
        },
        id: 1
      }

      const response = await router.route('agent-1', request, mockConnection)

      expect(response.result).toBeDefined()
      expect(response.result.shared).toBe(true)
      expect(response.result.analysisId).toBeDefined()
    })

    test('should handle request analysis', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.REQUEST_ANALYSIS,
        params: {
          marketId: 'market-123',
          deadline: Date.now() + 3600000
        },
        id: 1
      }

      const response = await router.route('agent-1', request, mockConnection)

      expect(response.result).toBeDefined()
      expect(response.result.requestId).toBeDefined()
      expect(response.result.broadcasted).toBe(true)
    })
  })

  describe('Error Handling', () => {
    test('should handle internal errors gracefully', async () => {
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.PAYMENT_REQUEST,
        params: null, // This will cause an error
        id: 1
      }

      const response = await router.route('agent-1', request, mockConnection)

      expect(response.error).toBeDefined()
      expect(response.error!.code).toBe(ErrorCode.INTERNAL_ERROR)
    })
  })
})
