// @ts-nocheck - Test file

/**
 * Complete A2A Integration Tests
 * 
 * Verifies that agents can:
 * 1. Register with Agent0
 * 2. Authenticate with Babylon A2A
 * 3. Call all A2A methods successfully
 * 4. Receive valid responses
 * 5. Validate on-chain identity
 */

import { test, expect } from '@playwright/test'
import { SDK } from 'agent0-sdk'
import WebSocket from 'ws'
import { Wallet } from 'ethers'

test.describe('Agents A2A Integration - End-to-End', () => {
  let agentWallet: Wallet
  let agentTokenId: number
  let a2aConnection: WebSocket
  let sessionToken: string

  test.beforeAll(async () => {
    // Create test wallet
    agentWallet = Wallet.createRandom()
    console.log('Test Agent Address:', agentWallet.address)
  })

  test.afterAll(async () => {
    if (a2aConnection) {
      a2aConnection.close()
    }
  })

  test('Phase 1: Agent0 Registration', async () => {
    test.skip(!process.env.AGENT0_PRIVATE_KEY, 'AGENT0_PRIVATE_KEY not set')

    const sdk = new SDK({
      chainId: 11155111, // Sepolia
      rpcUrl: process.env.AGENT0_RPC_URL!,
      signer: process.env.AGENT0_PRIVATE_KEY!,
      ipfs: 'node',
      subgraphUrl: process.env.AGENT0_SUBGRAPH_URL
    })

    const agent = sdk.createAgent(
      'Test Agent E2E',
      'End-to-end integration test agent',
      undefined
    )

    agent.setMetadata({
      capabilities: {
        strategies: ['test'],
        markets: ['prediction'],
        actions: ['trade'],
        version: '1.0.0'
      }
    })

    agent.setActive(true)

    // Register
    const registration = await agent.registerIPFS()

    expect(registration).toBeDefined()
    expect(registration.agentId).toBeDefined()
    
    const parts = registration.agentId!.split(':')
    agentTokenId = parseInt(parts[1]!)

    expect(agentTokenId).toBeGreaterThan(0)
    console.log('✅ Registered on Agent0: Token ID', agentTokenId)
  })

  test('Phase 2: A2A WebSocket Connection', async () => {
    test.skip(!process.env.AGENT0_PRIVATE_KEY, 'Test requires setup')

    const wsUrl = process.env.BABYLON_WS_URL || 'ws://localhost:3000'

    a2aConnection = await new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(wsUrl)
      
      ws.on('open', () => resolve(ws))
      ws.on('error', reject)
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    })

    expect(a2aConnection.readyState).toBe(WebSocket.OPEN)
    console.log('✅ Connected to A2A WebSocket')
  })

  test('Phase 3: A2A Authentication', async () => {
    test.skip(!a2aConnection, 'WebSocket not connected')

    const timestamp = Date.now()
    const message = `A2A Authentication\n\nAgent: ${agentWallet.address}\nToken: ${agentTokenId}\nTimestamp: ${timestamp}`
    const signature = await agentWallet.signMessage(message)

    const handshakeRequest = {
      jsonrpc: '2.0',
      method: 'a2a.handshake',
      params: {
        credentials: {
          address: agentWallet.address,
          tokenId: agentTokenId,
          signature,
          timestamp
        },
        capabilities: {
          strategies: ['test'],
          markets: ['prediction'],
          actions: ['trade'],
          version: '1.0.0'
        }
      },
      id: 1
    }

    // Send handshake
    const response = await new Promise<any>((resolve, reject) => {
      a2aConnection.once('message', (data) => {
        resolve(JSON.parse(data.toString()))
      })
      
      a2aConnection.send(JSON.stringify(handshakeRequest))
      
      setTimeout(() => reject(new Error('Handshake timeout')), 5000)
    })

    expect(response).toBeDefined()
    expect(response.result).toBeDefined()
    expect(response.result.agentId).toBeDefined()
    expect(response.result.sessionToken).toBeDefined()

    sessionToken = response.result.sessionToken
    console.log('✅ Authenticated with A2A')
    console.log('   Session:', sessionToken.substring(0, 16) + '...')
  })

  test('A2A Method: getPredictions', async () => {
    test.skip(!sessionToken, 'Not authenticated')

    const request = {
      jsonrpc: '2.0',
      method: 'a2a.getPredictions',
      params: { status: 'active' },
      id: 2
    }

    const response = await new Promise<any>((resolve, reject) => {
      a2aConnection.once('message', (data) => {
        resolve(JSON.parse(data.toString()))
      })
      
      a2aConnection.send(JSON.stringify(request))
      setTimeout(() => reject(new Error('Timeout')), 5000)
    })

    expect(response.result).toBeDefined()
    expect(Array.isArray(response.result.predictions) || response.result.predictions === undefined).toBe(true)
    console.log('✅ getPredictions:', response.result.predictions?.length || 0, 'markets')
  })

  test('A2A Method: getPerpetuals', async () => {
    test.skip(!sessionToken, 'Not authenticated')

    const request = {
      jsonrpc: '2.0',
      method: 'a2a.getPerpetuals',
      params: {},
      id: 3
    }

    const response = await new Promise<any>((resolve, reject) => {
      a2aConnection.once('message', (data) => {
        resolve(JSON.parse(data.toString()))
      })
      
      a2aConnection.send(JSON.stringify(request))
      setTimeout(() => reject(new Error('Timeout')), 5000)
    })

    expect(response.result).toBeDefined()
    console.log('✅ getPerpetuals:', response.result.perpetuals?.length || 0, 'markets')
  })

  test('A2A Method: getBalance', async () => {
    test.skip(!sessionToken, 'Not authenticated')

    const request = {
      jsonrpc: '2.0',
      method: 'a2a.getBalance',
      params: {},
      id: 4
    }

    const response = await new Promise<any>((resolve, reject) => {
      a2aConnection.once('message', (data) => {
        resolve(JSON.parse(data.toString()))
      })
      
      a2aConnection.send(JSON.stringify(request))
      setTimeout(() => reject(new Error('Timeout')), 5000)
    })

    expect(response.result).toBeDefined()
    expect(typeof response.result.balance).toBe('number')
    console.log('✅ getBalance:', response.result.balance)
  })

  test('A2A Method: getFeed', async () => {
    test.skip(!sessionToken, 'Not authenticated')

    const request = {
      jsonrpc: '2.0',
      method: 'a2a.getFeed',
      params: { limit: 10, offset: 0 },
      id: 5
    }

    const response = await new Promise<any>((resolve, reject) => {
      a2aConnection.once('message', (data) => {
        resolve(JSON.parse(data.toString()))
      })
      
      a2aConnection.send(JSON.stringify(request))
      setTimeout(() => reject(new Error('Timeout')), 5000)
    })

    expect(response.result).toBeDefined()
    expect(Array.isArray(response.result.posts) || response.result.posts === undefined).toBe(true)
    console.log('✅ getFeed:', response.result.posts?.length || 0, 'posts')
  })

  test('A2A Method: getPositions', async () => {
    test.skip(!sessionToken, 'Not authenticated')

    const request = {
      jsonrpc: '2.0',
      method: 'a2a.getPositions',
      params: { userId: a2aConnection ? 'test' : '' },
      id: 6
    }

    const response = await new Promise<any>((resolve, reject) => {
      a2aConnection.once('message', (data) => {
        resolve(JSON.parse(data.toString()))
      })
      
      a2aConnection.send(JSON.stringify(request))
      setTimeout(() => reject(new Error('Timeout')), 5000)
    })

    expect(response.result).toBeDefined()
    console.log('✅ getPositions: Valid response')
  })

  test('Agent0 On-Chain Validation', async () => {
    test.skip(!process.env.AGENT0_PRIVATE_KEY || !agentTokenId, 'Requires Agent0 setup')

    const sdk = new SDK({
      chainId: 11155111,
      rpcUrl: process.env.AGENT0_RPC_URL!,
      signer: process.env.AGENT0_PRIVATE_KEY!,
      subgraphUrl: process.env.AGENT0_SUBGRAPH_URL
    })

    // Query agent from subgraph
    const agentId = `11155111:${agentTokenId}`
    const agentData = await sdk.getAgent(agentId)

    expect(agentData).toBeDefined()
    expect(agentData?.name).toBeDefined()
    console.log('✅ Verified on-chain:', agentData?.name)
  })
})

export {}

