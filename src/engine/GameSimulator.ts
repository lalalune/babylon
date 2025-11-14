/**
 * Babylon Game Simulator - Autonomous Game Engine
 * 
 * Runs complete prediction market games without human input.
 * Game progresses toward a predetermined outcome over 30 simulated days.
 * 
 * @module engine/GameSimulator
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import type { JsonValue } from '@/types/common';

/**
 * Game configuration for simulation
 */
export interface GameConfig {
  /** Predetermined outcome (true = YES, false = NO) */
  outcome: boolean;
  /** Number of AI agents (2-20) */
  numAgents?: number;
  /** Game duration in days */
  duration?: number;
  /** Liquidity parameter for LMSR */
  liquidityB?: number;
  /** Percentage of agents who are insiders (0-1) */
  insiderPercentage?: number;
}

/**
 * Complete game result with event log
 */
export interface GameResult {
  /** Unique game ID */
  id: string;
  /** Market question */
  question: string;
  /** Predetermined outcome */
  outcome: boolean;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Complete event log */
  events: GameEvent[];
  /** Final agent states */
  agents: AgentState[];
  /** Final market state */
  market: MarketState;
  /** Reputation changes */
  reputationChanges: ReputationChange[];
  /** Winner agent IDs */
  winners: string[];
}

/**
 * Game event types
 */
export type GameEventType =
  | 'game:started'
  | 'day:changed'
  | 'clue:distributed'
  | 'agent:bet'
  | 'agent:post'
  | 'agent:dm'
  | 'market:updated'
  | 'outcome:revealed'
  | 'game:ended';

/**
 * Event data types for different events
 */
export type GameEventData =
  | { id: string; question: string }  // game:started
  | { day: number }  // day:changed
  | { agentId: string; clue: string; pointsToward: boolean }  // clue:distributed
  | { agentId: string; bet: string; position: 'YES' | 'NO' }  // agent:bet
  | { agentId: string; post: string }  // agent:post
  | { from: string; to: string; message: string }  // agent:dm
  | MarketState  // market:updated
  | { outcome: boolean }  // outcome:revealed
  | { outcome: boolean; winners: string[] }  // game:ended
  | Record<string, JsonValue>;  // fallback for any other data

/**
 * Single game event
 */
export interface GameEvent {
  type: GameEventType;
  timestamp: number;
  day: number;
  data: GameEventData;
  agentId?: string;
}

export interface AgentState {
  id: string;
  name: string;
  yesShares: number;
  noShares: number;
  reputation: number;
  isInsider: boolean;
  cluesReceived: number;
}

/**
 * Internal agent representation with full state
 */
interface InternalAgent {
  id: string;
  name: string;
  isInsider: boolean;
  yesShares: number;
  noShares: number;
  reputation: number;
  cluesReceived: Array<{ clue: string; pointsToward: boolean }>;
  knowledge: string[];
}

/**
 * Clue in the network
 */
interface ClueData {
  id: string;
  tier: string;
  day: number;
  pointsToward: boolean;
  reliability: number;
}

/**
 * Distributed clue
 */
interface DistributedClue {
  agentId: string;
  clue: string;
  pointsToward: boolean;
}

/**
 * Agent bet
 */
interface AgentBet {
  agentId: string;
  bet: string;
  position: 'YES' | 'NO';
  outcome: boolean;
  shares: number;
  amount: number;
}

/**
 * Agent post
 */
interface AgentPost {
  agentId: string;
  post: string;
}

export interface MarketState {
  yesShares: number;
  noShares: number;
  yesOdds: number;
  noOdds: number;
  totalVolume: number;
}

export interface ReputationChange {
  agentId: string;
  before: number;
  after: number;
  change: number;
  reason: string;
}

/**
 * Autonomous Game Simulator
 * 
 * Runs complete prediction market games without human intervention.
 * All agent decisions are AI-driven based on their knowledge and role.
 * 
 * @example
 * ```typescript
 * const simulator = new GameSimulator({ outcome: true, numAgents: 5 });
 * const result = await simulator.runCompleteGame();
 * 
 * console.log(`Game: ${result.question}`);
 * console.log(`Outcome: ${result.outcome ? 'YES' : 'NO'}`);
 * console.log(`Duration: ${result.endTime - result.startTime}ms`);
 * console.log(`Events: ${result.events.length}`);
 * ```
 */
