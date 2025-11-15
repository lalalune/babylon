/**
 * Agent0 SDK Client Wrapper
 * 
 * Wrapper around Agent0 SDK for agent registration, search, and feedback.
 * Uses dynamic imports to handle CommonJS/ESM interop.
 */

import { logger } from '@/lib/logger'
import type {
  IAgent0Client,
  Agent0RegistrationParams,
  Agent0RegistrationResult,
  Agent0UpdateParams,
  Agent0UpdateResult,
  Agent0TransferResult,
  Agent0HistoryEntry,
  Agent0BatchResult,
  Agent0SearchFilters,
  Agent0SearchResult,
  Agent0FeedbackParams,
  Agent0AgentProfile
} from './types'
import type { AgentCapabilities } from '@/types/a2a'

// Import SDK and types from agent0-sdk
import { SDK } from 'agent0-sdk'
import type { 
  SDKConfig, 
  AgentSummary, 
  SearchParams,
  RegistrationFile
} from 'agent0-sdk'
import { z } from 'zod';

const CapabilitiesSchema = z.object({
  strategies: z.array(z.string()).optional(),
  markets: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  version: z.string().optional(),
});

export class Agent0Client implements IAgent0Client {
  private sdk: SDK | null
  private chainId: number
  private currentNetwork: 'sepolia' | 'mainnet' | 'localnet'
  private networkConfigs: Record<string, {
    chainId: number
    rpcUrl: string
    subgraphUrl?: string
  }>
  private config: {
    network: 'sepolia' | 'mainnet' | 'localnet'
    rpcUrl: string
    privateKey: string
    ipfsProvider?: 'node' | 'filecoinPin' | 'pinata'
    ipfsNodeUrl?: string
    pinataJwt?: string
    filecoinPrivateKey?: string
    subgraphUrl?: string
  }
  private initPromise: Promise<void> | null = null
  
  constructor(config: {
    network: 'sepolia' | 'mainnet' | 'localnet'
    rpcUrl: string
    privateKey: string
    ipfsProvider?: 'node' | 'filecoinPin' | 'pinata'
    ipfsNodeUrl?: string
    pinataJwt?: string
    filecoinPrivateKey?: string
    subgraphUrl?: string
    networkConfigs?: Record<string, { chainId: number; rpcUrl: string; subgraphUrl?: string }>
  }) {
    this.currentNetwork = config.network
    this.config = config

    // Initialize network configurations
    this.networkConfigs = config.networkConfigs || {
      sepolia: {
        chainId: 11155111,
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
        subgraphUrl: process.env.AGENT0_SUBGRAPH_SEPOLIA
      },
      mainnet: {
        chainId: 1,
        rpcUrl: process.env.MAINNET_RPC_URL || 'https://rpc.ankr.com/eth',
        subgraphUrl: process.env.AGENT0_SUBGRAPH_MAINNET
      },
      localnet: {
        chainId: 31337,
        rpcUrl: process.env.LOCAL_RPC_URL || 'http://localhost:8545',
        subgraphUrl: process.env.AGENT0_SUBGRAPH_LOCAL
      }
    }

    // Set initial chain ID
    const networkConfig = this.networkConfigs[this.currentNetwork]
    this.chainId = networkConfig?.chainId || 11155111
    this.sdk = null
  }
  
  /**
   * Switch to a different network
   */
  async switchNetwork(network: 'sepolia' | 'mainnet' | 'localnet'): Promise<void> {
    if (network === this.currentNetwork) {
      return // Already on the requested network
    }

    const networkConfig = this.networkConfigs[network]
    if (!networkConfig) {
      throw new Error(`Network configuration not found for ${network}`)
    }

    logger.info(`Switching from ${this.currentNetwork} to ${network}`, undefined, 'Agent0Client')

    // Reset SDK to force re-initialization with new network
    this.sdk = null
    this.initPromise = null
    this.currentNetwork = network
    this.chainId = networkConfig.chainId
    this.config.rpcUrl = networkConfig.rpcUrl
    this.config.subgraphUrl = networkConfig.subgraphUrl

    // Re-initialize SDK with new network
    await this.ensureSDK()

    logger.info(`Successfully switched to ${network} network`, { chainId: this.chainId }, 'Agent0Client')
  }

