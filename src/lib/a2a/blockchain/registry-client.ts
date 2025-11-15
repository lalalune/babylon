/**
 * ERC-8004 Registry Client
 * Blockchain integration for agent identity and reputation
 */

import { ethers } from 'ethers'
import type { AgentProfile, AgentReputation } from '@/types/a2a'
import { Logger } from '../utils/logger'
import type { IdentityRegistryContract, ReputationSystemContract } from '@/types/contracts'
import type { JsonValue } from '@/types/common'
import { z } from 'zod'

const CapabilitiesSchema = z.object({
  strategies: z.array(z.string()).optional(),
  markets: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  version: z.string().optional(),
});

// ERC-8004 Identity Registry ABI (minimal)
const IDENTITY_ABI = [
  'function getTokenId(address _address) external view returns (uint256)',
  'function ownerOf(uint256 tokenId) external view returns (address)',
  'function getAgentProfile(uint256 _tokenId) external view returns (string memory name, string memory endpoint, bytes32 capabilitiesHash, uint256 registeredAt, bool isActive, string memory metadata)',
  'function isRegistered(address _address) external view returns (bool)',
  'function getAllActiveAgents() external view returns (uint256[] memory)',
  'function isEndpointActive(string memory endpoint) external view returns (bool)',
  'function getAgentsByCapability(bytes32 capabilityHash) external view returns (uint256[] memory)',
]

// Reputation System ABI (minimal)
const REPUTATION_ABI = [
  'function getReputation(uint256 _tokenId) external view returns (uint256 totalBets, uint256 winningBets, uint256 totalVolume, uint256 profitLoss, uint256 accuracyScore, uint256 trustScore, bool isBanned)',
  'function getFeedbackCount(uint256 _tokenId) external view returns (uint256)',
  'function getFeedback(uint256 _tokenId, uint256 _index) external view returns (address from, int8 rating, string memory comment, uint256 timestamp)',
  'function getAgentsByMinScore(uint256 minScore) external view returns (uint256[] memory)',
]

export interface RegistryConfig {
  rpcUrl: string
  identityRegistryAddress: string
  reputationSystemAddress: string
}

// Contract method return type interfaces are now imported from @/types/contracts

export class RegistryClient {
  private readonly provider: ethers.Provider
  private readonly identityRegistry: IdentityRegistryContract
  private readonly reputationSystem: ReputationSystemContract
  private readonly logger: Logger

  constructor(config: RegistryConfig) {
    // Initialize all properties in constructor to satisfy strictPropertyInitialization
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)

    this.identityRegistry = new ethers.Contract(
      config.identityRegistryAddress,
      IDENTITY_ABI,
      this.provider
    ) as unknown as IdentityRegistryContract

    this.reputationSystem = new ethers.Contract(
      config.reputationSystemAddress,
      REPUTATION_ABI,
      this.provider
    ) as unknown as ReputationSystemContract
    
