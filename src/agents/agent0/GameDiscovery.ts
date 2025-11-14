/**
 * Game Discovery Service
 * 
 * Enables external agents to discover Babylon and other games
 * through the Agent0 registry.
 */

import { SubgraphClient } from './SubgraphClient'
import { IPFSPublisher } from './IPFSPublisher'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/database-service'

export interface DiscoverableGame {
  tokenId: number
  name: string
  type: string
  metadataCID: string
  endpoints: {
    a2a: string
    mcp: string
    api: string
    docs?: string
    websocket?: string
  }
  capabilities: {
    markets: string[]
    actions: string[]
    protocols: string[]
    socialFeatures?: boolean
    realtime?: boolean
  }
  reputation?: {
    trustScore: number
  }
}

export class GameDiscoveryService {
  private subgraphClient: SubgraphClient
  private ipfsPublisher: IPFSPublisher
  
  constructor() {
    this.subgraphClient = new SubgraphClient()
    this.ipfsPublisher = new IPFSPublisher()
  }
  
  /**
   * Discover games by type (prediction markets, trading games, etc.)
   * This is what external agents call to find Babylon
   */
  async discoverGames(filters: {
    type?: string  // "game-platform", "prediction-market", etc.
    markets?: string[]  // ["prediction", "perpetuals"]
    minReputation?: number
  }): Promise<DiscoverableGame[]> {
    const subgraphAgents = await this.subgraphClient.getGamePlatforms({
      markets: filters.markets,
      minTrustScore: filters.minReputation
    })
    
    const games: DiscoverableGame[] = []
    
    for (const agent of subgraphAgents) {
      const metadata = await this.ipfsPublisher.fetchMetadata(agent.metadataCID)
      
      games.push({
        tokenId: agent.tokenId,
        name: agent.name,
        type: agent.type || 'game-platform',
        metadataCID: agent.metadataCID,
        endpoints: {
          a2a: metadata.endpoints?.a2a || agent.a2aEndpoint || '',
          mcp: metadata.endpoints?.mcp || agent.mcpEndpoint || '',
          api: metadata.endpoints?.api || '',
          docs: metadata.endpoints?.docs,
          websocket: metadata.endpoints?.websocket
        },
        capabilities: {
          markets: metadata.capabilities?.markets || [],
          actions: metadata.capabilities?.actions || [],
          protocols: metadata.capabilities?.protocols || [],
          socialFeatures: metadata.capabilities?.socialFeatures,
          realtime: metadata.capabilities?.realtime
        },
        reputation: agent.reputation ? {
          trustScore: agent.reputation.trustScore
        } : undefined
      })
    }
    
    if (filters.type) {
      return games.filter(g => g.type === filters.type)
    }
    
    return games
  }
  
  /**
   * Find Babylon specifically with retry logic
   */
  async findBabylon(maxRetries: number = 3): Promise<DiscoverableGame | null> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      logger.info(`Discovering Babylon (attempt ${attempt}/${maxRetries})...`, undefined, 'GameDiscovery')
      
      const games = await this.discoverGames({
        type: 'game-platform',
        markets: ['prediction']
      })
      
      const babylon = games.find(g => 
        g.name.toLowerCase().includes('babylon') ||
        g.name.toLowerCase().includes('prediction market')
      )
      
      if (babylon) {
        const isValid = await this.validateEndpoints(babylon)
        if (isValid) {
          logger.info(`✅ Found and validated Babylon: ${babylon.name} (token: ${babylon.tokenId})`, undefined, 'GameDiscovery')
          return babylon
        }
        logger.warn(`Babylon found but endpoints failed validation (attempt ${attempt}/${maxRetries})`, undefined, 'GameDiscovery')
      } else {
        logger.warn(`Babylon not found in registry (attempt ${attempt}/${maxRetries})`, undefined, 'GameDiscovery')
      }
    