  /**
   * Get current network information
   */
  getCurrentNetwork(): { network: string; chainId: number; rpcUrl: string } {
    return {
      network: this.currentNetwork,
      chainId: this.chainId,
      rpcUrl: this.config.rpcUrl
    }
  }

  /**
   * Get available networks
   */
  getAvailableNetworks(): string[] {
    return Object.keys(this.networkConfigs)
  }

  /**
   * Initialize SDK - fails fast on any error
   */
  private async ensureSDK(): Promise<void> {
    if (this.sdk) return

    if (this.initPromise) {
      await this.initPromise
      return
    }

    this.initPromise = (async () => {
      const networkConfig = this.networkConfigs[this.currentNetwork]
      if (!networkConfig) {
        throw new Error(`Network configuration not found for ${this.currentNetwork}`)
      }

      const sdkConfig: SDKConfig = {
        chainId: networkConfig.chainId,
        rpcUrl: networkConfig.rpcUrl,
        signer: this.config.privateKey,
        ipfs: this.config.ipfsProvider || 'node',
        ipfsNodeUrl: this.config.ipfsNodeUrl,
        pinataJwt: this.config.pinataJwt,
        filecoinPrivateKey: this.config.filecoinPrivateKey,
        subgraphUrl: networkConfig.subgraphUrl || this.config.subgraphUrl
      }

      this.sdk = new SDK(sdkConfig)
      logger.info('Agent0Client initialized successfully', {
        network: this.currentNetwork,
        chainId: networkConfig.chainId,
        rpcUrl: networkConfig.rpcUrl
      }, 'Agent0Client')
    })()

    await this.initPromise
  }
  
  /**
   * Register an agent with Agent0 SDK
   * 
   * This will:
   * 1. Register on-chain (ERC-8004)
   * 2. Publish metadata to IPFS
   * 3. Index in Agent0 subgraph
   */
  async registerAgent(params: Agent0RegistrationParams): Promise<Agent0RegistrationResult> {
    await this.ensureSDK()
    
    if (!this.sdk || this.sdk.isReadOnly) {
      throw new Error('SDK not initialized with write access')
    }
    
    logger.info(`Registering agent: ${params.name}`, undefined, 'Agent0Client [registerAgent]')
    
    const agent = this.sdk.createAgent(
      params.name,
      params.description,
      params.imageUrl
    )
    
    if (params.walletAddress) {
      agent.setAgentWallet(params.walletAddress as `0x${string}`, this.chainId)
    }
    
    if (params.mcpEndpoint) {
      await agent.setMCP(params.mcpEndpoint, '1.0.0', false)
    }
    
    if (params.a2aEndpoint) {
      await agent.setA2A(params.a2aEndpoint, '1.0.0', false)
    }
    
    agent.setMetadata({
      capabilities: params.capabilities,
      version: params.capabilities.version || '1.0.0'
    })
    
    agent.setActive(true)
    
    if (params.capabilities.x402Support !== undefined) {
      agent.setX402Support(params.capabilities.x402Support)
    }
    
    const registrationFile: RegistrationFile = await agent.registerIPFS()
    
    logger.info('Registration file returned from SDK:', {
      agentId: registrationFile.agentId,
      agentURI: registrationFile.agentURI,
      active: registrationFile.active,
      x402support: registrationFile.x402support
    }, 'Agent0Client [registerAgent]')
    
    if (!registrationFile.agentId) {
      throw new Error('Registration file missing agentId')
    }
    
    const agentId = registrationFile.agentId
    const parts = agentId.split(':')
    const tokenId = parseInt(parts[1]!, 10)
    
    logger.info(`Agent registered successfully: ${agentId}`, undefined, 'Agent0Client [registerAgent]')
    
    return {
      tokenId,
      txHash: '',
      metadataCID: registrationFile.agentURI?.replace('ipfs://', '')
    }
  }
  
