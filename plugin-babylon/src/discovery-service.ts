/**
 * Babylon Discovery Service for ElizaOS Plugin
 * 
 * Enables agents to discover Babylon game through the Agent0 registry.
 */

import { Service } from '@elizaos/core'
import type { IAgentRuntime } from '@elizaos/core'
import { logger } from '@elizaos/core'
import { GameDiscoveryService } from '../../src/agents/agent0/GameDiscovery'
import type { DiscoverableGame } from '../../src/agents/agent0/GameDiscovery'

export class BabylonDiscoveryService extends Service {
  static override serviceType = 'babylon-discovery' as const
  
  override capabilityDescription =
    'Babylon game discovery through Agent0 registry for permissionless agent onboarding'
  
  private gameDiscoveryService!: GameDiscoveryService
  
  constructor(runtime: IAgentRuntime) {
    super(runtime)
  }
  
  /**
   * Static factory method - called by ElizaOS
   */
  static override async start(
    runtime: IAgentRuntime
  ): Promise<BabylonDiscoveryService> {
    logger.info('Starting BabylonDiscoveryService', undefined, 'BabylonDiscoveryService')
    const service = new BabylonDiscoveryService(runtime)
    await service.initialize()
    return service
  }
  
  /**
   * Initialize discovery service
   */
  async initialize(): Promise<void> {
    if (process.env.AGENT0_ENABLED !== 'true') {
      this.runtime.logger.info('Agent0 integration disabled, discovery service unavailable', undefined, 'BabylonDiscoveryService')
      return
    }
    
    this.gameDiscoveryService = new GameDiscoveryService()
    this.runtime.logger.info('✅ BabylonDiscoveryService initialized', undefined, 'BabylonDiscoveryService')
  }
  
  /**
   * Discover and connect to Babylon
   * This is the main entry point for agents to find Babylon
   */
  async discoverAndConnect(): Promise<DiscoverableGame> {
    const babylon = await this.gameDiscoveryService.findBabylon()
    
    if (!babylon) {
      throw new Error('Babylon game not found in registry!')
    }
    
    // Store endpoints for other services to use
    this.runtime.setSetting!('babylon.a2aEndpoint', babylon.endpoints.a2a)
    this.runtime.setSetting!('babylon.mcpEndpoint', babylon.endpoints.mcp)
    this.runtime.setSetting!('babylon.apiEndpoint', babylon.endpoints.api)
    
    this.runtime.logger.info(`✅ Discovered Babylon: ${babylon.name}`, undefined, 'BabylonDiscoveryService')
    this.runtime.logger.info(`   A2A: ${babylon.endpoints.a2a}`, undefined, 'BabylonDiscoveryService')
    this.runtime.logger.info(`   MCP: ${babylon.endpoints.mcp}`, undefined, 'BabylonDiscoveryService')
    this.runtime.logger.info(`   API: ${babylon.endpoints.api}`, undefined, 'BabylonDiscoveryService')
    
    return babylon
  }
  
  /**
   * Discover all games matching filters
   */
  async discoverGames(filters?: {
    type?: string
    markets?: string[]
  }): Promise<DiscoverableGame[]> {
    return this.gameDiscoveryService.discoverGames({
      type: filters?.type || 'game-platform',
      markets: filters?.markets
    })
  }
  
  /**
   * Get game by token ID
   */
  async getGameByTokenId(tokenId: number): Promise<DiscoverableGame | null> {
    return this.gameDiscoveryService.getGameByTokenId(tokenId)
  }
  
  /**
   * Instance stop method - cleanup
   */
  override async stop(): Promise<void> {
    this.runtime.logger.info('✅ BabylonDiscoveryService stopped', undefined, 'BabylonDiscoveryService')
  }
  
  /**
   * Static stop method - called by ElizaOS
   */
  static override async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping BabylonDiscoveryService', undefined, 'BabylonDiscoveryService')
    const service = runtime.getService<BabylonDiscoveryService>(BabylonDiscoveryService.serviceType)
    await service?.stop()
  }
}

