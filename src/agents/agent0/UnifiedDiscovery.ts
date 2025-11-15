/**
 * Unified Discovery Service
 * 
 * Merges local agent registry with Agent0 network discovery
 * to provide comprehensive agent search.
 */

import type { AgentProfile } from '@/types/a2a'
import { AgentRegistry } from '../AgentRegistry'
import { ReputationBridge } from './ReputationBridge'
import { SubgraphClient, type SubgraphAgent } from './SubgraphClient'
import type { DiscoveryFilters, IReputationBridge, IUnifiedDiscoveryService } from './types'
import { z } from 'zod'

const CapabilitiesSchema = z.object({
  strategies: z.array(z.string()).optional(),
  markets: z.array(z.string()).optional(),
  actions: z.array(z.string()).optional(),
  version: z.string().optional(),
});

export class UnifiedDiscoveryService implements IUnifiedDiscoveryService {
  private localRegistry: AgentRegistry
  private subgraphClient: SubgraphClient
  private reputationBridge: IReputationBridge | null
  
  constructor(
    localRegistry: AgentRegistry,
    subgraphClient: SubgraphClient,
    reputationBridge?: IReputationBridge | null
  ) {
    this.localRegistry = localRegistry
    this.subgraphClient = subgraphClient
    this.reputationBridge = reputationBridge || null
  }
  
  /**
   * Discover agents from both local registry and Agent0 network
   */
  async discoverAgents(filters: DiscoveryFilters): Promise<AgentProfile[]> {
    const results: AgentProfile[] = []

    // Search local agents with enhanced filtering
    const localAgents = this.localRegistry.search({
      strategies: filters.strategies,
      minReputation: filters.minReputation
    })

    results.push(...localAgents.map((r: { profile: AgentProfile }) => r.profile))

    // Search external agents if enabled
    if (filters.includeExternal && process.env.AGENT0_ENABLED === 'true') {
      const externalAgents = await this.searchExternalAgents(filters)

      for (const agent0Data of externalAgents) {
        const profile = await this.transformAgent0Profile(agent0Data, this.reputationBridge)
        results.push(profile)
      }
    }

    // Apply semantic search if provided
    let filteredResults = results
    if (filters.semanticQuery) {
      filteredResults = await this.applySemanticSearch(results, filters.semanticQuery)
    }

    // Apply result limits and sorting
    const finalResults = this.applyFiltersAndSorting(filteredResults, filters)

    return finalResults
  }

  /**
   * Search external agents with enhanced parameters
   */
  private async searchExternalAgents(filters: DiscoveryFilters): Promise<SubgraphAgent[]> {
    // Enhanced search parameters for Agent0
    const searchParams: Record<string, unknown> = {
      strategies: filters.strategies,
      markets: filters.markets,
      minTrustScore: filters.minReputation,
      limit: filters.maxResults || 50
    }

    // Add semantic search if supported by Agent0 SDK
    if (filters.semanticQuery) {
      // Note: This would need Agent0 SDK support for semantic search
      // For now, we'll use text-based filtering
      searchParams.query = filters.semanticQuery
    }

    if (filters.capabilities && filters.capabilities.length > 0) {
      searchParams.capabilities = filters.capabilities
    }

    return await this.subgraphClient.searchAgents(searchParams)
  }

  /**
   * Apply semantic search filtering
   */
  private async applySemanticSearch(agents: AgentProfile[], query: string): Promise<AgentProfile[]> {
    // Simple semantic search implementation
    // In a full implementation, this would use vector embeddings
    const queryLower = query.toLowerCase()

    return agents.filter(agent => {
      const nameMatch = agent.name.toLowerCase().includes(queryLower)
      const descriptionMatch = agent.endpoint.toLowerCase().includes(queryLower)
      const capabilitiesMatch = agent.capabilities.strategies?.some(s => s.toLowerCase().includes(queryLower)) ||
                               agent.capabilities.actions?.some(a => a.toLowerCase().includes(queryLower))

      return nameMatch || descriptionMatch || capabilitiesMatch
    })
  }

