/**
 * Reputation Bridge
 * 
 * Aggregates reputation from ERC-8004 on-chain data and Agent0 network feedback
 * to provide unified reputation scores.
 */

import type { RegistryClient } from '@/lib/a2a/blockchain/registry-client'
import { SubgraphClient } from './SubgraphClient'
import type { AgentReputation } from '@/types/a2a'
import { logger } from '@/lib/logger'
import type { IReputationBridge, AggregatedReputation } from './types'

export class ReputationBridge implements IReputationBridge {
  private erc8004Registry?: RegistryClient
  private subgraphClient: SubgraphClient
  
  constructor(erc8004Registry?: RegistryClient) {
    this.erc8004Registry = erc8004Registry
    this.subgraphClient = new SubgraphClient()
  }
  
  /**
   * Get aggregated reputation from both ERC-8004 and Agent0
   */
  async getAggregatedReputation(tokenId: number): Promise<AggregatedReputation> {
    const [local, agent0] = await Promise.all([
      this.getLocalReputation(tokenId),
      this.getAgent0Reputation(tokenId)
    ])
    
    return {
      totalBets: local.totalBets + agent0.totalBets,
      winningBets: local.winningBets + agent0.winningBets,
      accuracyScore: this.calculateWeightedAccuracy(local, agent0),
      trustScore: this.calculateTrustScore(local, agent0),
      totalVolume: this.sumVolumes(local.totalVolume, agent0.totalVolume),
      profitLoss: local.profitLoss + agent0.profitLoss,
      isBanned: local.isBanned || agent0.isBanned,
      sources: {
        local: local.trustScore,
        agent0: agent0.trustScore
      }
    }
  }
  
  /**
   * Get reputation from ERC-8004 (local/on-chain)
   */
  private async getLocalReputation(tokenId: number): Promise<AgentReputation> {
    if (!this.erc8004Registry) {
      return this.getDefaultReputation()
    }
    
    return await this.erc8004Registry.getAgentReputation(tokenId)
  }
  
  /**
   * Get reputation from Agent0 network
   */
  private async getAgent0Reputation(tokenId: number): Promise<AgentReputation> {
    const agent = await this.subgraphClient.getAgent(tokenId)
    
    if (!agent || !agent.reputation) {
      return this.getDefaultReputation()
    }
    
    const rep = agent.reputation
    
    return {
      totalBets: rep.totalBets || 0,
      winningBets: rep.winningBets || 0,
      accuracyScore: (rep.accuracyScore || 0) / 100,
      trustScore: (rep.trustScore || 0) / 100,
      totalVolume: '0',
      profitLoss: 0,
      isBanned: false
    }
  }
  
  /**
   * Calculate weighted accuracy score
   * Prefers local data (60%) but incorporates Agent0 data (40%)
   */
  private calculateWeightedAccuracy(
    local: AgentReputation,
    agent0: AgentReputation
  ): number {
    const localWeight = 0.6
    const agent0Weight = 0.4
    
    // If one source has no data, use the other
    if (local.totalBets === 0 && agent0.totalBets === 0) {
      return 0
    }
    
    if (local.totalBets === 0) {
      return agent0.accuracyScore
    }
    
    if (agent0.totalBets === 0) {
      return local.accuracyScore
    }
    
    // Weighted average
    return (local.accuracyScore * localWeight) + (agent0.accuracyScore * agent0Weight)
  }
  
  /**
   * Calculate trust score
   * Takes the maximum of both sources (more conservative)
   */
  private calculateTrustScore(
    local: AgentReputation,
    agent0: AgentReputation
  ): number {
    // If one source has no data, use the other
    if (local.totalBets === 0 && agent0.totalBets === 0) {
      return 0
    }
    
    if (local.totalBets === 0) {
      return agent0.trustScore
    }
    
    if (agent0.totalBets === 0) {
      return local.trustScore
    }
    
    // Take maximum (more conservative - require trust from both sources)
    return Math.max(local.trustScore, agent0.trustScore)
  }
  
  /**
   * Sum two volume strings (wei amounts)
   */
  private sumVolumes(volume1: string, volume2: string): string {
    const v1 = BigInt(volume1 || '0')
    const v2 = BigInt(volume2 || '0')
    return (v1 + v2).toString()
  }
  
  /**
   * Get default reputation
   */
  private getDefaultReputation(): AgentReputation {
    return {
      totalBets: 0,
      winningBets: 0,
      accuracyScore: 0,
      trustScore: 0,
      totalVolume: '0',
      profitLoss: 0,
      isBanned: false
    }
  }
  
  /**
   * Sync local reputation to Agent0 network
   * This can be called periodically to keep both systems in sync
   */
  async syncReputationToAgent0(tokenId: number, agent0Client: { submitFeedback: (params: { targetAgentId: number; rating: number; comment: string }) => Promise<void> }): Promise<void> {
    logger.info(`Syncing reputation for token ${tokenId} to Agent0 network`, undefined, 'ReputationBridge')
    
    const localRep = await this.getLocalReputation(tokenId)
    
    if (localRep.totalBets === 0) {
      logger.debug(`No local activity for token ${tokenId}, skipping sync`, undefined, 'ReputationBridge')
      return
    }
    
    const rating = Math.round((localRep.accuracyScore - 0.5) * 10)
    const clampedRating = Math.max(-5, Math.min(5, rating))
    
    const comment = `Local reputation sync: ${localRep.totalBets} bets, ${localRep.winningBets} wins, ${(localRep.accuracyScore * 100).toFixed(1)}% accuracy`
    
    await agent0Client.submitFeedback({
      targetAgentId: tokenId,
      rating: clampedRating,
      comment
    })
    
    logger.info(`✅ Synced reputation for token ${tokenId} to Agent0 network`, undefined, 'ReputationBridge')
  }
}

