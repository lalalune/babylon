/**
 * WebSocket Chat Route (DEPRECATED)
 * 
 * ⚠️ DEPRECATED: This WebSocket implementation is no longer used.
 * The application now uses Server-Sent Events (SSE) for real-time updates.
 * 
 * See: /api/sse/events for the new SSE implementation
 * See: SSE_MIGRATION.md for migration documentation
 * 
 * IMPORTANT: WebSocket server cannot run on Vercel (serverless limitation).
 * This file is kept for reference only.
 * 
 * For real-time features on Vercel:
 * - Use SSE endpoint: /api/sse/events
 * - See hooks: useSSE, useChannelSubscription, useChatMessages
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { WebSocket as WSWebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http'
import { parse } from 'url'
import { authenticate } from '@/lib/api/auth-middleware'
import { asUser } from '@/lib/db/context'
import { logger } from '@/lib/logger'
import type { JsonValue } from '@/types/common'
import type { 
  WebSocketMessage, 
  ChatMessage,
  WebSocketChannel
} from '@/types/websocket'
import {
  isValidWebSocketMessage,
  hasMessageData,
  isChatMessage,
  isChannelMessage
} from '@/types/websocket'

// Check if we're running on Vercel (serverless)
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined

interface AuthenticatedWebSocket extends WSWebSocket {
  userId?: string
  chatId?: string
  channels?: Set<string> // Subscribed channels (feed, markets, breaking-news)
  isAlive?: boolean
}

/**
 * WebSocketServer type from 'ws' package
 * Using interface to avoid static import issues on Vercel
 */
interface WebSocketServerType {
  clients: Set<AuthenticatedWebSocket>
  on(event: 'connection', listener: (ws: AuthenticatedWebSocket, req: IncomingMessage) => void): void
  on(event: 'error', listener: (error: Error & { code?: string }) => void): void
  on(event: 'close', listener: () => void): void
  close(callback?: () => void): void
}

// Use global to survive hot module reloading in development
declare global {
  var wss: WebSocketServerType | undefined
  var wsClients: Map<string, AuthenticatedWebSocket> | undefined
  var wsChatRooms: Map<string, Set<string>> | undefined
  var wsChannels: Map<string, Set<string>> | undefined
  var wsServerInitError: Error | undefined
}

// Global WebSocket server instance that survives hot reloads
let wss = global.wss || null
const clients = global.wsClients || new Map<string, AuthenticatedWebSocket>()
const chatRooms = global.wsChatRooms || new Map<string, Set<string>>()
const channels = global.wsChannels || new Map<string, Set<string>>() // channel -> Set of userIds
const serverInitializationPromise: Promise<WebSocketServerType> | null = null
let serverInitializationError = global.wsServerInitError || null

// Store in global for persistence
if (!global.wsClients) global.wsClients = clients
if (!global.wsChatRooms) global.wsChatRooms = chatRooms
if (!global.wsChannels) global.wsChannels = channels

