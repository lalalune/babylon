/**
 * Discover Babylon Action
 * 
 * Allows agents to manually discover or refresh Babylon game endpoints
 * from the Agent0 registry.
 */

import type {
  Action,
  IAgentRuntime,
  Memory,
  State,
  HandlerCallback,
} from '@elizaos/core'
import { logger } from '../../../src/lib/logger'

export const discoverBabylonAction: Action = {
  name: 'DISCOVER_BABYLON',
  similes: ['FIND_BABYLON', 'REFRESH_BABYLON', 'LOCATE_GAME', 'DISCOVER_GAME'],
  description: 'Discover or refresh Babylon game endpoints from Agent0 registry. Use when you need to find the game or update endpoint information.',
  
  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    if (process.env.AGENT0_ENABLED !== 'true') {
      return false
    }
    
    const discoveryService = runtime.getService('babylon-discovery')
    return !!discoveryService
  },
  
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
    _options: Record<string, unknown>,
    callback?: HandlerCallback
  ): Promise<boolean> => {
    logger.info('Agent initiating Babylon discovery...')
    
    const discoveryService = runtime.getService('babylon-discovery') as {
      discoverAndConnect: () => Promise<{ name: string; endpoints: { api: string; a2a: string; mcp: string }; capabilities: { markets: string[] }; tokenId: number; reputation?: { trustScore: number } }>
    }
    
    const babylon = await discoveryService.discoverAndConnect()
    
    // Update runtime settings
    runtime.setSetting!('babylon.apiEndpoint', babylon.endpoints.api)
    runtime.setSetting!('babylon.a2aEndpoint', babylon.endpoints.a2a)
    runtime.setSetting!('babylon.mcpEndpoint', babylon.endpoints.mcp)
    
    const responseText = `✅ Discovered Babylon: ${babylon.name}
    
Endpoints updated:
- API: ${babylon.endpoints.api}
- A2A: ${babylon.endpoints.a2a}
- MCP: ${babylon.endpoints.mcp}

Capabilities: ${babylon.capabilities.markets.join(', ')}
Token ID: ${babylon.tokenId}
Reputation: ${babylon.reputation?.trustScore || 'N/A'}`
    
    if (callback) {
      callback({
        text: responseText,
        action: 'DISCOVER_BABYLON'
      })
    }
    
    logger.info('✅ Babylon discovery completed successfully')
    return true
  },
  
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: 'Find the Babylon game for me' }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'I\'ll discover Babylon from the Agent0 registry...',
          action: 'DISCOVER_BABYLON'
        }
      }
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'Refresh the game endpoints' }
      },
      {
        user: '{{agent}}',
        content: {
          text: 'Refreshing Babylon endpoints from registry...',
          action: 'DISCOVER_BABYLON'
        }
      }
    ]
  ]
}