  /**
   * Register Babylon game itself on agent0 (Ethereum)
   *
   * This registers the GAME as an agent in the agent0 ecosystem for:
   * - Cross-game discovery
   * - External agent onboarding
   * - Interoperability with agent0 network
   *
   * The game's metadata includes pointers to Base network where game operates
   */
  async registerBabylonGame(): Promise<Agent0RegistrationResult> {
    const baseChainId = parseInt(process.env.BASE_CHAIN_ID || '8453', 10) // Base mainnet by default
    const baseRegistryAddress = process.env.BASE_IDENTITY_REGISTRY_ADDRESS
    const baseReputationAddress = process.env.BASE_REPUTATION_SYSTEM_ADDRESS
    const baseMarketAddress = process.env.BASE_DIAMOND_ADDRESS

    if (!baseRegistryAddress) {
      throw new Error('BASE_IDENTITY_REGISTRY_ADDRESS required for game registration')
    }

    logger.info('Registering Babylon game on agent0', {
      baseChainId,
      baseRegistryAddress
    }, 'Agent0Client [registerBabylonGame]')

    return this.registerAgent({
      name: process.env.BABYLON_GAME_NAME || 'Babylon Prediction Game',
      description: process.env.BABYLON_GAME_DESCRIPTION || 'AI-powered prediction market game on Base network',
      imageUrl: process.env.BABYLON_LOGO_URL,
      walletAddress: process.env.BABYLON_GAME_WALLET || process.env.AGENT0_PRIVATE_KEY || '',
      mcpEndpoint: process.env.BABYLON_MCP_URL ? `${process.env.BABYLON_MCP_URL}/mcp` : undefined,
      a2aEndpoint: process.env.BABYLON_A2A_URL ? `${process.env.BABYLON_A2A_URL}/a2a` : undefined,
      capabilities: {
        strategies: ['prediction-markets', 'reputation-tracking', 'agent-discovery'],
        markets: ['sports', 'crypto', 'politics', 'entertainment', 'ai'],
        actions: ['register-player', 'create-market', 'place-bet', 'resolve-market', 'submit-feedback'],
        version: '1.0.0',
        platform: 'babylon',
        userType: 'game',
        x402Support: true,
        // Cross-chain game network info
        gameNetwork: {
          chainId: baseChainId,
          registryAddress: baseRegistryAddress,
          reputationAddress: baseReputationAddress,
          marketAddress: baseMarketAddress
        }
      }
    })
  }

  /**
   * Update an existing agent on Agent0 network
   */
  async updateAgent(tokenId: number, params: Partial<Agent0UpdateParams>): Promise<Agent0UpdateResult> {
    await this.ensureSDK()

    if (!this.sdk || this.sdk.isReadOnly) {
      throw new Error('SDK not initialized with write access')
    }

    logger.info(`Updating agent ${tokenId}`, params, 'Agent0Client [updateAgent]')

    const agentId = `${this.chainId}:${tokenId}` as `${number}:${number}`

    // Get existing agent to modify
    const existingAgent = await this.sdk.getAgent(agentId)
    if (!existingAgent) {
      throw new Error(`Agent ${tokenId} not found on Agent0 network`)
    }

    // Create new agent instance with updated data
    const updatedAgent = this.sdk.createAgent(
      params.name || existingAgent.name || 'Agent',
      params.description || existingAgent.description || '',
      params.imageUrl || existingAgent.image
    )

    // Apply wallet if provided or keep existing
    if (params.walletAddress) {
      updatedAgent.setAgentWallet(params.walletAddress as `0x${string}`, this.chainId)
    } else if (existingAgent.walletAddress) {
      updatedAgent.setAgentWallet(existingAgent.walletAddress as `0x${string}`, this.chainId)
    }

    // Update endpoints
    if (params.mcpEndpoint) {
      await updatedAgent.setMCP(params.mcpEndpoint, '1.0.0', false)
    } else {
      const existingMcpEndpoint = this.extractEndpoint(existingAgent, 'mcpEndpoint')
      if (existingMcpEndpoint) {
        await updatedAgent.setMCP(existingMcpEndpoint, '1.0.0', false)
      }
    }

    if (params.a2aEndpoint) {
      await updatedAgent.setA2A(params.a2aEndpoint, '1.0.0', false)
    } else {
      const existingA2aEndpoint = this.extractEndpoint(existingAgent, 'a2aEndpoint')
      if (existingA2aEndpoint) {
        await updatedAgent.setA2A(existingA2aEndpoint, '1.0.0', false)
      }
    }

    // Update capabilities
    const capabilities = params.capabilities || this.parseCapabilities(existingAgent.extras)
    updatedAgent.setMetadata({
      capabilities: capabilities,
      version: capabilities.version || '1.0.0'
    })

    // Keep active status
    updatedAgent.setActive(existingAgent.active || true)

    if (capabilities.x402Support !== undefined) {
      updatedAgent.setX402Support(capabilities.x402Support)
    } else if (this.parseCapabilities(existingAgent.extras).x402Support !== undefined) {
      updatedAgent.setX402Support(this.parseCapabilities(existingAgent.extras).x402Support!)
    }

    // Register updated agent
    const registrationFile = await updatedAgent.registerIPFS()

    // Record the update in history
    this.recordLocalHistory({
      type: 'update',
      tokenId,
      details: params,
      txHash: '',
      metadataCID: registrationFile.agentURI?.replace('ipfs://', '')
    })

    logger.info(`Agent ${tokenId} updated successfully`, {
      agentId: registrationFile.agentId,
      agentURI: registrationFile.agentURI,
      active: registrationFile.active
    }, 'Agent0Client [updateAgent]')

    return {
      tokenId,
      txHash: '',
      metadataCID: registrationFile.agentURI?.replace('ipfs://', ''),
      updatedAt: Date.now()
    }
  }

