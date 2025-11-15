/**
 * A2A Protocol Endpoint
 * 
 * Implements the standard A2A protocol using @a2a-js/sdk
 * Replaces custom methods with official message/send, tasks/get, etc.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { DefaultRequestHandler, DefaultExecutionEventBusManager, JsonRpcTransportHandler } from '@a2a-js/sdk/server'
import { babylonAgentCard } from '@/lib/a2a/babylon-agent-card'
import { BabylonAgentExecutor } from '@/lib/a2a/executors/babylon-executor'
import { ExtendedTaskStore } from '@/lib/a2a/extended-task-store'
import { logger } from '@/lib/logger'
import { ensureA2AApiKey } from '@/lib/a2a/utils/api-key-auth'

// Initialize A2A components with full executor (all 63 handlers)
const taskStore = new ExtendedTaskStore()
const executor = new BabylonAgentExecutor()
const eventBusManager = new DefaultExecutionEventBusManager()
const requestHandler = new DefaultRequestHandler(
  babylonAgentCard,
  taskStore,
  executor,
  eventBusManager
)
const jsonRpcHandler = new JsonRpcTransportHandler(requestHandler)

export const dynamic = 'force-dynamic'

/**
 * POST - Handle all A2A methods
 * Methods: message/send, message/stream, tasks/get, tasks/cancel, tasks/list
 */
export async function POST(request: NextRequest) {
  try {
    const authError = ensureA2AApiKey(request, { endpoint: '/api/a2a' })
    if (authError) return authError

    const body = await request.json()
    
    logger.info('Official A2A request', { 
      method: body.method,
      taskId: body.params?.message?.taskId 
    })
    
    // Use the JSON-RPC transport handler
    const response = await jsonRpcHandler.handle(body)
    
    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    logger.error('Official A2A error', error)
    
    return NextResponse.json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: (error as Error).message || 'Internal server error'
      },
      id: null
    }, { status: 500 })
  }
}

/**
 * GET - Return AgentCard for discovery
 */
export async function GET(request: NextRequest) {
  const authError = ensureA2AApiKey(request, { endpoint: '/api/a2a' })
  if (authError) return authError

  return NextResponse.json(babylonAgentCard, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}
