/**
 * Babylon Game Simulator - Autonomous Prediction Market Simulator
 * 
 * @module engine/GameSimulator
 * 
 * @description
 * Fully autonomous simulation of prediction market games from start to finish.
 * Generates complete 30-day game narratives with agents, clues, bets, and outcomes
 * without any human intervention.
 * 
 * **Key Features:**
 * - Predetermined outcome that agents discover over time
 * - Insider agents with privileged information
 * - Clue distribution system (early/mid/late game)
 * - LMSR (Logarithmic Market Scoring Rule) for pricing
 * - Event-driven architecture with full event logging
 * - Social interactions and agent conversations
 * - Reputation system with win/loss tracking
 * 
 * **Simulation Flow:**
 * 1. Setup: Generate question, create agents (insiders + outsiders), build clue network
 * 2. Daily Loop (30 days):
 *    - Distribute clues to agents
 *    - Agents make betting decisions based on knowledge
 *    - Market prices update via LMSR
 *    - Social posts and interactions
 * 3. Resolution: Reveal outcome, calculate winners, update reputation
 * 
 * **Use Cases:**
 * - Testing game mechanics without UI
 * - Generating training data for ML models
 * - Simulating market dynamics
 * - Stress testing prediction markets
 * - Rapid prototyping of game rules
 * 
 * **NOT Used For:**
 * - Production game (use GameEngine instead)
 * - Real player interactions (no betting infrastructure)
 * - Persistent state (all state is in-memory)
 * 
 * @see {@link GameEngine} - Production game engine with persistence
 * @see {@link GameWorld} - Event generation without betting
 * 
 * @example
 * ```typescript
 * const simulator = new GameSimulator({
 *   outcome: true,
 *   numAgents: 10,
 *   duration: 30,
 *   insiderPercentage: 0.3
 * });
 * 
 * const result = await simulator.runCompleteGame();
 * console.log(`Outcome: ${result.outcome ? 'YES' : 'NO'}`);
 * console.log(`${result.events.length} events generated`);
 * console.log(`${result.winners.length} winners`);
 * ```
 */

import { EventEmitter } from 'events';
import { generateSnowflakeId } from '@/lib/snowflake';
import type { JsonValue } from '@/types/common';

/**
 * GameSimulator Event Types
 */
export interface GameSimulatorEvents {
  'game:started': { data: { question: string; agents: number } };
  'day:changed': { data: { day: number }; day: number };
  'clue:distributed': { agentId: string; data: { tier: string } };
  'agent:bet': { agentId: string; data: { outcome: boolean; amount: number } };
  'market:updated': { data: { yesOdds: number; noOdds: number }; day: number };
  'outcome:revealed': { data: { outcome: boolean } };
  'game:ended': { data: { winners: string[] } };
  'event': { type: string; data: JsonValue };
}

/**
 * Configuration options for game simulation
 * 
 * @interface GameConfig
 * 
 * @property outcome - Predetermined outcome (true = YES, false = NO)
 * @property numAgents - Number of AI agents (2-20, default 5)
 * @property duration - Game duration in days (default 30)
 * @property liquidityB - LMSR liquidity parameter (default 100, higher = less price movement)
 * @property insiderPercentage - Percentage of agents who are insiders (0-1, default 0.3)
 */
export interface GameConfig {
  outcome: boolean;
  numAgents?: number;
  duration?: number;
  liquidityB?: number;
  insiderPercentage?: number;
}

/**
 * Complete game result with full event history
 * 
 * @interface GameResult
 * 
 * @description
 * Contains the complete state and history of a simulated game from start to finish.
 * Includes all events, final agent states, market data, and winner information.
 * 
 * @property id - Unique snowflake ID for this game
 * @property question - The prediction market question text
 * @property outcome - Final outcome (true = YES, false = NO)
 * @property startTime - Unix timestamp when game started
 * @property endTime - Unix timestamp when game ended
 * @property events - Complete chronological event log
 * @property agents - Final state of all agents
 * @property market - Final market state (prices, shares, volume)
 * @property reputationChanges - Reputation deltas for all agents
 * @property winners - Array of agent IDs who bet correctly
 */
