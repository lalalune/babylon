/**
 * Agent Registry
 *
 * Central registry for managing autonomous agent discovery and registration.
 * Provides matchmaking, reputation tracking, and agent search capabilities.
 */

import { EventEmitter } from 'events';
import type { AutonomousAgent } from './AutonomousAgent';
import type { AgentProfile, AgentCapabilities, AgentReputation } from '../a2a/types';
import { logger } from '@/lib/logger';

export interface RegisteredAgent {
  agent: AutonomousAgent;
  profile: AgentProfile;
  registeredAt: number;
  lastActive: number;
  performance: {
    totalPredictions: number;
    correctPredictions: number;
    averageConfidence: number;
    coalitionsJoined: number;
  };
}

export interface AgentSearchCriteria {
  strategies?: string[];
  minReputation?: number;
  minPerformance?: number;
  excludeAgents?: string[];
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<string, RegisteredAgent> = new Map();
  private strategyIndex: Map<string, Set<string>> = new Map();

  /**
   * Register an agent with the registry
   */
  register(agent: AutonomousAgent): void {
    const status = agent.getStatus();

    if (!status.agentId) {
      throw new Error('Agent must be connected before registration');
    }

    // Create reputation object
    const reputation: AgentReputation = {
      totalBets: 0,
      winningBets: 0,
      accuracyScore: 0,
      trustScore: 0.5, // Start with neutral trust
      totalVolume: '0',
      profitLoss: 0,
      isBanned: false,
    };

    // Create capabilities following A2A protocol
    const capabilities: AgentCapabilities = {
      strategies: [], // Will be populated from agent config
      markets: ['prediction'],
      actions: ['analyze', 'predict', 'coordinate'],
      version: '1.0.0'
    };

    // Create profile following A2A protocol
    const profile: AgentProfile = {
      agentId: status.agentId,
      tokenId: 0, // Can be set if agent has NFT
      address: status.address,
      name: status.name,
      endpoint: '', // Will be set if agent exposes API
      capabilities,
      reputation,
      isActive: true
    };

    // Create registration
    const registration: RegisteredAgent = {
      agent,
      profile,
      registeredAt: Date.now(),
      lastActive: Date.now(),
      performance: {
        totalPredictions: 0,
        correctPredictions: 0,
        averageConfidence: 0,
        coalitionsJoined: 0
      }
    };

    this.agents.set(status.agentId, registration);

    // Index by strategies
    for (const strategy of profile.capabilities.strategies) {
      if (!this.strategyIndex.has(strategy)) {
        this.strategyIndex.set(strategy, new Set());
      }
      this.strategyIndex.get(strategy)!.add(status.agentId);
    }

    // Setup agent event listeners
    this.setupAgentListeners(agent, status.agentId);

    this.emit('agentRegistered', { agentId: status.agentId, profile });
    logger.info(`Registered agent: ${status.name} (${status.agentId})`, undefined, 'AgentRegistry');
  }

  /**
   * Setup event listeners for agent activity tracking
   */
  private setupAgentListeners(agent: AutonomousAgent, agentId: string): void {
    agent.on('analysisComplete', (analysis) => {
      const registration = this.agents.get(agentId);
      if (registration) {
        registration.lastActive = Date.now();
        registration.performance.totalPredictions++;
        // Update average confidence from analysis
        if (analysis && typeof analysis === 'object' && 'confidence' in analysis) {
          const confidence = Number(analysis.confidence);
          const currentAvg = registration.performance.averageConfidence;
          const totalPreds = registration.performance.totalPredictions;
          registration.performance.averageConfidence =
            (currentAvg * (totalPreds - 1) + confidence) / totalPreds;
        }
        this.agents.set(agentId, registration);
      }
    });

    agent.on('coalitionJoined', () => {
      const registration = this.agents.get(agentId);
      if (registration) {
        registration.performance.coalitionsJoined++;
        this.agents.set(agentId, registration);
      }
    });

    agent.on('disconnected', () => {
      this.unregister(agentId);
    });
  }

  /**
   * Unregister an agent
   */
  unregister(agentId: string): void {
    const registration = this.agents.get(agentId);
    if (!registration) return;

    // Remove from strategy index
    for (const strategy of registration.profile.capabilities.strategies) {
      const agents = this.strategyIndex.get(strategy);
      if (agents) {
        agents.delete(agentId);
        if (agents.size === 0) {
          this.strategyIndex.delete(strategy);
        }
      }
    }

    this.agents.delete(agentId);
    this.emit('agentUnregistered', { agentId });
    logger.info(`Unregistered agent: ${agentId}`, undefined, 'AgentRegistry');
  }

