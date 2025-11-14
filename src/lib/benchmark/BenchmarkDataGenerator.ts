/**
 * Benchmark Data Generator
 * 
 * Generates deterministic benchmark scenarios for agent testing.
 * Creates pre-recorded game states with known outcomes for reproducible testing.
 */

import { logger } from '@/lib/logger';

export interface BenchmarkConfig {
  /** Duration of benchmark in minutes */
  durationMinutes: number;
  
  /** Interval between ticks in seconds */
  tickInterval: number;
  
  /** Number of prediction markets */
  numPredictionMarkets: number;
  
  /** Number of perpetual markets */
  numPerpetualMarkets: number;
  
  /** Number of other simulated agents */
  numAgents: number;
  
  /** Random seed for reproducibility */
  seed?: number;
}

export interface GameState {
  tick: number;
  timestamp: number;
  predictionMarkets: PredictionMarket[];
  perpetualMarkets: PerpetualMarket[];
  agents: SimulatedAgent[];
  posts?: any[];
  groupChats?: any[];
}

export interface PredictionMarket {
  id: string;
  question: string;
  yesShares: number;
  noShares: number;
  yesPrice: number;
  noPrice: number;
  totalVolume: number;
  liquidity: number;
  resolved: boolean;
  createdAt: number;
  resolveAt: number;
}

export interface PerpetualMarket {
  ticker: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  nextFundingTime: number;
}

export interface SimulatedAgent {
  id: string;
  name: string;
  reputation: number;
  totalPnl: number;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: number;
  likes: number;
  comments: number;
  marketId?: string;
}

export interface GroupChat {
  id: string;
  name: string;
  memberIds: string[];
  messageCount: number;
  lastActivity: number;
  invitedAgent?: boolean;
}

export interface Tick {
  number: number;
  timestamp: number;
  events: TickEvent[];
  state: GameState;
}

export interface TickEvent {
  type: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface GroundTruth {
  /** Known market outcomes (marketId -> boolean) */
  marketOutcomes: Record<string, boolean>;
  
  /** Historical price data */
  priceHistory: Record<string, Array<{ tick: number; timestamp: number; price: number }>>;
  
  /** Optimal actions for perfect play */
  optimalActions: Array<{
    tick: number;
    type: string;
    target: string;
    expectedValue: number;
    reason: string;
  }>;
  
  /** Social opportunities */
  socialOpportunities: Array<{
    tick: number;
    type: string;
    value: number;
    description: string;
  }>;
}

export interface BenchmarkGameSnapshot {
  id: string;
  version: string;
  createdAt: number;
  duration: number;
  tickInterval: number;
  initialState: GameState;
  ticks: Tick[];
  groundTruth: GroundTruth;
}

export class BenchmarkDataGenerator {
  private config: BenchmarkConfig;
  private rng: SeededRandom;
  
  constructor(config: BenchmarkConfig) {
    this.config = config;
    this.rng = new SeededRandom(config.seed || Date.now());
  }
  
  /**
   * Generate a complete benchmark snapshot
   */
  async generate(): Promise<BenchmarkGameSnapshot> {
    const id = Date.now().toString();
    const createdAt = Date.now();
    const numTicks = Math.floor((this.config.durationMinutes * 60) / this.config.tickInterval);
    
    logger.info('Generating benchmark', {
      id,
      duration: this.config.durationMinutes,
      ticks: numTicks,
    });
    
    // Generate initial state
    const initialState = this.generateInitialState(createdAt);
    
    // Generate ground truth (outcomes)
    const groundTruth = this.generateGroundTruth(initialState, numTicks);
    
    // Generate tick-by-tick progression
    const ticks = this.generateTicks(initialState, groundTruth, numTicks, createdAt);
    
    logger.info('Benchmark generated', {
      id,
      ticks: ticks.length,
      markets: initialState.predictionMarkets.length,
      perps: initialState.perpetualMarkets.length,
    });
    
    return {
      id,
      version: '1.0.0',
      createdAt,
      duration: this.config.durationMinutes * 60,
      tickInterval: this.config.tickInterval,
      initialState,
      ticks,
      groundTruth,
    };
  }
  