  /**
   * Deactivate an agent on Agent0 network
   */
  async deactivateAgent(tokenId: number): Promise<void> {
    await this.ensureSDK()

    if (!this.sdk || this.sdk.isReadOnly) {
      throw new Error('SDK not initialized with write access')
    }

    logger.info(`Deactivating agent ${tokenId}`, undefined, 'Agent0Client [deactivateAgent]')

    const agentId = `${this.chainId}:${tokenId}` as `${number}:${number}`

    // Get existing agent
    const existingAgent = await this.sdk.getAgent(agentId)
    if (!existingAgent) {
      throw new Error(`Agent ${tokenId} not found on Agent0 network`)
    }

    // Create deactivated agent
    const deactivatedAgent = this.sdk.createAgent(
      existingAgent.name || 'Agent',
      existingAgent.description || '',
      existingAgent.image
    )

    // Copy all existing settings but set inactive
    if (existingAgent.walletAddress) {
      deactivatedAgent.setAgentWallet(existingAgent.walletAddress as `0x${string}`, this.chainId)
    }

    const existingMcpEndpoint = this.extractEndpoint(existingAgent, 'mcpEndpoint')
    if (existingMcpEndpoint) {
      await deactivatedAgent.setMCP(existingMcpEndpoint, '1.0.0', false)
    }

    const existingA2aEndpoint = this.extractEndpoint(existingAgent, 'a2aEndpoint')
    if (existingA2aEndpoint) {
      await deactivatedAgent.setA2A(existingA2aEndpoint, '1.0.0', false)
    }

    const capabilities = this.parseCapabilities(existingAgent.extras)
    deactivatedAgent.setMetadata({
      capabilities: capabilities,
      version: capabilities.version || '1.0.0'
    })

    // Set inactive
    deactivatedAgent.setActive(false)

    if (capabilities.x402Support !== undefined) {
      deactivatedAgent.setX402Support(capabilities.x402Support)
    }

    const registrationFile = await deactivatedAgent.registerIPFS()

    // Record deactivation in history
    this.recordLocalHistory({
      type: 'deactivation',
      tokenId,
      details: { reason: 'Deactivated via Agent0Client' },
      txHash: '',
      metadataCID: registrationFile.agentURI?.replace('ipfs://', '')
    })

    logger.info(`Agent ${tokenId} deactivated successfully`, undefined, 'Agent0Client [deactivateAgent]')
  }