function initializeWebSocketServer() {
  // Don't initialize WebSocket server on Vercel
  if (IS_VERCEL) {
    logger.info('Skipping WebSocket server initialization on Vercel (serverless)', undefined, 'WebSocket')
    return null
  }
  
  if (wss) return wss
  
  // If initialization is in progress, return null (caller should wait)
  if (serverInitializationPromise) return null
  
  // If initialization failed, return null
  if (serverInitializationError) return null

  try {
    // Check if server already exists in global (might be from another process/module)
    if (global.wss) {
      wss = global.wss
      logger.info('Reusing existing WebSocket server from global', undefined, 'WebSocket')
      return wss
    }
    
    wss = new WebSocketServer({
      port: 3001,
      path: '/ws/chat'
    })
    
    // Handle runtime errors after creation
    wss.on('error', (error: Error & { code?: string }) => {
      if (error.code === 'EADDRINUSE') {
        logger.warn('WebSocket port 3001 already in use', undefined, 'WebSocket')
        // Try to reuse existing server from global if available
        if (global.wss && global.wss !== wss) {
          wss = global.wss
          return
        }
      }
      logger.error('WebSocket server error:', error, 'WebSocket')
    })

    // Store in global for persistence across hot reloads
    global.wss = wss

  wss.on('connection', async (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
    logger.info('New WebSocket connection attempt', undefined, 'WebSocket')
    
    // Set up ping/pong for connection health
    ws.isAlive = true
    ws.on('pong', () => {
      ws.isAlive = true
    })

    // Handle authentication
    try {
      const url = parse(req.url || '', true)
      const token = url.query?.token as string
      
      if (!token) {
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Authentication token required'
        }))
        ws.close()
        return
      }

      // Authenticate the user (shim minimal NextRequest headers)
      const headers = new Headers()
      headers.set('authorization', `Bearer ${token}`)
      const user = await authenticate({ headers } as NextRequest)

      ws.userId = user.userId
      ws.channels = new Set() // Initialize channels set
      logger.info(`WebSocket authenticated for user: ${user.userId}`, undefined, 'WebSocket')

      // Store client
      clients.set(user.userId, ws)

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'pong',
        data: { message: 'Connected successfully' }
      }))

    } catch (error) {
      logger.error('WebSocket authentication failed:', error, 'WebSocket')
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Authentication failed'
      }))
      ws.close()
      return
    }

    // Handle messages
    ws.on('message', async (data: Buffer) => {
      try {
        const parsed = JSON.parse(data.toString())
        
        // Validate message structure at runtime
        if (!isValidWebSocketMessage(parsed)) {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Invalid message format'
          }))
          return
        }
        
        await handleMessage(ws, parsed)
      } catch (error) {
        logger.error('Error handling WebSocket message:', error, 'WebSocket')
        ws.send(JSON.stringify({
          type: 'error',
          error: 'Invalid message format'
        }))
      }
    })

    // Handle disconnection
    ws.on('close', () => {
      if (ws.userId) {
        leaveAllChats(ws.userId)
        leaveAllChannels(ws.userId)
        clients.delete(ws.userId)
        logger.info(`User ${ws.userId} disconnected`, undefined, 'WebSocket')
      }
    })

    // Handle errors
    ws.on('error', (error: Error) => {
      logger.error('WebSocket error:', error, 'WebSocket')
      if (ws.userId) {
        leaveAllChats(ws.userId)
        leaveAllChannels(ws.userId)
        clients.delete(ws.userId)
      }
    })
  })

    // Set up ping interval to keep connections alive
    const pingInterval = setInterval(() => {
      wss?.clients.forEach((client) => {
        const ws = client as AuthenticatedWebSocket;
        if (!ws.isAlive) {
          ws.terminate()
          return
        }
        ws.isAlive = false
        ws.ping()
      })
    }, 30000)

    wss.on('close', () => {
      clearInterval(pingInterval)
    })

    logger.info('WebSocket server initialized on port 3001', undefined, 'WebSocket')
    return wss
  } catch (error) {
    const err = error as Error & { code?: string }
    
    // Handle EADDRINUSE gracefully - might happen during build or if server already exists
    if (err.code === 'EADDRINUSE') {
      logger.warn('WebSocket port 3001 already in use, checking for existing server', undefined, 'WebSocket')
      
      // Check if there's an existing server in global
      if (global.wss) {
        wss = global.wss
        logger.info('Reusing existing WebSocket server', undefined, 'WebSocket')
        return wss
      }
      
      // During build time, this is expected - don't treat as fatal error
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        logger.info('Skipping WebSocket server initialization during build', undefined, 'WebSocket')
        return null
      }
    }
    
    logger.error('Failed to initialize WebSocket server:', error, 'WebSocket')
    serverInitializationError = err
    global.wsServerInitError = serverInitializationError
    wss = null
    global.wss = undefined
    return null
  }
}