    this.logger = new Logger('info')
  }

  /**
   * Get agent profile by token ID
   */
  async getAgentProfile(tokenId: number): Promise<AgentProfile | null> {
    const profile = await this.identityRegistry.getAgentProfile(tokenId)
    const reputation = await this.getAgentReputation(tokenId)
    const address = await this.identityRegistry.ownerOf(tokenId)

    return {
      tokenId,
      address,
      name: profile.name,
      endpoint: profile.endpoint,
      capabilities: this.parseCapabilities(profile.metadata),
      reputation,
      isActive: profile.isActive
    }
  }

  /**
   * Get agent profile by address
   */
  async getAgentProfileByAddress(address: string): Promise<AgentProfile | null> {
    const tokenId = await this.identityRegistry.getTokenId(address)
    if (tokenId === 0n) return null
    return this.getAgentProfile(Number(tokenId))
  }

  /**
   * Get agent reputation
   */
  async getAgentReputation(tokenId: number): Promise<AgentReputation> {
    const rep = await this.reputationSystem.getReputation(tokenId)

    return {
      totalBets: Number(rep[0] || 0),
      winningBets: Number(rep[1] || 0),
      totalVolume: rep[2]?.toString() || '0',
      profitLoss: Number(rep[3] || 0),
      accuracyScore: Number(rep[4] || 0),
      trustScore: Number(rep[5] || 0),
      isBanned: rep[6] || false,
    }
  }

  /**
   * Discover agents by filters
   */
  async discoverAgents(filters?: {
    strategies?: string[]
    minReputation?: number
    markets?: string[]
  }): Promise<AgentProfile[]> {
    let tokenIds: bigint[]
    
    if (filters?.minReputation) {
      tokenIds = await this.reputationSystem.getAgentsByMinScore(filters.minReputation)
    } else {
      tokenIds = await this.identityRegistry.getAllActiveAgents()
    }

    const profiles: AgentProfile[] = []
    for (const tokenId of tokenIds) {
      const profile = await this.getAgentProfile(Number(tokenId))
      if (profile && this.matchesFilters(profile, filters)) {
        profiles.push(profile)
      }
    }

    return profiles
  }

  /**
   * Check if agent matches discovery filters
   */
  private matchesFilters(
    profile: AgentProfile,
    filters?: {
      strategies?: string[]
      minReputation?: number
      markets?: string[]
    }
  ): boolean {
    if (!filters) return true

    // Check strategies
    if (filters.strategies && filters.strategies.length > 0) {
      const hasStrategy = filters.strategies.some(s =>
        profile.capabilities.strategies.includes(s)
      )
      if (!hasStrategy) return false
    }

    // Check markets
    if (filters.markets && filters.markets.length > 0) {
      const hasMarket = filters.markets.some(m =>
        profile.capabilities.markets.includes(m)
      )
      if (!hasMarket) return false
    }

    // Check reputation (already filtered in query if provided)
    if (filters.minReputation) {
      if (profile.reputation.trustScore < filters.minReputation) {
        return false
      }
    }

    return true
  }

  /**
   * Parse capabilities from metadata JSON
   */
  private parseCapabilities(metadata: string): {
    strategies: string[]
    markets: string[]
    actions: string[]
    version: string
  } {
    const parsed = JSON.parse(metadata);
    const validation = CapabilitiesSchema.safeParse(parsed);
    return {
      strategies: validation.data?.strategies ?? [],
      markets: validation.data?.markets ?? [],
      actions: validation.data?.actions ?? [],
      version: validation.data?.version ?? '1.0.0',
    };
  }

  /**
   * Verify agent address owns the token ID
   */
  async verifyAgent(address: string, tokenId: number): Promise<boolean> {
    const owner = await this.identityRegistry.ownerOf(tokenId)
    return owner.toLowerCase() === address.toLowerCase()
  }

  /**
   * Check if endpoint is active
   */
  async isEndpointActive(endpoint: string): Promise<boolean> {
    return await this.identityRegistry.isEndpointActive(endpoint)
  }

  /**
   * Register agent (required by RegistryClient interface)
   * 
   * NOTE: This client is READ-ONLY. For actual registration, use:
   * - Agent0Client.registerAgent() - Full Agent0 registration with IPFS publishing
   * - /api/agents/onboard - On-chain registration endpoint with server wallet
   * - AgentWalletService.registerAgentOnChain() - Complete registration flow
   * 
   * This method exists for interface compatibility only.
   * Registration requires wallet signing and gas, which are handled by the above methods.
   */
  async register(agentId: string, data: Record<string, JsonValue>): Promise<void> {
    this.logger.info(`Register agent ${agentId} (read-only client)`, { data })
    throw new Error('RegistryClient is read-only. Use Agent0Client.registerAgent() or /api/agents/onboard for registration')
  }

  /**
   * Unregister agent (required by RegistryClient interface)
   * 
   * NOTE: This client is READ-ONLY. Unregistration requires direct blockchain interaction
   * with a wallet that owns the agent token. This is not currently implemented as a
   * server-side operation.
   */
  async unregister(agentId: string): Promise<void> {
    this.logger.info(`Unregister agent ${agentId} (read-only client)`)
    throw new Error('RegistryClient is read-only. Unregistration requires direct blockchain interaction with agent owner wallet')
  }

  /**
   * Get all agents (required by RegistryClient interface)
   */
  async getAgents(): Promise<Array<{ agentId: string; [key: string]: JsonValue }>> {
    const profiles = await this.discoverAgents()
    return profiles.map(profile => ({
      agentId: String(profile.tokenId),
      tokenId: profile.tokenId,
      address: profile.address,
      name: profile.name,
      endpoint: profile.endpoint,
      capabilities: {
        strategies: profile.capabilities.strategies,
        markets: profile.capabilities.markets,
        actions: profile.capabilities.actions,
        version: profile.capabilities.version,
      },
      reputation: {
        totalBets: profile.reputation.totalBets,
        winningBets: profile.reputation.winningBets,
        accuracyScore: profile.reputation.accuracyScore,
        trustScore: profile.reputation.trustScore,
        totalVolume: profile.reputation.totalVolume,
        profitLoss: profile.reputation.profitLoss,
        isBanned: profile.reputation.isBanned,
      },
      isActive: profile.isActive,
    }))
  }

  /**
   * Get agent by ID (required by RegistryClient interface)
   */
  async getAgent(agentId: string): Promise<{ agentId: string; [key: string]: JsonValue } | null> {
    const tokenId = parseInt(agentId, 10)
    if (isNaN(tokenId)) {
      return null
    }
    const profile = await this.getAgentProfile(tokenId)
    if (!profile) {
      return null
    }
    return {
      agentId: String(profile.tokenId),
      tokenId: profile.tokenId,
      address: profile.address,
      name: profile.name,
      endpoint: profile.endpoint,
      capabilities: {
        strategies: profile.capabilities.strategies,
        markets: profile.capabilities.markets,
        actions: profile.capabilities.actions,
        version: profile.capabilities.version,
      },
      reputation: {
        totalBets: profile.reputation.totalBets,
        winningBets: profile.reputation.winningBets,
        accuracyScore: profile.reputation.accuracyScore,
        trustScore: profile.reputation.trustScore,
        totalVolume: profile.reputation.totalVolume,
        profitLoss: profile.reputation.profitLoss,
        isBanned: profile.reputation.isBanned,
      },
      isActive: profile.isActive,
    }
  }
}