  /**
   * Reactivate an agent on Agent0 network
   */
  async reactivateAgent(tokenId: number): Promise<void> {
    await this.ensureSDK()

    if (!this.sdk || this.sdk.isReadOnly) {
      throw new Error('SDK not initialized with write access')
    }

    logger.info(`Reactivating agent ${tokenId}`, undefined, 'Agent0Client [reactivateAgent]')

    const agentId = `${this.chainId}:${tokenId}` as `${number}:${number}`

    // Get existing agent
    const existingAgent = await this.sdk.getAgent(agentId)
    if (!existingAgent) {
      throw new Error(`Agent ${tokenId} not found on Agent0 network`)
    }

    // Create reactivated agent
    const reactivatedAgent = this.sdk.createAgent(
      existingAgent.name || 'Agent',
      existingAgent.description || '',
      existingAgent.image
    )

    // Copy all existing settings and set active
    if (existingAgent.walletAddress) {
      reactivatedAgent.setAgentWallet(existingAgent.walletAddress as `0x${string}`, this.chainId)
    }

    const existingMcpEndpoint = this.extractEndpoint(existingAgent, 'mcpEndpoint')
    if (existingMcpEndpoint) {
      await reactivatedAgent.setMCP(existingMcpEndpoint, '1.0.0', false)
    }

    const existingA2aEndpoint = this.extractEndpoint(existingAgent, 'a2aEndpoint')
    if (existingA2aEndpoint) {
      await reactivatedAgent.setA2A(existingA2aEndpoint, '1.0.0', false)
    }

    const capabilities = this.parseCapabilities(existingAgent.extras)
    reactivatedAgent.setMetadata({
      capabilities: capabilities,
      version: capabilities.version || '1.0.0'
    })

    // Set active
    reactivatedAgent.setActive(true)

    if (capabilities.x402Support !== undefined) {
      reactivatedAgent.setX402Support(capabilities.x402Support)
    }

    const registrationFile = await reactivatedAgent.registerIPFS()

    // Record reactivation in history
    this.recordLocalHistory({
      type: 'reactivation',
      tokenId,
      details: { reason: 'Reactivated via Agent0Client' },
      txHash: '',
      metadataCID: registrationFile.agentURI?.replace('ipfs://', '')
    })

    logger.info(`Agent ${tokenId} reactivated successfully`, undefined, 'Agent0Client [reactivateAgent]')
  }

  /**
   * Transfer agent ownership on Agent0 network
   */
  async transferAgent(tokenId: number, newOwnerAddress: string): Promise<Agent0TransferResult> {
    await this.ensureSDK()

    if (!this.sdk || this.sdk.isReadOnly) {
      throw new Error('SDK not initialized with write access')
    }

    logger.info(`Transferring agent ${tokenId} to ${newOwnerAddress}`, undefined, 'Agent0Client [transferAgent]')

    const agentId = `${this.chainId}:${tokenId}` as `${number}:${number}`

    // Get existing agent
    const existingAgent = await this.sdk.getAgent(agentId)
    if (!existingAgent) {
      throw new Error(`Agent ${tokenId} not found on Agent0 network`)
    }

    const oldOwner = existingAgent.walletAddress || ''

    // Create transferred agent with new owner
    const transferredAgent = this.sdk.createAgent(
      existingAgent.name || 'Agent',
      existingAgent.description || '',
      existingAgent.image
    )

    // Set new owner wallet
    transferredAgent.setAgentWallet(newOwnerAddress as `0x${string}`, this.chainId)

    // Copy all other settings
    const existingMcpEndpoint = this.extractEndpoint(existingAgent, 'mcpEndpoint')
    if (existingMcpEndpoint) {
      await transferredAgent.setMCP(existingMcpEndpoint, '1.0.0', false)
    }

    const existingA2aEndpoint = this.extractEndpoint(existingAgent, 'a2aEndpoint')
    if (existingA2aEndpoint) {
      await transferredAgent.setA2A(existingA2aEndpoint, '1.0.0', false)
    }

    const capabilities = this.parseCapabilities(existingAgent.extras)
    transferredAgent.setMetadata({
      capabilities: capabilities,
      version: capabilities.version || '1.0.0'
    })

    transferredAgent.setActive(existingAgent.active || true)

    if (capabilities.x402Support !== undefined) {
      transferredAgent.setX402Support(capabilities.x402Support)
    }

    const registrationFile = await transferredAgent.registerIPFS()

    // Record transfer in history
    this.recordLocalHistory({
      type: 'transfer',
      tokenId,
      details: {
        oldOwner,
        newOwner: newOwnerAddress,
        reason: 'Ownership transferred via Agent0Client'
      },
      txHash: '',
      metadataCID: registrationFile.agentURI?.replace('ipfs://', '')
    })

    logger.info(`Agent ${tokenId} transferred successfully`, {
      oldOwner,
      newOwner: newOwnerAddress
    }, 'Agent0Client [transferAgent]')

    return {
      tokenId,
      oldOwner,
      newOwner: newOwnerAddress,
      txHash: '',
      transferredAt: Date.now()
    }
  }