  /**
   * Generate initial game state
   */
  private generateInitialState(timestamp: number): GameState {
    const predictionMarkets: PredictionMarket[] = [];
    const questions = [
      'Will Bitcoin reach $100k by end of month?',
      'Will the next Fed meeting result in rate cut?',
      'Will Trump win the 2024 election?',
      'Will Ethereum merge be successful?',
      'Will Tesla stock hit $300 this quarter?',
      'Will GPT-5 be released this year?',
      'Will inflation drop below 2%?',
      'Will the S&P 500 reach new highs?',
      'Will oil prices exceed $100/barrel?',
      'Will Apple announce new product line?',
    ];
    
    for (let i = 0; i < this.config.numPredictionMarkets; i++) {
      const question = questions[i % questions.length];
      // Generate markets with varied prices (some low, some high)
      const ratio = this.rng.next();
      const yesShares = ratio < 0.5 ? 100 + this.rng.next() * 300 : 300 + this.rng.next() * 700;
      const noShares = ratio < 0.5 ? 300 + this.rng.next() * 700 : 100 + this.rng.next() * 300;
      const totalShares = yesShares + noShares;
      const yesPrice = yesShares / totalShares;
      const noPrice = noShares / totalShares;
      
      if (question) {
        predictionMarkets.push({
          id: `market-${i}`,
          question,
          yesShares,
          noShares,
          yesPrice,
          noPrice,
          totalVolume: 0,
          liquidity: yesShares + noShares,
          resolved: false,
          createdAt: timestamp,
          resolveAt: timestamp + this.config.durationMinutes * 60 * 1000,
        });
      }
    }
    
    const perpetualMarkets: PerpetualMarket[] = [];
    const tickers = ['BTC', 'ETH', 'SOL', 'AVAX', 'MATIC'];
    const basePrices = [65000, 3200, 140, 35, 0.9];
    
    for (let i = 0; i < this.config.numPerpetualMarkets; i++) {
      const ticker = tickers[i % tickers.length]!;
      const basePrice = basePrices[i % basePrices.length]!;
      
      perpetualMarkets.push({
        ticker,
        price: basePrice,
        priceChange24h: (this.rng.next() - 0.5) * 10,
        volume24h: 1000000 + this.rng.next() * 2000000,
        openInterest: 500000 + this.rng.next() * 1000000,
        fundingRate: (this.rng.next() - 0.5) * 0.002,
        nextFundingTime: timestamp + 8 * 60 * 60 * 1000,
      });
    }
    
    const agents: SimulatedAgent[] = [];
    for (let i = 0; i < this.config.numAgents; i++) {
      agents.push({
        id: `agent-${i}`,
        name: `Agent ${i}`,
        reputation: 50 + this.rng.next() * 50,
        totalPnl: (this.rng.next() - 0.5) * 1000,
      });
    }
    
    return {
      tick: 0,
      timestamp,
      predictionMarkets,
      perpetualMarkets,
      agents,
    };
  }
  
