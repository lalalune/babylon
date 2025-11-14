/**
 * Agent-to-Agent (A2A) Protocol API
 * 
 * @route POST /api/a2a
 * @route GET /api/a2a
 * @access Public (with agent authentication)
 * 
 * @description
 * Core endpoint for the Agent-to-Agent (A2A) communication protocol implementing
 * JSON-RPC 2.0 over HTTP. Enables autonomous agents to communicate, coordinate,
 * and execute collaborative strategies without centralized intermediaries.
 * 
 * **A2A Protocol Features:**
 * - JSON-RPC 2.0 compliant messaging
 * - Agent authentication via headers
 * - Message routing and handling
 * - Coalition support for multi-agent coordination
 * - Rate limiting and connection management
 * 
 * **POST /api/a2a - Execute A2A Request**
 * 
 * @header {string} x-agent-id - Agent identifier (required)
 * @header {string} x-agent-address - Agent wallet address (optional)
 * @header {string} x-agent-token-id - Agent token ID (optional)
 * 
 * @param {object} request - JSON-RPC 2.0 request
 * @param {string} request.jsonrpc - Must be "2.0"
 * @param {string} request.method - RPC method name
 * @param {object} [request.params] - Method parameters (optional)
 * @param {string|number} [request.id] - Request identifier (optional)
 * 
 * @returns {object} JSON-RPC 2.0 response
 * @property {string} jsonrpc - Always "2.0"
 * @property {object} [result] - Success result (if no error)
 * @property {object} [error] - Error object (if failed)
 * @property {number} error.code - JSON-RPC error code
 * @property {string} error.message - Error message
 * @property {string|number} id - Request identifier
 * 
 * **GET /api/a2a - Service Information**
 * 
 * @returns {object} Service metadata
 * @property {string} service - Service name
 * @property {string} version - Protocol version
 * @property {string} status - Service status
 * @property {string} endpoint - API endpoint path
 * @property {string} agentCard - Agent card URL
 * 
 * @throws {400} Invalid Request - Malformed JSON-RPC request
 * @throws {500} Internal Error - Server error during processing
 * 
 * @example
 * ```typescript
 * // POST: Execute A2A request
 * const response = await fetch('/api/a2a', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'x-agent-id': 'agent-123'
 *   },
 *   body: JSON.stringify({
 *     jsonrpc: '2.0',
 *     method: 'agent.getCapabilities',
 *     id: 1
 *   })
 * });
 * 
 * // GET: Check service status
 * const info = await fetch('/api/a2a').then(r => r.json());
 * console.log(info.status); // 'active'
 * ```
 * 
 * @see {@link /lib/a2a/message-router} MessageRouter implementation
 * @see {@link /types/a2a} A2A type definitions
 * @see {@link https://www.jsonrpc.org/specification} JSON-RPC 2.0 Specification
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { MessageRouter } from '@/lib/a2a/message-router'
import { RateLimiter } from '@/lib/a2a/utils/rate-limiter'
import { logger } from '@/lib/logger'
import type { JsonRpcRequest, JsonRpcResponse, AgentConnection } from '@/types/a2a'
import { ErrorCode } from '@/types/a2a'

export const dynamic = 'force-dynamic'

// Create a singleton message router and rate limiter
let messageRouter: MessageRouter | null = null
let rateLimiter: RateLimiter | null = null

function getMessageRouter(): MessageRouter {
  if (!messageRouter) {
    // Initialize with default config
    const config = {
      port: 0, // Not used for HTTP
      host: '0.0.0.0',
      maxConnections: 1000,
      messageRateLimit: 100,
      authTimeout: 30000,
      enableX402: false,
      enableCoalitions: true,
      logLevel: 'info' as const
    }
    messageRouter = new MessageRouter(config)
  }
  return messageRouter
}

function getRateLimiter(): RateLimiter {
  if (!rateLimiter) {
    // 100 messages per minute per agent
    rateLimiter = new RateLimiter(100)
  }
  return rateLimiter
}

export async function POST(req: NextRequest) {
  const body = await req.json() as JsonRpcRequest
  
  const agentId = req.headers.get('x-agent-id')!
  
  // Check rate limit before processing
  const limiter = getRateLimiter()
  const allowed = limiter.checkLimit(agentId)
  
  if (!allowed) {
    const remainingTokens = limiter.getTokens(agentId)
    logger.warn('A2A Rate limit exceeded', {
      agentId,
      method: body.method,
      remainingTokens
    })
    
    const rateLimitResponse: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: body.id ?? null,
      error: {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded. Maximum 100 requests per minute.',
        data: {
          retryAfter: 60,
          remainingTokens
        }
      }
    }
    
    return NextResponse.json(rateLimitResponse, {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': remainingTokens.toString()
      }
    })
  }
  
  const connection: AgentConnection = {
    authenticated: true,
    agentId,
    address: req.headers.get('x-agent-address')!,
    tokenId: parseInt(req.headers.get('x-agent-token-id')!),
    capabilities: {
      strategies: [],
      markets: [],
      actions: [],
      version: '1.0.0'
    },
    connectedAt: Date.now(),
    lastActivity: Date.now()
  }

  logger.info('A2A Request received', {
    method: body.method,
    agentId,
    id: body.id
  })

  const router = getMessageRouter()
  const response: JsonRpcResponse = await router.route(agentId, body, connection)

  if (response.error) {
    logger.error('A2A Request error', {
      method: body.method,
      error: response.error,
      agentId
    })
  }

  return NextResponse.json(response, {
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': limiter.getTokens(agentId).toString()
    }
  })
}

// Optional: Support GET for debugging/health check
export async function GET() {
  return NextResponse.json({
    service: 'Babylon A2A Protocol',
    version: '1.0.0',
    status: 'active',
    endpoint: '/api/a2a',
    agentCard: '/.well-known/agent-card.json'
  })
}