      if (process.env.NEXT_RUNTIME === 'nodejs') {
        const config = await prisma.gameConfig.findUnique({
          where: { key: 'agent0_registration' }
        })
        
        if (config?.value && typeof config.value === 'object' && 'tokenId' in config.value) {
          const tokenId = Number(config.value.tokenId)
          const agent = await this.subgraphClient.getAgent(tokenId)
          
          if (agent) {
            const metadata = await this.ipfsPublisher.fetchMetadata(agent.metadataCID)
            return {
              tokenId: agent.tokenId,
              name: agent.name,
              type: agent.type || 'game-platform',
              metadataCID: agent.metadataCID,
              endpoints: {
                a2a: metadata.endpoints?.a2a || agent.a2aEndpoint || '',
                mcp: metadata.endpoints?.mcp || agent.mcpEndpoint || '',
                api: metadata.endpoints?.api || '',
                docs: metadata.endpoints?.docs,
                websocket: metadata.endpoints?.websocket
              },
              capabilities: {
                markets: metadata.capabilities?.markets || [],
                actions: metadata.capabilities?.actions || [],
                protocols: metadata.capabilities?.protocols || [],
                socialFeatures: metadata.capabilities?.socialFeatures,
                realtime: metadata.capabilities?.realtime
              }
            }
          }
        }
      }
      
      if (attempt < maxRetries) {
        const backoffMs = 1000 * attempt
        logger.info(`Retrying in ${backoffMs}ms...`, undefined, 'GameDiscovery')
        await this.sleep(backoffMs)
      }
    }
    
    return null
  }
  
  /**
   * Validate that game endpoints are accessible
   */
  private async validateEndpoints(game: DiscoverableGame): Promise<boolean> {
    logger.debug(`Validating endpoints for ${game.name}...`, undefined, 'GameDiscovery')
    
    const validations: Promise<boolean>[] = []
    
    if (game.endpoints.mcp) {
      validations.push(this.validateMCPEndpoint(game.endpoints.mcp))
    }
    
    if (game.endpoints.api) {
      validations.push(this.validateAPIEndpoint(game.endpoints.api))
    }
    
    const results = await Promise.all(validations)
    const anyValid = results.some(r => r)
    
    logger.debug(anyValid ? `✅ Endpoints validated for ${game.name}` : `❌ No valid endpoints found for ${game.name}`, undefined, 'GameDiscovery')
    
    return anyValid
  }
  
  /**
   * Validate MCP endpoint
   */
  private async validateMCPEndpoint(mcpUrl: string): Promise<boolean> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(mcpUrl, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    
    clearTimeout(timeout)
    
    if (!response.ok) {
      return false
    }
    
    const data = await response.json()
    return !!(data && typeof data === 'object' && 'name' in data && 'tools' in data)
  }
  
  /**
   * Validate API endpoint
   */
  private async validateAPIEndpoint(apiUrl: string): Promise<boolean> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`${apiUrl}/markets`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    })
    
    clearTimeout(timeout)
    
    return response.ok || response.status === 401 || response.status === 403
  }
  
  /**
   * Sleep utility for retry backoff
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
  
  /**
   * Get game metadata by token ID
   */
  async getGameByTokenId(tokenId: number): Promise<DiscoverableGame | null> {
    const agent = await this.subgraphClient.getAgent(tokenId)
    if (!agent) {
      return null
    }
    
    const metadata = await this.ipfsPublisher.fetchMetadata(agent.metadataCID)
    
    return {
      tokenId: agent.tokenId,
      name: agent.name,
      type: agent.type || 'game-platform',
      metadataCID: agent.metadataCID,
      endpoints: {
        a2a: metadata.endpoints?.a2a || agent.a2aEndpoint || '',
        mcp: metadata.endpoints?.mcp || agent.mcpEndpoint || '',
        api: metadata.endpoints?.api || '',
        docs: metadata.endpoints?.docs,
        websocket: metadata.endpoints?.websocket
      },
      capabilities: {
        markets: metadata.capabilities?.markets || [],
        actions: metadata.capabilities?.actions || [],
        protocols: metadata.capabilities?.protocols || [],
        socialFeatures: metadata.capabilities?.socialFeatures,
        realtime: metadata.capabilities?.realtime
      },
      reputation: agent.reputation ? {
        trustScore: agent.reputation.trustScore
      } : undefined
    }
  }
}

/**
 * Get or create singleton GameDiscoveryService instance
 */
let gameDiscoveryInstance: GameDiscoveryService | null = null

export function getGameDiscoveryService(): GameDiscoveryService {
  if (!gameDiscoveryInstance) {
    gameDiscoveryInstance = new GameDiscoveryService()
  }
  return gameDiscoveryInstance
}

