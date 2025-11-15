/**
 * Agent Registry
 * 
 * Local registry of agents with search capabilities.
 * Provides interface for AgentDiscoveryService.
 */

import type { AgentProfile } from '@/types/a2a'
import { prisma } from '@/lib/prisma'

interface SearchParams {
  strategies?: string[]
  minReputation?: number
}

interface AgentResult {
  profile: AgentProfile
}

export class AgentRegistry {
  /**
   * Search for agents based on filters
   */
  search(_params: SearchParams): AgentResult[] {
    // For now return empty array - this will be populated with actual DB queries later
    // This is a stub to satisfy the AgentDiscovery interface
    return []
  }

  /**
   * Get a single agent by ID
   */
  getAgent(_agentId: string): AgentResult | null {
    // For now return null - this will be populated with actual DB queries later
    // This is a stub to satisfy the AgentDiscovery interface
    return null
  }

  /**
   * Get all registered agents
   */
  async getAllAgents(): Promise<AgentResult[]> {
    const agents = await prisma.user.findMany({
      where: {
        isAgent: true,
        managedBy: { not: null }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        walletAddress: true,
        reputationPoints: true
      }
    })

    return agents.map(agent => ({
      profile: {
        agentId: agent.id,
        tokenId: 0,
        address: agent.walletAddress!,
        name: agent.displayName!,
        endpoint: '',
        capabilities: {
          strategies: [],
          markets: [],
          actions: [],
          version: '1.0.0'
        },
        reputation: {
          totalBets: 0,
          winningBets: 0,
          accuracyScore: 0,
          trustScore: agent.reputationPoints / 1000,
          totalVolume: '0',
          profitLoss: 0,
          isBanned: false
        },
        isActive: true
      }
    }))
  }
}