// Don't initialize on module load during build time
// Initialize lazily when the route handler is called instead
// This prevents EADDRINUSE errors during Next.js build process

async function handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
  if (!ws.userId) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Not authenticated'
    }))
    return
  }

  switch (message.type) {
    case 'join_chat':
      await joinChat(ws, message.data.chatId)
      break
    
    case 'leave_chat':
      leaveChat(ws.userId, message.data.chatId)
      break
    
    case 'subscribe':
      subscribeToChannel(ws, message.data.channel)
      break
    
    case 'unsubscribe':
      unsubscribeFromChannel(ws.userId, message.data.channel)
      break
    
    case 'pong':
      ws.send(JSON.stringify({ type: 'pong', data: message.data }))
      break
    
    case 'error':
      // Error messages are already handled, but we can log them
      logger.warn('Received error message from client:', { error: message.error }, 'WebSocket')
      break
    
    case 'new_message':
    case 'channel_update':
      // These are server-to-client messages, not expected from client
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message type from client'
      }))
      break
    
    default:
      // Exhaustiveness check - TypeScript will error if we miss a case
      const _exhaustive: never = message
      void _exhaustive // Explicitly mark as intentionally unused
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Unknown message type'
      }))
  }
}

async function joinChat(ws: AuthenticatedWebSocket, chatId: string) {
  if (!chatId || !ws.userId) return

  // Check if user has access to this chat
  const isGameChat = chatId.includes('-')
  let hasAccess = true

  if (!isGameChat && ws.userId) {
    // For database chats, check membership with RLS
    // Create a mock auth user from ws.userId (user is already authenticated)
    const userId = ws.userId // Store in const for type narrowing
    const mockAuthUser = { userId, isAgent: false }
    const membership = await asUser(mockAuthUser, async (db) => {
      return await db.groupChatMembership.findUnique({
        where: {
          userId_chatId: {
            userId,
            chatId
          }
        }
      })
    })
    hasAccess = !!membership
  }

  if (!hasAccess) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Access denied to this chat'
    }))
    return
  }

  // Join room (client already stored on authentication)
  ws.chatId = chatId

  if (!chatRooms.has(chatId)) {
    chatRooms.set(chatId, new Set())
  }
  chatRooms.get(chatId)!.add(ws.userId)

  logger.info(`User ${ws.userId} joined chat ${chatId}`, undefined, 'WebSocket')
}

function leaveChat(userId: string, chatId: string) {
  if (!chatId) return

  const room = chatRooms.get(chatId)
  if (room) {
    room.delete(userId)
    if (room.size === 0) {
      chatRooms.delete(chatId)
    }
  }

  logger.info(`User ${userId} left chat ${chatId}`, undefined, 'WebSocket')
}

function leaveAllChats(userId: string) {
  for (const [chatId, room] of chatRooms.entries()) {
    room.delete(userId)
    if (room.size === 0) {
      chatRooms.delete(chatId)
    }
  }
}

// Channel subscription functions
function subscribeToChannel(ws: AuthenticatedWebSocket, channel: string) {
  if (!ws.userId || !channel) return

  if (!ws.channels) {
    ws.channels = new Set()
  }
  ws.channels.add(channel)

  if (!channels.has(channel)) {
    channels.set(channel, new Set())
  }
  channels.get(channel)!.add(ws.userId)

  logger.info(`User ${ws.userId} subscribed to channel ${channel}`, undefined, 'WebSocket')
}

function unsubscribeFromChannel(userId: string, channel: string) {
  if (!channel) return

  const channelSubscribers = channels.get(channel)
  if (channelSubscribers) {
    channelSubscribers.delete(userId)
    if (channelSubscribers.size === 0) {
      channels.delete(channel)
    }
  }

  const client = clients.get(userId)
  if (client?.channels) {
    client.channels.delete(channel)
  }

  logger.info(`User ${userId} unsubscribed from channel ${channel}`, undefined, 'WebSocket')
}