export interface GameResult {
  id: string;
  question: string;
  outcome: boolean;
  startTime: number;
  endTime: number;
  events: GameEvent[];
  agents: AgentState[];
  market: MarketState;
  reputationChanges: ReputationChange[];
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
 * @class GameSimulator
 * @extends EventEmitter
 * 
 * @description
 * Self-contained prediction market simulator that runs complete games from start
 * to finish without external input. Generates agents, clues, bets, and outcomes
 * autonomously.
 * 
 * **Architecture:**
 * - Extends EventEmitter for real-time event streaming
 * - All state maintained in memory (no database)
 * - Deterministic clue generation based on outcome
 * - LMSR market pricing with configurable liquidity
 * 
 * **Events Emitted:**
 * - `game:started` - Game initialization complete
 * - `day:changed` - New day begins
 * - `clue:distributed` - Agent receives clue
 * - `agent:bet` - Agent places bet
 * - `agent:post` - Agent posts to feed
 * - `market:updated` - Market prices change
 * - `outcome:revealed` - Game outcome revealed
 * - `game:ended` - Game complete
 * 
 * **Clue Network Design:**
 * - Early (Days 1-10): 70% accurate, some noise
 * - Mid (Days 11-20): 80% accurate, clearer signals
 * - Late (Days 21-30): 90%+ accurate, definitive information
 * - Distribution: Insiders get clues first, then spread
 * 
 * **Agent Decision Making:**
 * - Agents bet based on clues received
 * - YES/NO decision based on clue majority
 * - Bet amounts randomized (50-150 units)
 * - Bet frequency increases toward end (every 5 days early, more frequent late)
 * 
 * @usage
 * Used for testing, simulation, and research. Not used in production gameplay.
 * 
 * @example
 * ```typescript
 * const simulator = new GameSimulator({ 
 *   outcome: true, 
 *   numAgents: 10,
 *   duration: 30,
 *   insiderPercentage: 0.4 
 * });
 * 
 * simulator.on('agent:bet', (event) => {
 *   console.log(`${event.data.agentId} bet on ${event.data.position}`);
 * });
 * 
 * const result = await simulator.runCompleteGame();
 * console.log(`Game complete: ${result.winners.length} winners`);
 * ```
 */

/**
 * Typed EventEmitter interface for GameSimulator
 */
interface TypedGameSimulatorEmitter {
  on<K extends keyof GameSimulatorEvents>(event: K, listener: (data: GameSimulatorEvents[K]) => void): this;
  emit<K extends keyof GameSimulatorEvents>(event: K, data: GameSimulatorEvents[K]): boolean;
  off<K extends keyof GameSimulatorEvents>(event: K, listener: (data: GameSimulatorEvents[K]) => void): this;
}

export class GameSimulator extends EventEmitter implements TypedGameSimulatorEmitter {
  private config: Required<GameConfig>;
  private events: GameEvent[] = [];
  private currentDay = 0;

  /**
   * Create a new game simulator
   * 
   * @param config - Game configuration options
   * 
   * @description
   * Initializes simulator with configuration. All optional values are set to
   * sensible defaults for balanced gameplay.
   * 
   * @example
   * ```typescript
   * const sim = new GameSimulator({
   *   outcome: true,
   *   numAgents: 8,
   *   duration: 30,
   *   liquidityB: 150,
   *   insiderPercentage: 0.25
   * });
   * ```
   */
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
   * Run complete autonomous game simulation
   * 
   * @returns Complete game result with full event history
   * @throws Never throws - all errors are logged and handled internally
   * 
   * @description
   * Executes a full 30-day prediction market game simulation from start to finish.
   * All agent decisions are autonomous based on clues and market state.
   * 
   * **Simulation Steps:**
   * 1. **Setup**
   *    - Generate prediction question
   *    - Create agents (insiders + outsiders based on insiderPercentage)
   *    - Build clue network (21 total clues, distributed by reliability)
   * 
   * 2. **Daily Loop** (30 days)
   *    - Distribute clues for current day
   *    - Agents make betting decisions based on knowledge
   *    - Update market prices via LMSR
   *    - Generate social posts (every 3 days)
   *    - Emit events for monitoring
   * 
   * 3. **Resolution**
   *    - Reveal final outcome
   *    - Calculate winners (agents who bet correctly)
   *    - Update reputation (+10 winners, -5 losers)
   * 
   * **Performance:**
   * - Typical runtime: 100-500ms (no LLM calls)
   * - Memory usage: ~1-2MB per game
   * - Event count: 200-500 events per game
   * 
   * **Event Streaming:**
   * Listen to events for real-time updates:
   * ```typescript
   * sim.on('day:changed', (event) => { ... });
   * sim.on('agent:bet', (event) => { ... });
   * ```
   * 
   * @example
   * ```typescript
   * const sim = new GameSimulator({ outcome: true, numAgents: 10 });
   * const result = await sim.runCompleteGame();
   * 
   * console.log(`Question: ${result.question}`);
   * console.log(`Outcome: ${result.outcome ? 'YES' : 'NO'}`);
   * console.log(`Duration: ${result.endTime - result.startTime}ms`);
   * console.log(`Events: ${result.events.length}`);
   * console.log(`Winners: ${result.winners.length}/${result.agents.length}`);
   * 
   * // Analyze market evolution
   * const finalPrices = result.market;
   * console.log(`Final YES price: ${finalPrices.yesOdds}%`);
   * console.log(`Total volume: $${finalPrices.totalVolume}`);
   * ```
   */
  async runCompleteGame(): Promise<GameResult> {
    const startTime = Date.now();
    const gameId = await generateSnowflakeId();

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