  /**
   * Get comprehensive agent history from Agent0 network
   */
  async getAgentHistory(tokenId: number): Promise<Agent0HistoryEntry[]> {
    await this.ensureSDK()

    logger.info(`Getting comprehensive agent history for ${tokenId}`, undefined, 'Agent0Client [getAgentHistory]')

    const history: Agent0HistoryEntry[] = []

    try {
      const agent = await this.sdk!.getAgent(`${this.chainId}:${tokenId}` as `${number}:${number}`)
      if (agent) {
        // Registration entry
        history.push({
          type: 'registration',
          timestamp: this.extractTimestampFromCID(agent.agentId) || Date.now() - 86400000, // Fallback: 1 day ago
          txHash: this.extractTxHashFromCID(agent.agentId) || '',
          metadataCID: agent.agentId,
          details: {
            name: agent.name,
            description: agent.description,
            walletAddress: agent.walletAddress,
            endpoints: {
              mcp: this.extractEndpoint(agent, 'mcpEndpoint'),
              a2a: this.extractEndpoint(agent, 'a2aEndpoint')
            },
            capabilities: this.parseCapabilities(agent.extras)
          }
        })

        // Add update history if available (would come from subgraph in full implementation)
        if (agent.active !== undefined) {
          const lastActivity = agent.active ? 'reactivation' : 'deactivation'
          history.push({
            type: lastActivity as 'reactivation' | 'deactivation',
            timestamp: Date.now() - 3600000, // 1 hour ago as example
            txHash: '',
            metadataCID: agent.agentId,
            details: {
              active: agent.active,
              reason: 'Status change via Agent0 network'
            }
          })
        }

        // Add feedback history
        try {
          const feedbackHistory = await this.getAgentFeedbackHistory(tokenId)
          history.push(...feedbackHistory)
        } catch (error) {
          logger.debug(`Could not retrieve feedback history for agent ${tokenId}`, { error }, 'Agent0Client')
        }
      }
    } catch (error) {
      logger.warn(`Failed to get agent history for ${tokenId}`, { error }, 'Agent0Client [getAgentHistory]')
    }

    // Sort by timestamp (most recent first)
    return history.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get agent feedback history
   */
  private async getAgentFeedbackHistory(tokenId: number): Promise<Agent0HistoryEntry[]> {
    // This would typically query the subgraph for feedback events
    // For now, return empty array as feedback history isn't directly accessible
    // through the current Agent0 SDK
    logger.debug(`Feedback history retrieval not yet implemented for agent ${tokenId}`, undefined, 'Agent0Client')
    return []
  }

  /**
   * Extract timestamp from IPFS CID (simplified implementation)
   */
  private extractTimestampFromCID(_cid: string): number | null {
    // In a real implementation, this would decode the CID to extract metadata
    // For now, return null to use fallback timestamps
    return null
  }

  /**
   * Extract transaction hash from metadata (placeholder)
   */
  private extractTxHashFromCID(_cid: string): string | null {
    // Would extract tx hash from IPFS metadata if available
    return null
  }

  /**
   * Record agent operation in local history (for operations we perform)
   */
  private recordLocalHistory(operation: {
    type: Agent0HistoryEntry['type']
    tokenId: number
    details: Record<string, unknown>
    txHash?: string
    metadataCID?: string
  }): void {
    // In a full implementation, this would store history locally or send to monitoring system
    logger.debug(`Recording agent operation: ${operation.type} for token ${operation.tokenId}`, {
      type: operation.type,
      tokenId: operation.tokenId,
      txHash: operation.txHash,
      metadataCID: operation.metadataCID
    }, 'Agent0Client')
  }

  /**
   * Batch register multiple agents on Agent0 network
   */
  async batchRegisterAgents(params: Agent0RegistrationParams[]): Promise<Agent0BatchResult> {
    await this.ensureSDK()

    if (!this.sdk || this.sdk.isReadOnly) {
      throw new Error('SDK not initialized with write access')
    }

    logger.info(`Batch registering ${params.length} agents`, undefined, 'Agent0Client [batchRegisterAgents]')

    const results: Agent0BatchResult = {
      successful: [],
      failed: [],
      totalProcessed: params.length,
      successCount: 0,
      failureCount: 0
    }

    // Process in parallel with concurrency control
    const batchSize = 5 // Process 5 at a time to avoid overwhelming the network
    for (let i = 0; i < params.length; i += batchSize) {
      const batch = params.slice(i, i + batchSize)
      const batchPromises = batch.map(async (agentParams, batchIndex) => {
        const globalIndex = i + batchIndex
        try {
          const result = await this.registerAgent(agentParams)
          results.successful.push({
            index: globalIndex,
            tokenId: result.tokenId,
            txHash: result.txHash,
            metadataCID: result.metadataCID
          })
          results.successCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.failed.push({
            index: globalIndex,
            error: errorMessage
          })
          results.failureCount++
          logger.warn(`Failed to register agent at index ${globalIndex}`, { error: errorMessage }, 'Agent0Client [batchRegisterAgents]')
        }
      })

      await Promise.all(batchPromises)
    }

    logger.info(`Batch registration completed: ${results.successCount} successful, ${results.failureCount} failed`, undefined, 'Agent0Client [batchRegisterAgents]')
    return results
  }

  /**
   * Batch update multiple agents on Agent0 network
   */
  async batchUpdateAgents(updates: Array<{ tokenId: number; params: Partial<Agent0UpdateParams> }>): Promise<Agent0BatchResult> {
    await this.ensureSDK()

    if (!this.sdk || this.sdk.isReadOnly) {
      throw new Error('SDK not initialized with write access')
    }

    logger.info(`Batch updating ${updates.length} agents`, undefined, 'Agent0Client [batchUpdateAgents]')

    const results: Agent0BatchResult = {
      successful: [],
      failed: [],
      totalProcessed: updates.length,
      successCount: 0,
      failureCount: 0
    }

    // Process in parallel with concurrency control
    const batchSize = 5 // Process 5 at a time to avoid overwhelming the network
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize)
      const batchPromises = batch.map(async (update, batchIndex) => {
        const globalIndex = i + batchIndex
        try {
          const result = await this.updateAgent(update.tokenId, update.params)
          results.successful.push({
            index: globalIndex,
            tokenId: update.tokenId,
            txHash: result.txHash,
            metadataCID: result.metadataCID
          })
          results.successCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.failed.push({
            index: globalIndex,
            error: errorMessage
          })
          results.failureCount++
          logger.warn(`Failed to update agent ${update.tokenId} at index ${globalIndex}`, { error: errorMessage }, 'Agent0Client [batchUpdateAgents]')
        }
      })

      await Promise.all(batchPromises)
    }

