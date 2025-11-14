/**
 * WebSocket Server Integration Tests
 * Tests for the A2A WebSocket server
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { ethers } from 'ethers'
import WebSocket from 'ws'
import { A2AWebSocketServer } from '../../server/websocket-server'
import type { JsonRpcRequest, JsonRpcResponse, AgentCapabilities } from '../../types'
import { A2AMethod } from '../../types'

describe('A2AWebSocketServer Integration', () => {
  let server: A2AWebSocketServer
  let serverPort: number
  let wallet: ethers.Wallet

  beforeEach(async () => {
    // Use random port to avoid conflicts
    serverPort = 8000 + Math.floor(Math.random() * 1000)

    server = new A2AWebSocketServer({
      port: serverPort,
      host: 'localhost',
      maxConnections: 10,
      messageRateLimit: 100,
      authTimeout: 30000,
      enableX402: true,
      enableCoalitions: true,
      logLevel: 'error' // Reduce noise in tests
    })

    wallet = new ethers.Wallet('0x0123456789012345678901234567890123456789012345678901234567890123')

    // Wait for server to be ready
    await server.waitForReady()
  })

  afterEach(async () => {
    await server.close()
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  describe('Connection Management', () => {
    test('should accept WebSocket connections', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          expect(ws.readyState).toBe(WebSocket.OPEN)
          ws.close()
          resolve()
        })
        ws.on('error', reject)
      })
    })

    test('should handle connection close', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`)

      await new Promise<void>((resolve) => {
        ws.on('open', () => {
          ws.close()
        })
        ws.on('close', () => {
          expect(ws.readyState).toBe(WebSocket.CLOSED)
          resolve()
        })
      })
    })
  })

  describe('Authentication', () => {
    test('should authenticate with valid credentials', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          const timestamp = Date.now()
          const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${timestamp}`
          const signature = await wallet.signMessage(message)

          const capabilities: AgentCapabilities = {
            strategies: ['momentum'],
            markets: ['prediction'],
            actions: ['analyze'],
            version: '1.0.0'
          }

          const handshakeRequest: JsonRpcRequest = {
            jsonrpc: '2.0',
            method: A2AMethod.HANDSHAKE,
            params: {
              credentials: {
                address: wallet.address,
                tokenId: 1,
                signature,
                timestamp
              },
              capabilities,
              endpoint: `ws://localhost:${serverPort}`
            },
            id: 1
          }

          ws.send(JSON.stringify(handshakeRequest))
        })

        ws.on('message', (data: Buffer) => {
          const response = JSON.parse(data.toString()) as JsonRpcResponse

          if (response.id === 1) {
            expect(response.jsonrpc).toBe('2.0')
            expect(response.result).toBeDefined()
            expect(response.result.agentId).toBeDefined()
            expect(response.result.sessionToken).toBeDefined()
            expect(response.result.serverCapabilities).toBeDefined()
            ws.close()
            resolve()
          }
        })

        ws.on('error', reject)
      })
    })

    test('should reject unauthenticated requests', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', () => {
          // Try to call method without authentication
          const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method: A2AMethod.DISCOVER_AGENTS,
            params: {},
            id: 1
          }

          ws.send(JSON.stringify(request))
        })

        ws.on('message', (data: Buffer) => {
          const response = JSON.parse(data.toString()) as JsonRpcResponse

          expect(response.error).toBeDefined()
          expect(response.error!.message).toContain('Not authenticated')
          ws.close()
          resolve()
        })

        ws.on('error', reject)
      })
    })
  })

  describe('Message Routing', () => {
    async function authenticateClient(ws: WebSocket): Promise<string> {
      const timestamp = Date.now()
      const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${timestamp}`
      const signature = await wallet.signMessage(message)

      const capabilities: AgentCapabilities = {
        strategies: ['momentum'],
        markets: ['prediction'],
        actions: ['analyze'],
        version: '1.0.0'
      }

      const handshakeRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: A2AMethod.HANDSHAKE,
        params: {
          credentials: {
            address: wallet.address,
            tokenId: 1,
            signature,
            timestamp
          },
          capabilities,
          endpoint: `ws://localhost:${serverPort}`
        },
        id: 'handshake'
      }

      ws.send(JSON.stringify(handshakeRequest))

      return new Promise((resolve, reject) => {
        const messageHandler = (data: Buffer) => {
          const response = JSON.parse(data.toString()) as JsonRpcResponse
          if (response.id === 'handshake') {
            ws.removeListener('message', messageHandler)
            resolve(response.result.agentId)
          }
        }
        ws.on('message', messageHandler)
        ws.on('error', reject)
      })
    }

    test('should route discover agents request', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          await authenticateClient(ws)

          const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method: A2AMethod.DISCOVER_AGENTS,
            params: { filters: { strategies: ['momentum'] }, limit: 10 },
            id: 'discover'
          }

          ws.send(JSON.stringify(request))

          ws.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString()) as JsonRpcResponse
            if (response.id === 'discover') {
              expect(response.result).toBeDefined()
              expect(response.result.agents).toBeDefined()
              ws.close()
              resolve()
            }
          })
        })

        ws.on('error', reject)
      })
    })

    test('should handle market subscription', async () => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`)

      await new Promise<void>((resolve, reject) => {
        ws.on('open', async () => {
          await authenticateClient(ws)

          const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            method: A2AMethod.SUBSCRIBE_MARKET,
            params: { marketId: 'market-123' },
            id: 'subscribe'
          }

          ws.send(JSON.stringify(request))

          ws.on('message', (data: Buffer) => {
            const response = JSON.parse(data.toString()) as JsonRpcResponse
            if (response.id === 'subscribe') {
              expect(response.result).toBeDefined()
              expect(response.result.subscribed).toBe(true)
              ws.close()
              resolve()
            }
          })
        })

        ws.on('error', reject)
      })
    })
  })

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      // Create server with very low rate limit for testing
      await server.close()
      await new Promise(resolve => setTimeout(resolve, 100))

      server = new A2AWebSocketServer({
        port: serverPort,
        host: 'localhost',
        maxConnections: 10,
        messageRateLimit: 2, // Only 2 requests per minute
        authTimeout: 30000,
        enableX402: true,
        enableCoalitions: true,
        logLevel: 'error'
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      const ws = new WebSocket(`ws://localhost:${serverPort}`)

      await new Promise<void>((resolve, reject) => {
        let handshakeCompleted = false
        let rateLimitHit = false

        ws.on('open', async () => {
          const timestamp = Date.now()
          const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${timestamp}`
          const signature = await wallet.signMessage(message)

          const capabilities: AgentCapabilities = {
            strategies: ['momentum'],
            markets: ['prediction'],
            actions: ['analyze'],
            version: '1.0.0'
          }

          const handshakeRequest: JsonRpcRequest = {
            jsonrpc: '2.0',
            method: A2AMethod.HANDSHAKE,
            params: {
              credentials: {
                address: wallet.address,
                tokenId: 1,
                signature,
                timestamp
              },
              capabilities,
              endpoint: `ws://localhost:${serverPort}`
            },
            id: 'handshake'
          }

          ws.send(JSON.stringify(handshakeRequest))
        })

        ws.on('message', (data: Buffer) => {
          const response = JSON.parse(data.toString()) as JsonRpcResponse

          if (response.id === 'handshake') {
            handshakeCompleted = true

            // Send requests until rate limit is hit
            for (let i = 0; i < 5; i++) {
              const request: JsonRpcRequest = {
                jsonrpc: '2.0',
                method: A2AMethod.DISCOVER_AGENTS,
                params: {},
                id: `req-${i}`
              }
              ws.send(JSON.stringify(request))
            }
          } else if (handshakeCompleted) {
            // Check if any response has rate limit error
            if (response.error && response.error.message.includes('Rate limit')) {
              rateLimitHit = true
              expect(response.error.message).toContain('Rate limit')
              ws.close()
              resolve()
            }
          }
        })

        ws.on('error', reject)

        // Timeout if rate limit is never hit
        setTimeout(() => {
          if (!rateLimitHit) {
            reject(new Error('Rate limit was not enforced'))
          }
        }, 5000)
      })
    })
  })

  describe('Server Events', () => {
    test('should emit agent.connected event', async () => {
      return new Promise<void>((resolve, reject) => {
        server.on('agent.connected', (data) => {
          expect(data.agentId).toBeDefined()
          expect(data.address).toBeDefined()
          expect(data.tokenId).toBeDefined()
          resolve()
        })

        const ws = new WebSocket(`ws://localhost:${serverPort}`)

        ws.on('open', async () => {
          const timestamp = Date.now()
          const message = `A2A Authentication\n\nAddress: ${wallet.address}\nToken ID: 1\nTimestamp: ${timestamp}`
          const signature = await wallet.signMessage(message)

          const capabilities: AgentCapabilities = {
            strategies: ['momentum'],
            markets: ['prediction'],
            actions: ['analyze'],
            version: '1.0.0'
          }

          const handshakeRequest: JsonRpcRequest = {
            jsonrpc: '2.0',
            method: A2AMethod.HANDSHAKE,
            params: {
              credentials: {
                address: wallet.address,
                tokenId: 1,
                signature,
                timestamp
              },
              capabilities,
              endpoint: `ws://localhost:${serverPort}`
            },
            id: 1
          }

          ws.send(JSON.stringify(handshakeRequest))
        })

        ws.on('error', reject)

        setTimeout(() => reject(new Error('Timeout waiting for agent.connected event')), 5000)
      })
    })
  })
})