  /**
   * Generate ground truth (known outcomes)
   */
  private generateGroundTruth(initialState: GameState, numTicks: number): GroundTruth {
    // Randomly determine market outcomes
    const marketOutcomes: Record<string, boolean> = {};
    for (const market of initialState.predictionMarkets) {
      marketOutcomes[market.id] = this.rng.next() > 0.5;
    }
    
    // Generate price history for perpetuals
    const priceHistory: Record<string, Array<{ tick: number; timestamp: number; price: number }>> = {};
    for (const perp of initialState.perpetualMarkets) {
      const history: Array<{ tick: number; timestamp: number; price: number }> = [];
      let currentPrice = perp.price;
      
      for (let tick = 0; tick < numTicks; tick++) {
        // Random walk with drift
        const change = (this.rng.next() - 0.48) * 0.02; // Slight upward bias
        currentPrice = currentPrice * (1 + change);
        
        history.push({
          tick,
          timestamp: 0, // Will be filled in during tick generation
          price: currentPrice,
        });
      }
      
      priceHistory[perp.ticker] = history;
    }
    
    // Generate optimal actions
    const optimalActions: GroundTruth['optimalActions'] = [];
    for (const [marketId, outcome] of Object.entries(marketOutcomes)) {
      optimalActions.push({
        tick: 1, // Buy early for best price
        type: 'buy_prediction',
        target: marketId,
        expectedValue: 100,
        reason: `Market ${marketId} will resolve ${outcome ? 'YES' : 'NO'}`,
      });
    }
    
    // Generate social opportunities
    const socialOpportunities: GroundTruth['socialOpportunities'] = [];
    for (let i = 0; i < numTicks; i += Math.floor(numTicks / 5)) {
      socialOpportunities.push({
        tick: i,
        type: this.rng.next() > 0.5 ? 'insider_signal' : 'group_invite',
        value: 50 + this.rng.next() * 150,
        description: this.rng.next() > 0.5 
          ? 'Insider information about market outcome'
          : `Invitation to high-value trading group ${i}`,
      });
    }
    
    return {
      marketOutcomes,
      priceHistory,
      optimalActions,
      socialOpportunities,
    };
  }
  
  /**
   * Generate tick-by-tick progression
   */
  private generateTicks(
    initialState: GameState,
    groundTruth: GroundTruth,
    numTicks: number,
    startTimestamp: number
  ): Tick[] {
    const ticks: Tick[] = [];
    let currentState = JSON.parse(JSON.stringify(initialState));
    
    for (let i = 0; i < numTicks; i++) {
      const tickTimestamp = startTimestamp + (i + 1) * this.config.tickInterval * 1000;
      const events: TickEvent[] = [];
      
      // Update perpetual prices
      for (const perp of currentState.perpetualMarkets) {
        const tickerHistory = groundTruth.priceHistory[perp.ticker];
        const priceAtTick = tickerHistory?.[i];
        const newPrice = priceAtTick?.price ?? perp.price;
        events.push({
          type: 'price:updated',
          timestamp: startTimestamp,
          data: {
            ticker: perp.ticker,
            oldPrice: perp.price,
            newPrice,
          },
        });
        perp.price = newPrice;
      }
      
      // Simulate some agent actions
      if (this.rng.next() > 0.5) {
        const agentId = `agent-${Math.floor(this.rng.next() * this.config.numAgents)}`;
        const marketId = `market-${Math.floor(this.rng.next() * this.config.numPredictionMarkets)}`;
        const outcome = this.rng.next() > 0.5 ? 'YES' : 'NO';
        
        events.push({
          type: 'market:trade',
          timestamp: startTimestamp,
          data: {
            marketId,
            agentId,
            outcome,
            amount: 10 + this.rng.next() * 90,
          },
        });
      }
      
      // Simulate social activity
      if (this.rng.next() > 0.7) {
        const agentId = `agent-${Math.floor(this.rng.next() * this.config.numAgents)}`;
        const marketId = `market-${Math.floor(this.rng.next() * this.config.numPredictionMarkets)}`;
        
        events.push({
          type: 'post:created',
          timestamp: startTimestamp,
          data: {
            authorId: agentId,
            authorName: `Agent ${agentId.split('-')[1]}`,
            content: `Market sentiment seems ${this.rng.next() > 0.5 ? 'bullish' : 'bearish'} on ${currentState.predictionMarkets.find((m: { id: string; question: string }) => m.id === marketId)?.question}`,
          },
        });
      }
      
      // Update current state
      currentState.tick = i + 1;
      currentState.timestamp = tickTimestamp;
      
      ticks.push({
        number: i,
        timestamp: tickTimestamp,
        events,
        state: JSON.parse(JSON.stringify(currentState)),
      });
    }
    
    return ticks;
  }
}

/**
 * Seeded random number generator for reproducibility
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: number) {
    this.seed = seed;
  }
  
  /**
   * Generate next random number (0-1)
   */
  next(): number {
    // Linear congruential generator
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}