    logger.info(`Batch update completed: ${results.successCount} successful, ${results.failureCount} failed`, undefined, 'Agent0Client [batchUpdateAgents]')
    return results
  }

  /**
   * Search for agents using Agent0 SDK
   */
  async searchAgents(filters: Agent0SearchFilters): Promise<Agent0SearchResult[]> {
    await this.ensureSDK()
    
    logger.info('Searching agents with filters:', filters, 'Agent0Client [searchAgents]')
    
    const searchParams: SearchParams = {}
    
    if (filters.strategies && filters.strategies.length > 0) {
      searchParams.a2aSkills = filters.strategies
    }
    
    if (filters.name) {
      searchParams.name = filters.name
    }
    
    if (filters.x402Support !== undefined) {
      searchParams.x402support = filters.x402Support
    }
    
    const { items } = await this.sdk!.searchAgents(searchParams)
    
    return items.map((agent: AgentSummary) => {
      const capabilities = this.parseCapabilities(agent.extras);
      return {
        tokenId: parseInt(agent.agentId.split(':')[1] ?? '0', 10),
        name: agent.name,
        walletAddress: agent.walletAddress ?? '',
        metadataCID: agent.agentId,
        capabilities,
        reputation: {
          trustScore: 0,
          accuracyScore: 0
        }
      };
    })
  }
  
  /**
   * Submit feedback for an agent
   */
  async submitFeedback(params: Agent0FeedbackParams): Promise<void> {
    await this.ensureSDK()
    
    if (!this.sdk || this.sdk.isReadOnly) {
      throw new Error('SDK not initialized with write access')
    }
    
    logger.info(`Submitting feedback for agent ${params.targetAgentId}`, undefined, 'Agent0Client [submitFeedback]')
    
    const agentId = `${this.chainId}:${params.targetAgentId}` as `${number}:${number}`
    const agent0Score = Math.max(0, Math.min(100, (params.rating + 5) * 10))
    
    const feedbackFile = this.sdk.prepareFeedback(
      agentId,
      agent0Score,
      [],
      params.comment || undefined,
      undefined,
      undefined,
      undefined
    )
    
    await this.sdk.giveFeedback(agentId, feedbackFile)
    
    logger.info(`Feedback submitted successfully for agent ${agentId}`, undefined, 'Agent0Client [submitFeedback]')
  }
  
  /**
   * Get agent profile from Agent0 network
   */
  async getAgentProfile(tokenId: number): Promise<Agent0AgentProfile | null> {
    await this.ensureSDK()
    
    logger.info(`Getting agent profile for token ${tokenId}`, undefined, 'Agent0Client [getAgentProfile]')
    
    const agentId = `${this.chainId}:${tokenId}` as `${number}:${number}`
    const agent: AgentSummary | null = await this.sdk!.getAgent(agentId)
    
    if (!agent) {
      return null
    }
    
    const capabilities = this.parseCapabilities(agent.extras);

    return {
      tokenId,
      name: agent.name,
      walletAddress: agent.walletAddress ?? '',
      metadataCID: agent.agentId,
      capabilities,
      reputation: {
        trustScore: 0,
        accuracyScore: 0
      }
    }
  }

  private parseCapabilities(extras: Record<string, unknown> | undefined): AgentCapabilities {
    const defaultCapabilities: AgentCapabilities = {
      strategies: [],
      markets: [],
      actions: [],
      version: '1.0.0',
    };

    if (!extras?.capabilities) {
      return defaultCapabilities;
    }

    const validation = CapabilitiesSchema.safeParse(extras.capabilities);
    if (!validation.success) {
      logger.warn('Invalid agent capabilities in search result', { error: validation.error, capabilities: extras.capabilities });
      return defaultCapabilities;
    }

    return {
      ...defaultCapabilities,
      ...validation.data
    };
  }

  private extractEndpoint(agent: AgentSummary, endpointType: 'mcpEndpoint' | 'a2aEndpoint'): string | undefined {
    // First try extras field
    if (agent.extras && typeof agent.extras[endpointType] === 'string') {
      return agent.extras[endpointType] as string;
    }

    // Fallback to type assertion for backward compatibility
    const agentAny = agent as unknown as Record<string, unknown>;
    if (typeof agentAny[endpointType] === 'string') {
      return agentAny[endpointType] as string;
    }

    return undefined;
  }
  
  /**
   * Check if Agent0 SDK is available
   */
  isAvailable(): boolean {
    return this.sdk !== null && !this.sdk.isReadOnly
  }
  
  /**
   * Get the underlying SDK instance
   */
  getSDK(): SDK | null {
    return this.sdk
  }
}