export class GameSimulator extends EventEmitter {
  private config: Required<GameConfig>;
  private events: GameEvent[] = [];
  private currentDay = 0;

  constructor(config: GameConfig) {
    super();
    
    // Set defaults
    this.config = {
      outcome: config.outcome,
      numAgents: config.numAgents || 5,
      duration: config.duration || 30,
      liquidityB: config.liquidityB || 100,
      insiderPercentage: config.insiderPercentage || 0.3,
    };
  }

  /**
   * Run complete game from start to finish
   * 
   * Simulates entire 30-day game cycle:
   * 1. Generate question aligned with outcome
   * 2. Create agents (some insiders, some outsiders)
   * 3. Distribute clues over time
   * 4. Agents make betting decisions
   * 5. Social interactions occur
   * 6. Market evolves toward outcome
   * 7. Outcome revealed and winners calculated
   * 
   * @returns Complete game result with event log
   */
  async runCompleteGame(): Promise<GameResult> {
    const startTime = Date.now();
    const gameId = uuid();

    // 1. SETUP
    const question = this.generateQuestion();
    const agents = this.createAgents();
    const clueNetwork = this.generateClueNetwork();

    this.emitEvent('game:started', {
      id: gameId,
      question,
      outcome: this.config.outcome,
      agents: agents.length,
    });

    // 2. SIMULATE ALL DAYS
    const market = { yesShares: 0, noShares: 0, yesOdds: 50, noOdds: 50, totalVolume: 0 };

    for (let day = 1; day <= this.config.duration; day++) {
      this.currentDay = day;
      
      this.emitEvent('day:changed', { day });

      // Distribute clues for this day
      const dayClues = this.getCluesForDay(day, agents, clueNetwork);
      dayClues.forEach(clue => {
        this.emitEvent('clue:distributed', clue, clue.agentId);
      });

      // Agents make betting decisions based on their knowledge
      const bets = this.processAgentBets(day, agents, market);
      bets.forEach(bet => {
        // Update market
        if (bet.outcome) {
          market.yesShares += bet.shares;
        } else {
          market.noShares += bet.shares;
        }
        market.totalVolume += bet.amount;
        
        // Recalculate odds using LMSR
        const odds = this.calculateLMSROdds(market.yesShares, market.noShares);
        market.yesOdds = odds.yesOdds;
        market.noOdds = odds.noOdds;

        this.emitEvent('agent:bet', bet, bet.agentId);
        this.emitEvent('market:updated', market);
      });

      // Agents post to feed
      const posts = this.generatePosts(day, agents);
      posts.forEach(post => {
        this.emitEvent('agent:post', post, post.agentId);
      });
    }

    // 3. REVEAL OUTCOME
    this.emitEvent('outcome:revealed', { outcome: this.config.outcome });

    // 4. CALCULATE WINNERS
    const winners = this.calculateWinners(agents, this.config.outcome);
    const reputationChanges = this.calculateReputationChanges(agents, winners);

    this.emitEvent('game:ended', {
      outcome: this.config.outcome,
      winners: winners.map(a => a.id),
      market,
    });

    const endTime = Date.now();

    return {
      id: gameId,
      question,
      outcome: this.config.outcome,
      startTime,
      endTime,
      events: this.events,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        yesShares: a.yesShares,
        noShares: a.noShares,
        reputation: a.reputation,
        isInsider: a.isInsider,
        cluesReceived: a.cluesReceived.length,
      })),
      market,
      reputationChanges,
      winners: winners.map(a => a.id),
    };
  }

  /**
   * Emit game event and add to log
   */
  private emitEvent(type: GameEventType, data: GameEventData, agentId?: string) {
    const event: GameEvent = {
      type,
      timestamp: Date.now(),
      day: this.currentDay,
      data,
      agentId,
    };

    this.events.push(event);
    this.emit(type, event);
    this.emit('event', event); // Generic event listener
  }

  /**
   * Generate question aligned with outcome
   */
  private generateQuestion(): string {
    const topics = [
      "Will Project Omega's satellite launch succeed?",
      "Will the scandal force President Stump to resign?",
      "Will TechCorp's AI breakthrough be announced?",
      "Will the climate summit reach an agreement?",
    ];
    return topics[Math.floor(Math.random() * topics.length)]!;
  }

  /**
   * Create AI agents with roles
   */
  private createAgents(): InternalAgent[] {
    const agents: InternalAgent[] = [];
    const numInsiders = Math.floor(this.config.numAgents * this.config.insiderPercentage);

    for (let i = 0; i < this.config.numAgents; i++) {
      agents.push({
        id: `agent-${i + 1}`,
        name: `Agent ${i + 1}`,
        isInsider: i < numInsiders,
        yesShares: 0,
        noShares: 0,
        reputation: 50,
        cluesReceived: [],
        knowledge: [],
      });
    }

    return agents;
  }

  /**
   * Generate clue network aligned with outcome
   */
  private generateClueNetwork(): ClueData[] {
    const clues: ClueData[] = [];
    const outcome = this.config.outcome;

    // Early clues (Days 1-10): Weak signals, mixed accuracy
    // 4 true clues (70% reliability), 2 false clues (noise)
    for (let i = 0; i < 6; i++) {
      const day = Math.floor(Math.random() * 10) + 1;
      const isTrueClue = i < 4;

      clues.push({
        id: `early-clue-${i}`,
        tier: 'early',
        day,
        pointsToward: isTrueClue ? outcome : !outcome, // Some noise in early days
        reliability: isTrueClue ? 0.6 + Math.random() * 0.15 : 0.4 + Math.random() * 0.2, // 60-75% for true, 40-60% for noise
      });
    }

    // Mid-game clues (Days 11-20): Stronger signals, higher accuracy
    // 6 true clues (80% reliability), 1 false clue
    for (let i = 0; i < 7; i++) {
      const day = Math.floor(Math.random() * 10) + 11;
      const isTrueClue = i < 6;

      clues.push({
        id: `mid-clue-${i}`,
        tier: 'mid',
        day,
        pointsToward: isTrueClue ? outcome : !outcome,
        reliability: isTrueClue ? 0.75 + Math.random() * 0.15 : 0.3 + Math.random() * 0.2, // 75-90% for true, 30-50% for noise
      });
    }

    // Late-game clues (Days 21-30): Definitive signals, very high accuracy
    // 8 true clues (90%+ reliability), almost no noise
    for (let i = 0; i < 8; i++) {
      const day = Math.floor(Math.random() * 10) + 21;

      clues.push({
        id: `late-clue-${i}`,
        tier: 'late',
        day,
        pointsToward: outcome, // All true in late game
        reliability: 0.85 + Math.random() * 0.15, // 85-100% reliability
      });
    }

    // Sort by day for realistic information flow
    return clues.sort((a, b) => a.day - b.day);
  }

  /**
   * Calculate market odds using LMSR (Logarithmic Market Scoring Rule)
   * This provides better price discovery and liquidity
   */
  private calculateLMSROdds(yesShares: number, noShares: number, liquidity: number = 100): { yesOdds: number; noOdds: number } {
    // LMSR formula: P(YES) = exp(q_yes / b) / (exp(q_yes / b) + exp(q_no / b))
    // where b is the liquidity parameter (higher = less price movement per trade)
    
    const b = liquidity;
    const expYes = Math.exp(yesShares / b);
    const expNo = Math.exp(noShares / b);
    const sumExp = expYes + expNo;
    
    const yesProb = expYes / sumExp;
    const noProb = expNo / sumExp;
    
    return {
      yesOdds: Math.round(yesProb * 100),
      noOdds: Math.round(noProb * 100),
    };
  }

  /**
   * Get clues to distribute on specific day
   */
  private getCluesForDay(day: number, agents: InternalAgent[], clueNetwork: ClueData[]): DistributedClue[] {
    const dayClues = clueNetwork.filter(c => c.day === day);
    const distributed: DistributedClue[] = [];

    dayClues.forEach(clue => {
      // Distribution strategy based on clue tier and reliability
      let recipient: InternalAgent | undefined;

      if (clue.tier === 'early') {
        // Early clues: Go to insiders first, then spread to connected agents
        recipient = agents.find(a => a.isInsider && a.cluesReceived.length < 8);

        // If no insiders available, give to random agent with few clues
        if (!recipient) {
          const eligibleAgents = agents.filter(a => a.cluesReceived.length < 5);
          recipient = eligibleAgents[Math.floor(Math.random() * eligibleAgents.length)];
        }
      } else if (clue.tier === 'mid') {
        // Mid clues: More widespread, prefer agents with some knowledge already
        const eligibleAgents = agents.filter(a => a.cluesReceived.length > 0 && a.cluesReceived.length < 10);
        recipient = eligibleAgents.length > 0
          ? eligibleAgents[Math.floor(Math.random() * eligibleAgents.length)]
          : agents.find(a => a.cluesReceived.length < 10);
      } else {
        // Late clues: Widespread distribution, anyone can receive
        const eligibleAgents = agents.filter(a => a.cluesReceived.length < 15);
        recipient = eligibleAgents[Math.floor(Math.random() * eligibleAgents.length)];
      }

      if (recipient) {
        recipient.cluesReceived.push({
          clue: `${clue.tier.toUpperCase()} Clue #${clue.id}: ${clue.reliability > 0.7 ? 'Strong signal' : 'Weak signal'} pointing to ${clue.pointsToward ? 'YES' : 'NO'}`,
          pointsToward: clue.pointsToward,
        });

        distributed.push({
          agentId: recipient.id,
          clue: `${clue.tier.toUpperCase()} Clue received: Points to ${clue.pointsToward ? 'YES' : 'NO'} (${Math.round(clue.reliability * 100)}% reliability)`,
          pointsToward: clue.pointsToward,
        });
      }
    });

    return distributed;
  }

  /**
   * Process agent betting decisions
   */
  private processAgentBets(day: number, agents: InternalAgent[], market: MarketState): AgentBet[] {
    const bets: AgentBet[] = [];

    // Agents bet based on their knowledge and the market state
    agents.forEach(agent => {
      // Bet on certain days based on clues
      const shouldBet = agent.cluesReceived.length > 0 && 
                       (day % 5 === 0 || day > 20);

      if (shouldBet && Math.random() > 0.5) {
        // Determine outcome based on clues
        const yesClues = agent.cluesReceived.filter((c) => c.pointsToward).length;
        const noClues = agent.cluesReceived.length - yesClues;
        const betOnYes = yesClues > noClues;

        const amount = 50 + Math.floor(Math.random() * 100);
        const shares = amount / (betOnYes ? (market.yesOdds || 50) : (market.noOdds || 50)) * 100;

        if (betOnYes) {
          agent.yesShares += shares;
        } else {
          agent.noShares += shares;
        }

        bets.push({
          agentId: agent.id,
          bet: `Bet ${amount} on ${betOnYes ? 'YES' : 'NO'} (${shares.toFixed(0)} shares)`,
          position: betOnYes ? 'YES' : 'NO',
          outcome: betOnYes,
          shares,
          amount,
        });
      }
    });

    return bets;
  }

  /**
   * Generate social posts
   */
  private generatePosts(day: number, agents: InternalAgent[]): AgentPost[] {
    const posts: AgentPost[] = [];

    // Some agents post each day
    if (day % 3 === 0) {
      agents.slice(0, 2).forEach(agent => {
        posts.push({
          agentId: agent.id,
          post: `Day ${day}: My analysis suggests ${agent.yesShares > agent.noShares ? 'YES' : 'NO'}`,
        });
      });
    }

    return posts;
  }

  /**
   * Calculate winners based on outcome
   */
  private calculateWinners(agents: InternalAgent[], outcome: boolean): InternalAgent[] {
    return agents.filter(agent => {
      if (outcome) {
        return agent.yesShares > agent.noShares;
      } else {
        return agent.noShares > agent.yesShares;
      }
    });
  }

  /**
   * Calculate reputation changes
   */
  private calculateReputationChanges(agents: InternalAgent[], winners: InternalAgent[]): ReputationChange[] {
    return agents.map(agent => {
      const isWinner = winners.some(w => w.id === agent.id);
      const change = isWinner ? 10 : -5;
      
      return {
        agentId: agent.id,
        before: agent.reputation,
        after: agent.reputation + change,
        change,
        reason: isWinner ? 'Correct prediction' : 'Incorrect prediction',
      };
    });
  }
}