  /**
   * Apply final filtering and sorting
   */
  private applyFiltersAndSorting(agents: AgentProfile[], filters: DiscoveryFilters): AgentProfile[] {
    let filteredAgents = [...agents]

    // Apply capability filtering
    if (filters.capabilities && filters.capabilities.length > 0) {
      filteredAgents = filteredAgents.filter(agent =>
        filters.capabilities!.some(cap =>
          agent.capabilities.strategies?.includes(cap) ||
          agent.capabilities.actions?.includes(cap)
        )
      )
    }

    // Apply result limits
    if (filters.maxResults && filters.maxResults > 0) {
      filteredAgents = filteredAgents.slice(0, filters.maxResults)
    }

    // Apply sorting
    switch (filters.sortBy) {
      case 'recent':
        // Sort by some recency metric (would need timestamp data)
        break
      case 'activity':
        // Sort by activity level (would need activity metrics)
        break
      case 'reputation':
      default:
        // Default is already sorted by reputation in deduplicateAndSort
        break
    }

    return this.deduplicateAndSort(filteredAgents)
  }
  
  /**
   * Transform Agent0 subgraph data to Babylon AgentProfile format
   */
  private async transformAgent0Profile(
    agent0Data: SubgraphAgent,
    reputationBridge?: IReputationBridge | null
  ): Promise<AgentProfile> {
    const parsed = JSON.parse(agent0Data.capabilities!)
    const validation = CapabilitiesSchema.parse(parsed)
    const capabilities = {
      strategies: validation.strategies ?? [],
      markets: validation.markets ?? [],
      actions: validation.actions ?? [],
      version: validation.version ?? '1.0.0',
    }
    
    let reputation
    if (reputationBridge) {
      const aggregated = await reputationBridge.getAggregatedReputation(agent0Data.tokenId)
      reputation = {
        totalBets: aggregated.totalBets,
        winningBets: aggregated.winningBets,
        accuracyScore: aggregated.accuracyScore,
        trustScore: aggregated.trustScore,
        totalVolume: aggregated.totalVolume,
        profitLoss: aggregated.profitLoss,
        isBanned: aggregated.isBanned
      }
    } else {
      reputation = {
        totalBets: agent0Data.reputation!.totalBets,
        winningBets: agent0Data.reputation!.winningBets,
        accuracyScore: agent0Data.reputation!.accuracyScore / 100,
        trustScore: agent0Data.reputation!.trustScore / 100,
        totalVolume: '0',
        profitLoss: 0,
        isBanned: false
      }
    }
    
    return {
      agentId: `agent0-${agent0Data.tokenId}`,
      tokenId: agent0Data.tokenId,
      address: agent0Data.walletAddress,
      name: agent0Data.name,
      endpoint: agent0Data.a2aEndpoint!,
      capabilities,
      reputation,
      isActive: true
    }
  }
  
  /**
   * Deduplicate agents by address and sort by reputation
   */
  private deduplicateAndSort(agents: AgentProfile[]): AgentProfile[] {
    // Deduplicate by address, prefer local agents (those without 'agent0-' prefix)
    const seen = new Map<string, AgentProfile>()
    
    for (const agent of agents) {
      const address = agent.address.toLowerCase()
      const existing = seen.get(address)
      
      if (!existing || (agent.agentId && !agent.agentId.startsWith('agent0-'))) {
        seen.set(address, agent)
      }
    }
    
    // Sort by trust score (descending)
    return Array.from(seen.values()).sort(
      (a, b) => b.reputation.trustScore - a.reputation.trustScore
    )
  }
  
  /**
   * Get agent by ID (searches both local and external)
   */
  async getAgent(agentId: string): Promise<AgentProfile> {
    if (agentId.startsWith('agent0-')) {
      const tokenId = parseInt(agentId.replace('agent0-', ''), 10)
      const agent0Data = await this.subgraphClient.getAgent(tokenId)
      return this.transformAgent0Profile(agent0Data, this.reputationBridge)
    }
    
    const localAgent = this.localRegistry.getAgent(agentId)
    return localAgent!.profile
  }
}

/**
 * Get or create singleton UnifiedDiscoveryService instance
 */
let unifiedDiscoveryInstance: UnifiedDiscoveryService | null = null

export function getUnifiedDiscoveryService(): UnifiedDiscoveryService {
  if (!unifiedDiscoveryInstance) {
    const localRegistry = new AgentRegistry()
    const subgraphClient = new SubgraphClient()
    
    let reputationBridge: ReputationBridge | null = null
    if (process.env.AGENT0_ENABLED === 'true') {
      reputationBridge = new ReputationBridge(undefined)
    }
    
    unifiedDiscoveryInstance = new UnifiedDiscoveryService(
      localRegistry,
      subgraphClient,
      reputationBridge
    )
  }
  
  return unifiedDiscoveryInstance
}