function leaveAllChannels(userId: string) {
  for (const [channel, subscribers] of channels.entries()) {
    subscribers.delete(userId)
    if (subscribers.size === 0) {
      channels.delete(channel)
    }
  }

  const client = clients.get(userId)
  if (client?.channels) {
    client.channels.clear()
  }
}

/**
 * Broadcast a message to all clients in a chat room
 * Uses type-safe message construction
 * @deprecated Kept for reference only - SSE is now used instead
 */
// @ts-expect-error - Kept for reference only
function _broadcastMessage(chatId: string, message: ChatMessage) {
  const room = chatRooms.get(chatId)
  if (!room) return

  const messageData: WebSocketMessage = {
    type: 'new_message',
    data: {
      message
    }
  }

  // Type guard ensures message has data when needed
  if (hasMessageData(messageData) && isChatMessage(messageData)) {
    room.forEach(userId => {
      const client = clients.get(userId)
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(messageData))
      }
    })

    logger.info(`Broadcasted message to ${room.size} clients in chat ${chatId}`, undefined, 'WebSocket')
  }
}

/**
 * Broadcast to a channel (feed, markets, breaking-news, etc.)
 * Uses type-safe message construction and validation
 * @deprecated Kept for reference only - SSE is now used instead
 */
// @ts-expect-error - Kept for reference only
function _broadcastToChannel(channel: WebSocketChannel, data: Record<string, JsonValue>) {
  const subscribers = channels.get(channel)
  if (!subscribers || subscribers.size === 0) return

  const messageData: WebSocketMessage = {
    type: 'channel_update',
    data: {
      channel,
      data
    }
  }

  // Type guard ensures message is valid channel message
  if (hasMessageData(messageData) && isChannelMessage(messageData)) {
    let sentCount = 0
    subscribers.forEach(userId => {
      const client = clients.get(userId)
      if (client && client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(messageData))
          sentCount++
        } catch (error) {
          logger.error(`Error sending to user ${userId}:`, error, 'WebSocket')
          // Remove invalid client
          subscribers.delete(userId)
          clients.delete(userId)
        }
      } else {
        // Remove disconnected client
        subscribers.delete(userId)
      }
    })

    if (sentCount > 0) {
      logger.debug(`Broadcasted to ${sentCount} subscribers on channel ${channel}`, { channel, sentCount }, 'WebSocket')
    }
  }
}

// Initialize WebSocket server on first request
// Note: NextRequest parameter may be used in future for authentication context
export async function GET(_request: NextRequest) {
  // On Vercel, WebSocket server cannot run (serverless limitation)
  if (IS_VERCEL) {
    return NextResponse.json({
      error: 'WebSocket not available on Vercel',
      message: 'WebSocket server cannot run on Vercel serverless platform',
      solution: 'Run WebSocket server on a separate server (same as game engine daemon)',
      alternatives: [
        'Use polling for chat updates',
        'Deploy WebSocket server to a VM/VPS',
        'Use Pusher, Ably, or Socket.IO with Vercel Edge'
      ],
      status: 'unavailable'
    }, { status: 503 })
  }

  try {
    // Initialize WebSocket server if not already done
    if (!wss) {
      const result = initializeWebSocketServer()
      if (!result && serverInitializationError) {
        return new Response(JSON.stringify({
          error: 'Failed to initialize WebSocket server',
          details: serverInitializationError.message,
          port: 3001
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        })
      }
    }

    return new Response(JSON.stringify({
      status: wss ? 'WebSocket server running' : 'WebSocket server not initialized',
      port: 3001,
      path: '/ws/chat',
      connectedClients: clients.size,
      initialized: !!wss
    }), {
      status: wss ? 200 : 503,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    logger.error('Error checking WebSocket server status:', error, 'WebSocket')
    return new Response(JSON.stringify({
      error: 'Failed to check WebSocket server status',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}
