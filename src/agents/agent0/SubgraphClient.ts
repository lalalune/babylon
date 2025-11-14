/**
 * Agent0 Subgraph Client
 * 
 * Queries the Agent0 subgraph for fast agent discovery and search.
 */

// Temporarily disabled - install graphql-request to re-enable
// import { GraphQLClient } from 'graphql-request'
class GraphQLClient {
  constructor(_url: string) {}
  request(_query: string, _variables?: unknown): Promise<unknown> {
    return Promise.resolve({});
  }
}
import { logger } from '@/lib/logger'

export interface SubgraphAgent {
  id: string
  tokenId: number
  name: string
  type?: string
  metadataCID: string
  walletAddress: string
  mcpEndpoint?: string
  a2aEndpoint?: string
  capabilities?: string  // JSON string
  reputation?: {
    totalBets: number
    winningBets: number
    trustScore: number
    accuracyScore: number
  }
  feedbacks?: Array<{
    from: string
    rating: number
    comment: string
    timestamp: number
  }>
}

export class SubgraphClient {
  private client: GraphQLClient
  
  constructor() {
    const subgraphUrl = process.env.AGENT0_SUBGRAPH_URL
    
    if (!subgraphUrl) {
      logger.warn('AGENT0_SUBGRAPH_URL not configured, subgraph queries will fail', undefined, 'SubgraphClient')
    }
    
    this.client = new GraphQLClient(
      subgraphUrl || 'https://api.studio.thegraph.com/query/.../agent0'
    )
  }
  
  /**
   * Get agent by token ID
   */
  async getAgent(tokenId: number): Promise<SubgraphAgent | null> {
    const query = `
      query GetAgent($tokenId: Int!) {
        agent(id: $tokenId) {
          id
          tokenId
          name
          type
          metadataCID
          walletAddress
          mcpEndpoint
          a2aEndpoint
          capabilities
          reputation {
            totalBets
            winningBets
            trustScore
            accuracyScore
          }
          feedbacks {
            from
            rating
            comment
            timestamp
          }
        }
      }
    `
    
    const data = await this.client.request(query, { tokenId }) as { agent: SubgraphAgent | null }
    return data.agent
  }
  
  /**
   * Search agents by filters
   */
  async searchAgents(filters: {
    type?: string
    strategies?: string[]
    markets?: string[]
    minTrustScore?: number
    limit?: number
  }): Promise<SubgraphAgent[]> {
    const whereConditions: string[] = []
    
    if (filters.type) {
      whereConditions.push(`type: "${filters.type}"`)
    }
    
    if (filters.minTrustScore !== undefined) {
      whereConditions.push(`reputation_trustScore_gte: ${filters.minTrustScore}`)
    }
    
    const whereClause = whereConditions.length > 0 
      ? `where: { ${whereConditions.join(', ')} }`
      : ''
    
    const limit = filters.limit || 100
    
    const query = `
      query SearchAgents {
        agents(
          ${whereClause}
          orderBy: reputation_trustScore
          orderDirection: desc
          first: ${limit}
        ) {
          id
          tokenId
          name
          type
          metadataCID
          walletAddress
          mcpEndpoint
          a2aEndpoint
          capabilities
          reputation {
            totalBets
            winningBets
            trustScore
            accuracyScore
          }
        }
      }
    `
    
    const data = await this.client.request(query) as { agents: SubgraphAgent[] }
    let results = data.agents
    
    if (filters.strategies && filters.strategies.length > 0) {
      results = results.filter(agent => {
        const caps = agent.capabilities ? JSON.parse(agent.capabilities) : {}
        const agentStrategies = caps.strategies || []
        return filters.strategies!.some(s => agentStrategies.includes(s))
      })
    }
    
    if (filters.markets && filters.markets.length > 0) {
      results = results.filter(agent => {
        const caps = agent.capabilities ? JSON.parse(agent.capabilities) : {}
        const agentMarkets = caps.markets || []
        return filters.markets!.some(m => agentMarkets.includes(m))
      })
    }
    
    return results
  }
  
  /**
   * Get all game platforms
   */
  async getGamePlatforms(filters?: {
    markets?: string[]
    minTrustScore?: number
  }): Promise<SubgraphAgent[]> {
    return this.searchAgents({
      type: 'game-platform',
      markets: filters?.markets,
      minTrustScore: filters?.minTrustScore,
      limit: 50
    })
  }
  
  /**
   * Get agent feedback
   */
  async getAgentFeedback(tokenId: number): Promise<Array<{
    from: string
    rating: number
    comment: string
    timestamp: number
  }>> {
    const agent = await this.getAgent(tokenId)
    return agent?.feedbacks || []
  }
}

