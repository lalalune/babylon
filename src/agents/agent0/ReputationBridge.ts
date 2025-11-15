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
   * Calculate advanced accuracy score using Bayesian estimation
   * Uses beta distribution to handle small sample sizes better
   */
  private calculateWeightedAccuracy(
    local: AgentReputation,
    agent0: AgentReputation
  ): number {
    // Use Bayesian estimation for accuracy
    const alphaPrior = 1 // Prior successes
    const betaPrior = 1  // Prior failures

    // Local accuracy with Bayesian smoothing
    const localAccuracy = local.totalBets > 0
      ? (local.winningBets + alphaPrior) / (local.totalBets + alphaPrior + betaPrior)
      : 0

    // Agent0 accuracy with Bayesian smoothing
    const agent0Accuracy = agent0.totalBets > 0
      ? (agent0.winningBets + alphaPrior) / (agent0.totalBets + alphaPrior + betaPrior)
      : 0

    // Weight by sample size and recency
    const localWeight = this.calculateSourceWeight(local)
    const agent0Weight = this.calculateSourceWeight(agent0)

    if (local.totalBets === 0 && agent0.totalBets === 0) {
      return 0
    }

    if (local.totalBets === 0) {
      return agent0Accuracy * 100
    }

    if (agent0.totalBets === 0) {
      return localAccuracy * 100
    }

    // Weighted average with Bayesian smoothing
    const combinedAccuracy = (localAccuracy * localWeight + agent0Accuracy * agent0Weight) / (localWeight + agent0Weight)
    return combinedAccuracy * 100
  }

  /**
   * Calculate advanced trust score using multi-factor analysis
   */
  private calculateTrustScore(
    local: AgentReputation,
    agent0: AgentReputation
  ): number {
    let trustScore = 0
    let totalWeight = 0

    // Factor 1: Accuracy-based trust (40% weight)
    const accuracyTrust = Math.min(100, Math.max(0,
      (local.accuracyScore * 0.6 + agent0.accuracyScore * 0.4) / 2
    ))
    trustScore += accuracyTrust * 0.4
    totalWeight += 0.4

    // Factor 2: Volume-based trust (30% weight)
    const totalVolume = this.sumVolumesAsNumber(local.totalVolume, agent0.totalVolume)
    const volumeTrust = Math.min(100, totalVolume / 1000000 * 100) // Scale by 1M wei
    trustScore += volumeTrust * 0.3
    totalWeight += 0.3

    // Factor 3: Consistency-based trust (20% weight)
    const consistencyTrust = this.calculateConsistencyTrust(local, agent0)
    trustScore += consistencyTrust * 0.2
    totalWeight += 0.2

    // Factor 4: Time-based decay (10% weight)
    const timeTrust = this.calculateTimeBasedTrust(local, agent0)
    trustScore += timeTrust * 0.1
    totalWeight += 0.1

    return trustScore / totalWeight
  }

  /**
   * Calculate source weight based on sample size and recency
   */
  private calculateSourceWeight(reputation: AgentReputation): number {
    const baseWeight = Math.min(reputation.totalBets / 100, 1) // Max weight at 100 bets

    // Recency bonus (newer data gets higher weight)
    const now = Date.now()
    const timeSinceUpdate = now - (reputation.lastUpdated || now)
    const recencyBonus = Math.max(0, 1 - (timeSinceUpdate / (30 * 24 * 60 * 60 * 1000))) // 30 days

    return baseWeight * (0.7 + 0.3 * recencyBonus)
  }

  /**
   * Calculate consistency trust based on variance in performance
   */
  private calculateConsistencyTrust(local: AgentReputation, agent0: AgentReputation): number {
    // Higher consistency = higher trust
    // For now, use a simple heuristic based on accuracy stability
    if (local.totalBets < 10 && agent0.totalBets < 10) {
      return 50 // Neutral for small samples
    }

    const avgAccuracy = (local.accuracyScore + agent0.accuracyScore) / 2
    const accuracyVariance = Math.abs(local.accuracyScore - agent0.accuracyScore)

    // Lower variance = higher consistency score
    const consistencyScore = Math.max(0, 100 - (accuracyVariance / avgAccuracy) * 50)
    return consistencyScore
  }

  /**
   * Calculate time-based trust considering data freshness
   */
  private calculateTimeBasedTrust(local: AgentReputation, agent0: AgentReputation): number {
    const now = Date.now()
    const localFreshness = Math.max(0, 1 - ((now - (local.lastUpdated || now)) / (90 * 24 * 60 * 60 * 1000))) // 90 days
    const agent0Freshness = Math.max(0, 1 - ((now - (agent0.lastUpdated || now)) / (90 * 24 * 60 * 60 * 1000)))

    return (localFreshness * 60 + agent0Freshness * 40) // Weighted average
  }

  /**
   * Sum volumes as numbers for calculations
   */
  private sumVolumesAsNumber(volume1: string, volume2: string): number {
    const v1 = parseFloat(volume1) || 0
    const v2 = parseFloat(volume2) || 0
    return v1 + v2
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