  /**
   * Search for agents matching criteria
   */
  search(criteria: AgentSearchCriteria): RegisteredAgent[] {
    const results: RegisteredAgent[] = [];

    for (const [agentId, registration] of this.agents.entries()) {
      // Skip excluded agents
      if (criteria.excludeAgents?.includes(agentId)) {
        continue;
      }

      // Check strategy match
      if (criteria.strategies && criteria.strategies.length > 0) {
        const hasMatchingStrategy = criteria.strategies.some(strategy =>
          registration.profile.capabilities.strategies.includes(strategy)
        );
        if (!hasMatchingStrategy) continue;
      }

      // Check reputation (use accuracy score as primary metric)
      if (criteria.minReputation !== undefined) {
        if (registration.profile.reputation.accuracyScore < criteria.minReputation) {
          continue;
        }
      }

      // Check performance
      if (criteria.minPerformance !== undefined) {
        const performance = registration.performance.totalPredictions > 0
          ? registration.performance.correctPredictions / registration.performance.totalPredictions
          : 0;
        if (performance < criteria.minPerformance) {
          continue;
        }
      }

      results.push(registration);
    }

    // Sort by reputation (accuracy score) and recent activity
    results.sort((a, b) => {
      const reputationDiff = b.profile.reputation.accuracyScore - a.profile.reputation.accuracyScore;
      if (reputationDiff !== 0) return reputationDiff;
      return b.lastActive - a.lastActive;
    });

    return results;
  }

  /**
   * Find agents with specific strategies
   */
  findByStrategy(strategy: string): RegisteredAgent[] {
    const agentIds = this.strategyIndex.get(strategy);
    if (!agentIds) return [];

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((agent): agent is RegisteredAgent => agent !== undefined);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agent count by strategy
   */
  getStrategyDistribution(): Map<string, number> {
    const distribution = new Map<string, number>();
    for (const [strategy, agents] of this.strategyIndex.entries()) {
      distribution.set(strategy, agents.size);
    }
    return distribution;
  }

  /**
   * Update agent performance (called when predictions are resolved)
   */
  updatePerformance(
    agentId: string,
    updates: {
      correctPrediction?: boolean;
      reputationChange?: number;
    }
  ): void {
    const registration = this.agents.get(agentId);
    if (!registration) return;

    if (updates.correctPrediction !== undefined) {
      if (updates.correctPrediction) {
        registration.performance.correctPredictions++;
      }
    }

    if (updates.reputationChange !== undefined) {
      registration.profile.reputation.accuracyScore += updates.reputationChange;
      registration.profile.reputation.accuracyScore = Math.max(0, Math.min(1, registration.profile.reputation.accuracyScore));
    }

    // Update success rate in reputation
    if (registration.performance.totalPredictions > 0) {
      registration.profile.reputation.accuracyScore =
        registration.performance.correctPredictions / registration.performance.totalPredictions;
      registration.profile.reputation.totalBets = registration.performance.totalPredictions;
      registration.profile.reputation.winningBets = registration.performance.correctPredictions;
    }

    this.agents.set(agentId, registration);
    this.emit('performanceUpdated', { agentId, registration });
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAgents: number;
    activeAgents: number;
    strategies: Map<string, number>;
    averageReputation: number;
    totalPredictions: number;
  } {
    const agents = Array.from(this.agents.values());
    const now = Date.now();
    const activeThreshold = 5 * 60 * 1000; // 5 minutes

    const activeAgents = agents.filter(
      a => now - a.lastActive < activeThreshold
    ).length;

    const totalReputation = agents.reduce(
      (sum, a) => sum + a.profile.reputation.accuracyScore,
      0
    );

    const totalPredictions = agents.reduce(
      (sum, a) => sum + a.performance.totalPredictions,
      0
    );

    return {
      totalAgents: agents.length,
      activeAgents,
      strategies: this.getStrategyDistribution(),
      averageReputation: agents.length > 0 ? totalReputation / agents.length : 0,
      totalPredictions
    };
  }

  /**
   * Find potential coalition partners for an agent
   */
  findCoalitionPartners(
    agentId: string,
    targetStrategy: string,
    maxPartners: number = 5
  ): RegisteredAgent[] {
    const sourceAgent = this.agents.get(agentId);
    if (!sourceAgent) return [];

    // Find agents with matching strategy
    const candidates = this.findByStrategy(targetStrategy);

    // Filter out source agent and rank by reputation (accuracy score)
    return candidates
      .filter(candidate => {
        const agentStatus = candidate.agent.getStatus();
        return agentStatus.agentId !== agentId;
      })
      .sort((a, b) => b.profile.reputation.accuracyScore - a.profile.reputation.accuracyScore)
      .slice(0, maxPartners);
  }

  /**
   * Clear all registrations (for cleanup)
   */
  clear(): void {
    this.agents.clear();
    this.strategyIndex.clear();
    this.emit('cleared');
  }
}
