/**
 * Per-Agent A2A Server Endpoint
 * 
 * @route POST /api/agents/[agentId]/a2a
 * @route GET /api/agents/[agentId]/a2a
 * @access Public (with agent authentication)
 * 
 * @description
 * A2A server endpoint for individual agents. When an agent has A2A enabled,
 * this endpoint allows other agents to communicate with it directly via the
 * A2A protocol. This enables agent-to-agent communication outside of the
 * ordinary gameplay.
 * 
 * The endpoint uses the same MessageRouter as the root A2A server but scopes
 * all operations to the specific agent identified by agentId.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { RateLimiter } from '@/lib/a2a/utils/rate-limiter'
import { logger } from '@/lib/logger'
import type { JsonRpcRequest } from '@/types/a2a'
import { ErrorCode } from '@/types/a2a'
import { DefaultRequestHandler, DefaultExecutionEventBusManager, JsonRpcTransportHandler } from '@a2a-js/sdk/server'
import type { DefaultRequestHandler as DefaultRequestHandlerType } from '@a2a-js/sdk/server'
import { BabylonAgentExecutor } from '@/lib/a2a/executors/babylon-executor'
import { ExtendedTaskStore, type ListTasksParams } from '@/lib/a2a/extended-task-store'
import { prisma } from '@/lib/prisma'
import { generateAgentCardSync } from '@/lib/a2a/sdk/agent-card-generator'

export const dynamic = 'force-dynamic'

// Per-agent handlers (cached per agent)
const agentRateLimiters = new Map<string, RateLimiter>()
const agentRequestHandlers = new Map<string, DefaultRequestHandlerType>()
const agentJsonRpcHandlers = new Map<string, JsonRpcTransportHandler>()

function getAgentRateLimiter(agentId: string): RateLimiter {
  if (!agentRateLimiters.has(agentId)) {
    agentRateLimiters.set(agentId, new RateLimiter(100))
  }
  return agentRateLimiters.get(agentId)!
}

async function getAgentJsonRpcHandler(agentId: string): Promise<JsonRpcTransportHandler> {
  if (!agentJsonRpcHandlers.has(agentId)) {
    if (!agentRequestHandlers.has(agentId)) {
      const taskStore = new ExtendedTaskStore()
      // Create executor scoped to this agent
      const executor = new BabylonAgentExecutor()
      const eventBusManager = new DefaultExecutionEventBusManager()
      
      // Get agent data for card generation
      const agentData = await prisma.user.findUnique({
        where: { id: agentId },
        select: {
          id: true,
          displayName: true,
          bio: true,
          profileImageUrl: true,
          agentSystem: true,
          agentPersonality: true,
          agentTradingStrategy: true
        }
      })
      
      if (!agentData) {
        throw new Error(`Agent ${agentId} not found`)
      }
      
      const requestHandler = new DefaultRequestHandler(
        generateAgentCardSync(agentData),
        taskStore,
        executor,
        eventBusManager
      )
      agentRequestHandlers.set(agentId, requestHandler)
    }
    const requestHandler = agentRequestHandlers.get(agentId)!
    agentJsonRpcHandlers.set(agentId, new JsonRpcTransportHandler(requestHandler))
  }
  return agentJsonRpcHandlers.get(agentId)!
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  
  // Verify agent exists and has A2A enabled
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      isAgent: true,
      a2aEnabled: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      agentSystem: true,
      agentPersonality: true,
      agentTradingStrategy: true
    }
  })

  if (!agent || !agent.isAgent) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: ErrorCode.AGENT_NOT_FOUND,
        message: 'Agent not found'
      }
    }, { status: 404 })
  }

  if (!agent.a2aEnabled) {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: ErrorCode.INVALID_REQUEST,
        message: 'A2A is not enabled for this agent'
      }
    }, { status: 403 })
  }

  let body: JsonRpcRequest
  try {
    body = await req.json() as JsonRpcRequest
  } catch {
    return NextResponse.json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: ErrorCode.INVALID_REQUEST,
        message: 'Invalid JSON-RPC request'
      }
    }, { status: 400 })
  }

  const requestingAgentId = req.headers.get('x-agent-id') || req.headers.get('x-agent-address') || 'anonymous'
  
  // Check rate limit
  const limiter = getAgentRateLimiter(agentId)
  const allowed = limiter.checkLimit(requestingAgentId)
  
  if (!allowed) {
    const remainingTokens = limiter.getTokens(requestingAgentId)
    return NextResponse.json({
      jsonrpc: '2.0',
      id: body.id ?? null,
      error: {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: 'Rate limit exceeded',
        data: {
          limit: 100,
          remaining: remainingTokens,
          resetAt: Date.now() + 60000
        }
      }
    }, { 
      status: 429,
      headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': remainingTokens.toString(),
        'X-RateLimit-Reset': (Date.now() + 60000).toString()
      }
    })
  }

  logger.info('Per-agent A2A Request received', {
    agentId,
    requestingAgentId,
    method: body.method,
    id: body.id
  })

  // Handle official A2A methods
  const officialMethods = ['message/send', 'message/stream', 'tasks/get', 'tasks/cancel', 'tasks/list',
                           'tasks/pushNotificationConfig/set', 'tasks/pushNotificationConfig/get',
                           'tasks/pushNotificationConfig/list', 'tasks/pushNotificationConfig/delete',
                           'tasks/resubscribe', 'agent/getAuthenticatedExtendedCard']
  
  if (officialMethods.includes(body.method)) {
    try {
      // Handle tasks/list manually
      if (body.method === 'tasks/list') {
        const jsonRpcHandler = await getAgentJsonRpcHandler(agentId)
        const handler = jsonRpcHandler as unknown as { requestHandler: DefaultRequestHandlerType }
        const taskStore = (handler.requestHandler as unknown as { taskStore: ExtendedTaskStore }).taskStore
        
        const params = (body.params || {}) as {
          contextId?: string
          status?: string
          pageSize?: number
          pageToken?: string
          historyLength?: number
          includeArtifacts?: boolean
          lastUpdatedAfter?: number
        }
        
        if (params.pageSize !== undefined && (params.pageSize < 1 || params.pageSize > 100)) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: body.id ?? null,
            error: {
              code: -32602,
              message: 'Invalid params: pageSize must be between 1 and 100',
              data: { pageSize: params.pageSize }
            }
          }, { status: 400 })
        }
        
        if (params.historyLength !== undefined && params.historyLength < 0) {
          return NextResponse.json({
            jsonrpc: '2.0',
            id: body.id ?? null,
            error: {
              code: -32602,
              message: 'Invalid params: historyLength must be non-negative',
              data: { historyLength: params.historyLength }
            }
          }, { status: 400 })
        }
        
        const listParams: ListTasksParams = {
          contextId: params.contextId,
          status: params.status === 'pending' ? 'submitted' : 
                  params.status === 'running' ? 'working' :
                  params.status === 'cancelled' ? 'canceled' :
                  params.status as 'submitted' | 'working' | 'completed' | 'failed' | 'canceled' | undefined,
          pageSize: params.pageSize || 20,
          pageToken: params.pageToken,
          historyLength: params.historyLength,
          includeArtifacts: params.includeArtifacts || false,
          lastUpdatedAfter: params.lastUpdatedAfter
        }
        
        const tasks = await taskStore.list(listParams)
        
        return NextResponse.json({
          jsonrpc: '2.0',
          id: body.id ?? null,
          result: {
            tasks: tasks.tasks,
            nextPageToken: tasks.nextPageToken
          }
        })
      }
      
      // Handle other official methods via SDK handler
      const jsonRpcHandler = await getAgentJsonRpcHandler(agentId)
      const response = await jsonRpcHandler.handle(body)
      
      return NextResponse.json(response, {
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': limiter.getTokens(requestingAgentId).toString()
        }
      })
    } catch (error) {
      logger.error('Per-agent A2A handler error', { error, method: body.method, agentId, requestingAgentId })
      return NextResponse.json({
        jsonrpc: '2.0',
        id: body.id ?? null,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Internal error'
        }
      }, { status: 500 })
    }
  }
  
  // All methods should be handled above via official A2A protocol
  // If we reach here, it's an unsupported method
  return NextResponse.json({
    jsonrpc: '2.0',
    id: body.id ?? null,
    error: {
      code: ErrorCode.METHOD_NOT_FOUND,
      message: `Method ${body.method} not supported. Use official A2A methods: message/send, tasks/get, tasks/list`
    }
  }, { status: 404 })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  
  // Verify agent exists and has A2A enabled
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      isAgent: true,
      a2aEnabled: true,
      displayName: true,
      bio: true,
      profileImageUrl: true,
      agentSystem: true,
      agentPersonality: true,
      agentTradingStrategy: true
    }
  })

  if (!agent || !agent.isAgent) {
    return NextResponse.json({
      error: 'Agent not found'
    }, { status: 404 })
  }

  if (!agent.a2aEnabled) {
    return NextResponse.json({
      error: 'A2A is not enabled for this agent'
    }, { status: 403 })
  }

  const agentCard = generateAgentCardSync({
    id: agent.id,
    displayName: agent.displayName,
    bio: agent.bio,
    profileImageUrl: agent.profileImageUrl,
    agentSystem: agent.agentSystem,
    agentPersonality: agent.agentPersonality,
    agentTradingStrategy: agent.agentTradingStrategy
  })

  return NextResponse.json({
    service: 'A2A Server',
    status: 'active',
    endpoint: `/api/agents/${agentId}/a2a`,
    agentCard
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
