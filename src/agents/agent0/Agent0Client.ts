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
   * Initialize SDK - fails fast on any error
   */
  private async ensureSDK(): Promise<void> {
    if (this.sdk) return
    
    if (this.initPromise) {
      await this.initPromise
      return
    }
    
    this.initPromise = (async () => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseCapabilities(extras: Record<string, any> | undefined): {
    strategies: string[];
    markets: string[];
    actions: string[];
    version: string;
  } {
    const defaultCapabilities = {
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
      strategies: validation.data.strategies ?? [],
      markets: validation.data.markets ?? [],
      actions: validation.data.actions ?? [],
      version: validation.data.version ?? '1.0.0',
    };
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
 * 
 * IMPORTANT: Agent0 operations happen on Ethereum Sepolia (not Base Sepolia)
 * - Game registration: Ethereum Sepolia (agent0 network)
 * - Game operations: Base Sepolia (game network)
 */
let agent0ClientInstance: Agent0Client | null = null

export function getAgent0Client(): Agent0Client {
  if (!agent0ClientInstance) {
    const rpcUrl = process.env.AGENT0_RPC_URL || process.env.SEPOLIA_RPC_URL
    
    const privateKey = process.env.BABYLON_GAME_PRIVATE_KEY || process.env.AGENT0_PRIVATE_KEY
    
    if (!privateKey) {
      throw new Error(
        'Agent0Client requires BABYLON_GAME_PRIVATE_KEY or AGENT0_PRIVATE_KEY environment variable'
      )
    }
    
    if (!rpcUrl) {
      throw new Error(
        'Agent0Client requires AGENT0_RPC_URL or SEPOLIA_RPC_URL environment variable. ' +
        'Agent0 operations happen on Ethereum Sepolia, not Base Sepolia.'
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
