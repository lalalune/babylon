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
  Agent0SearchFilters,
  Agent0SearchResult,
  Agent0FeedbackParams,
  Agent0AgentProfile
} from './types'

// Import SDK and types from agent0-sdk
import { SDK } from 'agent0-sdk'
import type { 
  SDKConfig, 
  AgentSummary, 
  SearchParams,
  RegistrationFile
} from 'agent0-sdk'

export class Agent0Client implements IAgent0Client {
  private sdk: SDK | null
  private chainId: number
  private config: {
    network: 'sepolia' | 'mainnet'
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
    network: 'sepolia' | 'mainnet'
    rpcUrl: string
    privateKey: string
    ipfsProvider?: 'node' | 'filecoinPin' | 'pinata'
    ipfsNodeUrl?: string
    pinataJwt?: string
    filecoinPrivateKey?: string
    subgraphUrl?: string
  }) {
    this.chainId = config.network === 'sepolia' ? 11155111 : 1
    this.config = config
    this.sdk = null
  }
  
  /**
   * Initialize SDK lazily
   */
  private async ensureSDK(): Promise<void> {
    if (this.sdk) return
    
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      await this.initPromise
      return
    }
    
    this.initPromise = (async () => {
      try {
        const sdkConfig: SDKConfig = {
          chainId: this.chainId,
          rpcUrl: this.config.rpcUrl,
          signer: this.config.privateKey,
          ipfs: this.config.ipfsProvider || 'node',
          ipfsNodeUrl: this.config.ipfsNodeUrl,
          pinataJwt: this.config.pinataJwt,
          filecoinPrivateKey: this.config.filecoinPrivateKey,
          subgraphUrl: this.config.subgraphUrl
        }
        
        this.sdk = new SDK(sdkConfig)
        logger.info('Agent0Client initialized successfully', { 
          chainId: this.chainId, 
          rpcUrl: this.config.rpcUrl 
        }, 'Agent0Client')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error('Failed to initialize Agent0Client', {
          error: errorMessage,
          stack: errorStack,
          config: { chainId: this.chainId, rpcUrl: this.config.rpcUrl, network: this.config.network }
        }, 'Agent0Client')
        this.sdk = null
        this.initPromise = null
        throw new Error(`Agent0Client initialization failed: ${errorMessage}`)
      }
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
    
    if (!this.sdk) {
      throw new Error('SDK not initialized')
    }
    
    if (this.sdk.isReadOnly) {
      throw new Error('Agent0Client not properly initialized with signer')
    }
    
    logger.info(`Registering agent: ${params.name}`, undefined, 'Agent0Client [registerAgent]')
    
    try {
      // Create agent instance
      const agent = this.sdk.createAgent(
        params.name,
        params.description,
        params.imageUrl
      )
      
      // Set wallet address if provided
      if (params.walletAddress) {
        agent.setAgentWallet(params.walletAddress as `0x${string}`, this.chainId)
      }
      
      // Set endpoints
      if (params.mcpEndpoint) {
        // Use semantic version for Babylon's MCP implementation
        await agent.setMCP(params.mcpEndpoint, '1.0.0', false)
      }
      
      if (params.a2aEndpoint) {
        // Use semantic version for Babylon's A2A implementation
        await agent.setA2A(params.a2aEndpoint, '1.0.0', false)
      }
      
      // Set capabilities in metadata
      agent.setMetadata({
        capabilities: params.capabilities,
        version: params.capabilities.version || '1.0.0'
      })
      
      // Set agent as active (required for proper registration)
      agent.setActive(true)
      
      // Set X402 support if applicable
      if (params.capabilities.x402Support !== undefined) {
        agent.setX402Support(params.capabilities.x402Support)
      }
      
      // Register on-chain with IPFS
      const registrationFile: RegistrationFile = await agent.registerIPFS()
      
      // Debug: Log the full registration file to see what the SDK returned
      logger.info('Registration file returned from SDK:', {
        agentId: registrationFile.agentId,
        agentURI: registrationFile.agentURI,
        active: registrationFile.active,
        x402support: registrationFile.x402support
      }, 'Agent0Client [registerAgent]')
      
      // Extract token ID from agentId (format: chainId:tokenId)
      const agentId = registrationFile.agentId
      if (!agentId) {
        throw new Error('Registration succeeded but agentId not returned')
      }
      
      const tokenId = parseInt(agentId.split(':')[1] || '0', 10)
      if (isNaN(tokenId)) {
        throw new Error(`Invalid agentId format: ${agentId}`)
      }
      
      logger.info(`Agent registered successfully: ${agentId}`, undefined, 'Agent0Client [registerAgent]')
      
      return {
        tokenId,
        txHash: '', // SDK doesn't return txHash directly, would need to extract from registration
        metadataCID: registrationFile.agentURI?.replace('ipfs://', '') || undefined
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error('Failed to register agent', {
        error: errorMessage,
        stack: errorStack,
        agentName: params.name
      }, 'Agent0Client [registerAgent]')
      throw new Error(`Agent registration failed: ${errorMessage}`)
    }
  }
  
  /**
   * Search for agents using Agent0 SDK
   */
  async searchAgents(filters: Agent0SearchFilters): Promise<Agent0SearchResult[]> {
    await this.ensureSDK()
    
    if (!this.sdk) {
      throw new Error('SDK not initialized')
    }
    
    logger.info('Searching agents with filters:', filters, 'Agent0Client [searchAgents]')
    
    try {
      const searchParams: SearchParams = {}
      
      // Map strategies to MCP tools or A2A skills
      if (filters.strategies && filters.strategies.length > 0) {
        // Strategies could be MCP tools or stored in metadata
        searchParams.a2aSkills = filters.strategies
      }
      
      if (filters.name) {
        searchParams.name = filters.name
      }
      
      if (filters.x402Support !== undefined) {
        searchParams.x402support = filters.x402Support
      }
      
      const { items } = await this.sdk.searchAgents(searchParams)
      
      // Map SDK results to our format
      return items.map((agent: AgentSummary) => ({
        tokenId: parseInt(agent.agentId.split(':')[1] || '0', 10),
        name: agent.name,
        walletAddress: agent.walletAddress || '',
        metadataCID: agent.agentId,
        capabilities: {
          strategies: (agent.extras?.capabilities as { strategies?: string[] })?.strategies || [],
          markets: (agent.extras?.capabilities as { markets?: string[] })?.markets || [],
          actions: (agent.extras?.capabilities as { actions?: string[] })?.actions || [],
          version: (agent.extras?.capabilities as { version?: string })?.version || '1.0.0'
        },
        reputation: {
          trustScore: 0, // Would need to query reputation separately
          accuracyScore: 0
        }
      }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error('Failed to search agents', {
        error: errorMessage,
        stack: errorStack,
        filters
      }, 'Agent0Client [searchAgents]')
      return []
    }
  }
  
  /**
   * Submit feedback for an agent
   */
  async submitFeedback(params: Agent0FeedbackParams): Promise<void> {
    await this.ensureSDK()
    
    if (!this.sdk) {
      throw new Error('SDK not initialized')
    }
    
    if (this.sdk.isReadOnly) {
      throw new Error('Agent0Client not properly initialized with signer')
    }
    
    logger.info(`Submitting feedback for agent ${params.targetAgentId}`, undefined, 'Agent0Client [submitFeedback]')
    
    try {
      // Convert token ID to agentId format (chainId:tokenId)
      const agentId = `${this.chainId}:${params.targetAgentId}` as `${number}:${number}`
      
      // Convert rating from -5 to +5 scale to 0-100 scale used by Agent0 SDK
      // Agent0 SDK uses 0-100, so we map: -5=-100, 0=50, +5=100
      const agent0Score = Math.max(0, Math.min(100, (params.rating + 5) * 10))
      
      // Prepare feedback using SDK's prepareFeedback method
      // Signature: prepareFeedback(agentId, score, tags?, text?, capability?, name?, skill?)
      const feedbackFile = this.sdk.prepareFeedback(
        agentId,
        agent0Score, // Score: 0-100 (mandatory)
        [], // Tags (optional)
        params.comment || undefined, // Text (optional)
        undefined, // Capability (optional)
        undefined, // Name (optional)
        undefined  // Skill (optional)
      )
      
      // Submit feedback using SDK's giveFeedback method
      await this.sdk.giveFeedback(agentId, feedbackFile)
      
      logger.info(`Feedback submitted successfully for agent ${agentId}`, undefined, 'Agent0Client [submitFeedback]')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error('Failed to submit feedback', {
        error: errorMessage,
        stack: errorStack,
        targetAgentId: params.targetAgentId,
        rating: params.rating
      }, 'Agent0Client [submitFeedback]')
      throw new Error(`Feedback submission failed: ${errorMessage}`)
    }
  }
  
  /**
   * Get agent profile from Agent0 network
   */
  async getAgentProfile(tokenId: number): Promise<Agent0AgentProfile | null> {
    await this.ensureSDK()
    
    if (!this.sdk) {
      throw new Error('SDK not initialized')
    }
    
    logger.info(`Getting agent profile for token ${tokenId}`, undefined, 'Agent0Client [getAgentProfile]')
    
    try {
      // Convert token ID to agentId format (chainId:tokenId)
      const agentId = `${this.chainId}:${tokenId}` as `${number}:${number}`
      
      const agent: AgentSummary | null = await this.sdk.getAgent(agentId)
      
      if (!agent) {
        return null
      }
      
      return {
        tokenId,
        name: agent.name,
        walletAddress: agent.walletAddress || '',
        metadataCID: agent.agentId,
        capabilities: {
          strategies: (agent.extras?.capabilities as { strategies?: string[] })?.strategies || [],
          markets: (agent.extras?.capabilities as { markets?: string[] })?.markets || [],
          actions: (agent.extras?.capabilities as { actions?: string[] })?.actions || [],
          version: (agent.extras?.capabilities as { version?: string })?.version || '1.0.0'
        },
        reputation: {
          trustScore: 0, // Would need to query reputation separately
          accuracyScore: 0
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error(`Failed to get agent profile for token ${tokenId}`, {
        error: errorMessage,
        stack: errorStack,
        tokenId
      }, 'Agent0Client [getAgentProfile]')
      return null
    }
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
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_RPC_URL
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.AGENT0_PRIVATE_KEY
    
    if (!rpcUrl || !privateKey) {
      throw new Error(
        'Agent0Client requires BASE_SEPOLIA_RPC_URL and BABYLON_GAME_PRIVATE_KEY environment variables'
      )
    }
    
    agent0ClientInstance = new Agent0Client({
      network: (process.env.AGENT0_NETWORK as 'sepolia' | 'mainnet') || 'sepolia',
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