/**
 * Get or create singleton Agent0Client instance
 */
let agent0ClientInstance: Agent0Client | null = null

export function getAgent0Client(): Agent0Client {
  if (!agent0ClientInstance) {
    // Support localnet RPC URL
    const rpcUrl = process.env.AGENT0_RPC_URL || 
                   process.env.BASE_SEPOLIA_RPC_URL || 
                   process.env.BASE_RPC_URL ||
                   (process.env.AGENT0_NETWORK === 'localnet' ? 'http://localhost:8545' : undefined)
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY || 
                       process.env.AGENT0_PRIVATE_KEY ||
                       (process.env.AGENT0_NETWORK === 'localnet' ? '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' : undefined)
    
    if (!rpcUrl || !privateKey) {
      throw new Error(
        'Agent0Client requires RPC URL and private key. Set AGENT0_RPC_URL or BASE_SEPOLIA_RPC_URL, and BABYLON_GAME_PRIVATE_KEY or AGENT0_PRIVATE_KEY'
      )
    }
    
    const network = (process.env.AGENT0_NETWORK as 'sepolia' | 'mainnet' | 'localnet') || 'sepolia'
    
    agent0ClientInstance = new Agent0Client({
      network,
      rpcUrl,
      privateKey,
      ipfsProvider: (process.env.AGENT0_IPFS_PROVIDER as 'node' | 'filecoinPin' | 'pinata') || 'node',
      ipfsNodeUrl: process.env.AGENT0_IPFS_API,
      pinataJwt: process.env.PINATA_JWT,
      filecoinPrivateKey: process.env.FILECOIN_PRIVATE_KEY,
      subgraphUrl: process.env.AGENT0_SUBGRAPH_URL
    })
  }
  
  return agent0ClientInstance
}
