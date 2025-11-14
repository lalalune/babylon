/**
 * A2A WebSocket Server
 * Handles agent-to-agent communication via WebSocket and JSON-RPC 2.0
 */

import { WebSocketServer, WebSocket } from 'ws'
import { EventEmitter } from 'events'
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  A2AServerOptions,
  A2AServerConfig,
  AgentConnection} from '../types';
import {
  ErrorCode,
  A2AEventType
} from '../types'
import type { JsonRpcResult } from '@/types/json-rpc'
import { MessageRouter } from './message-router'
import { AuthManager } from './auth-manager'
import { RateLimiter } from '../utils/rate-limiter'
import { Logger } from '../utils/logger'
import type { RegistryClient } from '@/types/a2a-server'
import type { X402Manager } from '@/types/a2a-server'

import { createPortSingleton } from '@/utils/singleton'

// Singleton for A2A WebSocket server (port-aware)
const a2aServerSingleton = createPortSingleton<A2AWebSocketServer>('a2aGlobalServer', 'a2aGlobalPort')

// A2AServerOptions is now defined in types/index.ts
export class A2AWebSocketServer extends EventEmitter {
  private wss: WebSocketServer
  private connections: Map<string, AgentConnection & { ws: WebSocket }> = new Map()
  private router: MessageRouter
  private authManager: AuthManager
  private rateLimiter: RateLimiter
  private logger: Logger
  private config: A2AServerOptions & {
    host: string;
    maxConnections: number;
    messageRateLimit: number;
    authTimeout: number;
    enableX402: boolean;
    enableCoalitions: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  }
  private registryClient?: RegistryClient
  private x402Manager?: X402Manager
  private _ready: boolean = false
  private _initializationError: Error | null = null

  // Getters for singleton reuse
  get server(): WebSocketServer {
    return this.wss
  }

  get ready(): boolean {
    return this._ready
  }

