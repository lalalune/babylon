/**
 * Agent0 Service for ElizaOS Plugin
 * 
 * Provides Agent0 network integration for agent discovery and feedback.
 */

import { Service } from '@elizaos/core'
import type { IAgentRuntime } from '@elizaos/core'
import { logger } from '@elizaos/core'
import { UnifiedDiscoveryService, getUnifiedDiscoveryService } from '../../src/agents/agent0/UnifiedDiscovery'
import { GameDiscoveryService } from '../../src/agents/agent0/GameDiscovery'
import { Agent0Client } from '../../src/agents/agent0/Agent0Client'

export class Agent0Service extends Service {
  static override serviceType = 'babylon-agent0' as const
  
  override capabilityDescription =
    'Agent0 network integration for permissionless agent discovery and reputation'
  
  private discoveryService: UnifiedDiscoveryService | null = null
  private gameDiscoveryService: GameDiscoveryService | null = null
  private agent0Client: Agent0Client | null = null
  
  constructor(runtime: IAgentRuntime) {
    super(runtime)
  }
  
  /**
   * Static factory method - called by ElizaOS
   */
  static override async start(
    runtime: IAgentRuntime,
    _config?: Record<string, unknown>
  ): Promise<Agent0Service> {
    logger.info('Starting Agent0Service', undefined, 'Agent0Service')
    const service = new Agent0Service(runtime)
    await service.initialize()
    return service
  }
  
  /**
   * Initialize Agent0 integration
   */
  async initialize(): Promise<void> {
    if (process.env.AGENT0_ENABLED !== 'true') {
      this.runtime.logger.info('Agent0 integration disabled', undefined, 'Agent0Service')
      return
    }
    
    this.discoveryService = getUnifiedDiscoveryService()
    this.gameDiscoveryService = new GameDiscoveryService()
    
    const privateKey = process.env.BABYLON_AGENT_PRIVATE_KEY || process.env.AGENT0_PRIVATE_KEY
    // Agent0 operations require Ethereum Sepolia RPC (not Base Sepolia)
    // Priority: AGENT0_RPC_URL > SEPOLIA_RPC_URL > fallback
    const rpcUrl = 
      process.env.AGENT0_RPC_URL || 
      process.env.SEPOLIA_RPC_URL || 
      process.env.NEXT_PUBLIC_RPC_URL ||
      'https://ethereum-sepolia-rpc.publicnode.com'
    
    if (privateKey && rpcUrl) {
      this.agent0Client = new Agent0Client({
        network: (process.env.AGENT0_NETWORK as 'sepolia' | 'mainnet') || 'sepolia',
        rpcUrl,
        privateKey
      })
    }
    
    this.runtime.logger.info('✅ Agent0 integration initialized', 'Agent0Service')
  }
  
  /**
   * Discover agents from both local registry and Agent0 network
   */
  async discoverAgents(filters?: {
    strategies?: string[]
    markets?: string[]
    includeExternal?: boolean
  }) {
    return this.discoveryService!.discoverAgents({
      strategies: filters?.strategies,
      markets: filters?.markets,
      includeExternal: filters?.includeExternal ?? true
    })
  }
  
  /**
   * Discover games (like Babylon)
   */
  async discoverGames(filters?: {
    type?: string
    markets?: string[]
  }) {
    return this.gameDiscoveryService!.discoverGames({
      type: filters?.type || 'game-platform',
      markets: filters?.markets
    })
  }
  
  /**
   * Find Babylon game specifically
   */
  async findBabylon() {
    const babylon = await this.gameDiscoveryService!.findBabylon()
    
    if (babylon) {
      this.runtime.setSetting!('babylon.a2aEndpoint', babylon.endpoints.a2a)
      this.runtime.setSetting!('babylon.mcpEndpoint', babylon.endpoints.mcp)
      this.runtime.setSetting!('babylon.apiEndpoint', babylon.endpoints.api)
      this.runtime.logger.info(`✅ Discovered Babylon: ${babylon.name}`, undefined, 'Agent0Service')
    }
    
    return babylon
  }
  
  /**
   * Submit feedback for an agent
   */
  async submitFeedback(targetAgentId: number, rating: number, comment: string): Promise<void> {
    await this.agent0Client!.submitFeedback({
      targetAgentId,
      rating,
      comment
    })
  }
  
  /**
   * Instance stop method - cleanup
   */
  override async stop(): Promise<void> {
    this.runtime.logger.info('✅ Agent0Service stopped', undefined, 'Agent0Service')
  }
  
  /**
   * Static stop method - called by ElizaOS
   */
  static override async stop(runtime: IAgentRuntime): Promise<void> {
    logger.info('Stopping Agent0Service', undefined, 'Agent0Service')
    const service = runtime.getService<Agent0Service>(Agent0Service.serviceType)!
    await service.stop()
  }
}

// Helper to get singleton UnifiedDiscoveryService
// Note: This function is imported statically at the top of the file
// to avoid circular dependencies and follow best practices