  constructor(config: A2AServerOptions) {
    super()

    // Set defaults
    this.config = {
      port: config.port,
      host: config.host ?? '0.0.0.0',
      maxConnections: config.maxConnections ?? 1000,
      messageRateLimit: config.messageRateLimit ?? 100, // messages per minute
      authTimeout: config.authTimeout ?? 30000, // 30 seconds
      enableX402: config.enableX402 ?? true,
      enableCoalitions: config.enableCoalitions ?? true,
      logLevel: config.logLevel ?? 'info',
      registryClient: config.registryClient,
      x402Manager: config.x402Manager,
    }

    this.registryClient = config.registryClient
    this.x402Manager = config.x402Manager
    this.logger = new Logger(this.config.logLevel)
    
    // Extract Agent0-related clients from config
    const agent0Client = (config as A2AServerOptions).agent0Client
    const unifiedDiscovery = (config as A2AServerOptions).unifiedDiscovery
    
    this.router = new MessageRouter(
      this.config as Required<A2AServerConfig>,
      this.registryClient ?? undefined,
      this.x402Manager ?? undefined,
      agent0Client ?? undefined,
      unifiedDiscovery ?? undefined,
      this // Pass server for broadcasting
    )
    this.authManager = new AuthManager(this.registryClient, agent0Client ?? undefined)
    this.rateLimiter = new RateLimiter(this.config.messageRateLimit)

    // Check for existing server using singleton (prevent double initialization)
    const existing = a2aServerSingleton.getInstance(this.config.port)
    if (existing) {
      this.logger.info('Reusing existing A2A server from singleton', 'A2AWebSocketServer')
      // Copy references from existing server
      this.wss = existing.server
      this._ready = existing.ready || false
      return
    }
    
    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
      maxPayload: 1024 * 1024
    })

    this.wss.on('error', (error: Error & { code?: string }) => {
      if (error.code === 'EADDRINUSE') {
        this.logger.error(`Port ${this.config.port} is already in use. Please stop the process using this port or change the port configuration.`, error)
        this._initializationError = error
      } else {
        this.logger.error('WebSocket server error:', error)
        this._initializationError = error
      }
    })

    this.wss.on('listening', () => {
      this._ready = true
      this.logger.info(`A2A WebSocket server listening on ${this.config.host}:${this.config.port}`, 'A2AWebSocketServer')
      a2aServerSingleton.setInstance(this, this.config.port)
    })

    this.setupServer()
    this.logger.info(`A2A WebSocket server created on ${this.config.host}:${this.config.port}`, 'A2AWebSocketServer')
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientIp = req.socket.remoteAddress || 'unknown'
      const tempId = this.generateConnectionId()

      this.logger.debug(`New connection attempt: ${tempId} from ${clientIp}`)

      // Check connection limit
      if (this.connections.size >= this.config.maxConnections) {
        this.logger.warn(`Max connections reached, rejecting ${tempId}`)
        ws.close(1008, 'Server at capacity')
        return
      }

      // Set authentication timeout
      const authTimeout = setTimeout(() => {
        if (this.connections.get(tempId)?.authenticated === false) {
          this.logger.warn(`Authentication timeout for ${tempId}`)
          ws.close(1008, 'Authentication timeout')
          this.connections.delete(tempId)
        }
      }, this.config.authTimeout)

      ws.on('message', async (data: Buffer) => {
        const message = JSON.parse(data.toString()) as JsonRpcRequest

        if (!this.isValidJsonRpc(message)) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: ErrorCode.INVALID_REQUEST,
              message: 'Invalid JSON-RPC request'
            },
            id: null
          }))
          return
        }

        const connection = this.connections.get(tempId)

        if (message.method === 'a2a.handshake') {
          clearTimeout(authTimeout)
          await this.handleHandshake(ws, tempId, message)
          return
        }

        if (!connection?.authenticated) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: ErrorCode.NOT_AUTHENTICATED,
              message: 'Not authenticated. Please perform handshake first.'
            },
            id: message.id
          }))
          return
        }

        if (!this.rateLimiter.checkLimit(connection.agentId)) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: ErrorCode.RATE_LIMIT_EXCEEDED,
              message: 'Rate limit exceeded. Please slow down.'
            },
            id: message.id
          }))
          return
        }

        connection.lastActivity = Date.now()

        const response = await this.router.route(
          connection.agentId,
          message,
          connection
        )

        ws.send(JSON.stringify(response))
      })

      // Handle connection close
      ws.on('close', (code, reason) => {
        const connection = this.connections.get(tempId)
        if (connection) {
          this.logger.info(`Agent disconnected: ${connection.agentId || tempId} (code: ${code})`)
          this.emit(A2AEventType.AGENT_DISCONNECTED, {
            agentId: connection.agentId,
            reason: reason.toString(),
            code
          })
          this.connections.delete(tempId)
        }
      })

      // Handle errors
      ws.on('error', (error) => {
        this.logger.error(`WebSocket error for ${tempId}:`, error)
      })

      // Initialize connection (not authenticated yet)
      this.connections.set(tempId, {
        agentId: '',
        address: '',
        tokenId: 0,
        capabilities: { strategies: [], markets: [], actions: [], version: '' },
        authenticated: false,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        ws
      })
    })

    this.wss.on('error', (error: Error & { code?: string }) => {
      if (error.code === 'EADDRINUSE') {
        this.logger.error(`Port ${this.config.port} is already in use.`, error)
        // Emit error event so caller can handle it
        this.emit('error', error)
      } else {
        this.logger.error('WebSocket server error:', error)
      }
    })
  }

  private async handleHandshake(
    ws: WebSocket,
    tempId: string,
    message: JsonRpcRequest
  ): Promise<void> {
    const handshakeData = message.params as {
      credentials: {
        address: string
        tokenId: number
        signature: string
        timestamp: number
      }
      capabilities: {
        strategies: string[]
        markets: string[]
        actions: string[]
        version: string
      }
      endpoint: string
    }

    const authResult = await this.authManager.authenticate(handshakeData.credentials)

    if (!authResult.success) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: ErrorCode.AUTHENTICATION_FAILED,
          message: authResult.error || 'Authentication failed'
        },
        id: message.id
      }))
      ws.close(1008, 'Authentication failed')
      this.connections.delete(tempId)
      return
    }

    const connection = this.connections.get(tempId)!
    connection.agentId = `agent-${handshakeData.credentials.tokenId}`
    connection.address = handshakeData.credentials.address
    connection.tokenId = handshakeData.credentials.tokenId
    connection.capabilities = handshakeData.capabilities
    connection.authenticated = true

    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      result: {
        agentId: connection.agentId,
        sessionToken: authResult.sessionToken,
        serverCapabilities: this.getServerCapabilities(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000
      } as unknown as JsonRpcResult,
      id: message.id
    }

    ws.send(JSON.stringify(response))

    this.logger.info(`Agent authenticated: ${connection.agentId}`)
    this.emit(A2AEventType.AGENT_CONNECTED, {
      agentId: connection.agentId,
      address: connection.address,
      tokenId: connection.tokenId
    })
  }

  private isValidJsonRpc(message: unknown): message is JsonRpcRequest {
    if (typeof message !== 'object' || message === null) return false
    const msg = message as Record<string, unknown>
    return (
      msg.jsonrpc === '2.0' &&
      typeof msg.method === 'string' &&
      (typeof msg.id === 'string' || typeof msg.id === 'number')
    )
  }

  private generateConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private getServerCapabilities(): string[] {
    const capabilities = [
      'discovery',
      'market-data',
      'subscriptions'
    ]

    if (this.config.enableCoalitions) {
      capabilities.push('coalitions')
    }

    if (this.config.enableX402) {
      capabilities.push('micropayments')
    }

    return capabilities
  }

  // Broadcast message to specific agents
  public broadcast(agentIds: string[], message: unknown): void {
    for (const agentId of agentIds) {
      const connection = Array.from(this.connections.values())
        .find(conn => conn.agentId === agentId)

      if (connection?.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message))
      }
    }
  }

  // Broadcast to all connected agents
  public broadcastAll(message: unknown): void {
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN && connection.authenticated) {
        connection.ws.send(JSON.stringify(message))
      }
    }
  }

  // Get list of connected agents
  public getConnectedAgents(): AgentConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.authenticated)
      .map((conn) => {
        // Extract connection data without WebSocket instance
        // ws is intentionally omitted as it's not part of AgentConnection interface
        const { ws: _webSocket, ...connection } = conn
        // Validate connection is still open before including it
        if (_webSocket.readyState === WebSocket.OPEN) {
          return connection
        }
        return null
      })
      .filter((conn): conn is AgentConnection => conn !== null)
  }

  /**
   * Wait for server to be ready to accept connections
   */
  public async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already ready
      if (this._ready) {
        resolve()
        return
      }

      // Check if there's already an initialization error
      if (this._initializationError) {
        reject(this._initializationError)
        return
      }

      // Check if server is already listening by checking if address() returns non-null
      if (this.wss.address() !== null) {
        this._ready = true
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start within timeout'))
      }, 5000)

      // Check for existing error listeners - if error already happened, handle it
      const errorListener = (error: Error & { code?: string }) => {
        clearTimeout(timeout)
        this._initializationError = error
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.config.port} is already in use`))
        } else {
          reject(error)
        }
      }

      // Listen for errors (like port conflicts) and reject immediately
      // If error already occurred, it will be in the error listeners
      this.wss.once('error', errorListener)

      this.wss.once('listening', () => {
        clearTimeout(timeout)
        this._ready = true
        // Remove error listener since we're successful
        this.wss.removeListener('error', errorListener)
        resolve()
      })
    })
  }

  // Close server
  public async close(): Promise<void> {
    return new Promise((resolve) => {
      // Close all connections first
      const closePromises: Promise<void>[] = []

      for (const connection of this.connections.values()) {
        const closePromise = new Promise<void>((resolveClose) => {
          if (connection.ws.readyState === WebSocket.CLOSED) {
            resolveClose()
            return
          }

          connection.ws.once('close', () => resolveClose())
          connection.ws.close(1001, 'Server shutting down')

          // Timeout after 500ms
          setTimeout(() => resolveClose(), 500)
        })
        closePromises.push(closePromise)
      }

      // Wait for all connections to close, then close server
      Promise.all(closePromises).then(() => {
        this.connections.clear()

        // Set a timeout in case wss.close() never calls callback
        const timeout = setTimeout(() => {
          this.logger.info('A2A WebSocket server closed (forced)')
          resolve()
        }, 2000)

        this.wss.close((err) => {
          clearTimeout(timeout)
          if (err) {
            this.logger.error('Error closing WebSocket server:', err)
          } else {
            this.logger.info('A2A WebSocket server closed')
          }
          resolve()
        })
      })
    })
  }
}
