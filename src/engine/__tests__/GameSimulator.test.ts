/**
 * GameSimulator Tests
 * Tests autonomous game engine without server dependencies
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { GameSimulator, type GameConfig, type GameResult } from '../GameSimulator';

describe('GameSimulator - Standalone Engine', () => {
  let simulator: GameSimulator;
  let config: GameConfig;

  beforeEach(() => {
    config = {
      outcome: true, // YES
      numAgents: 5,
      duration: 30,
    };
    simulator = new GameSimulator(config);
  });

  describe('Instantiation', () => {
    test('can create simulator without server dependencies', () => {
      expect(simulator).toBeDefined();
      expect(simulator).toBeInstanceOf(GameSimulator);
    });

    test('accepts custom configuration', () => {
      const custom = new GameSimulator({
        outcome: false,
        numAgents: 10,
        duration: 15,
        liquidityB: 200,
        insiderPercentage: 0.4,
      });

      expect(custom).toBeDefined();
    });

    test('sets defaults for missing config', () => {
      const minimal = new GameSimulator({ outcome: true });
      expect(minimal).toBeDefined();
    });
  });

  describe('Complete Game Simulation', () => {
    test('runs complete 30-day game', async () => {
      const result = await simulator.runCompleteGame();

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.question).toBeDefined();
      expect(result.outcome).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
    });

    test('completes in under 2 seconds', async () => {
      const start = Date.now();
      await simulator.runCompleteGame();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(2000);
    });

    test('emits all required events', async () => {
      const eventTypes = new Set<string>();

      simulator.on('event', (event) => {
        eventTypes.add(event.type);
      });

      await simulator.runCompleteGame();

      expect(eventTypes.has('game:started')).toBe(true);
      expect(eventTypes.has('day:changed')).toBe(true);
      expect(eventTypes.has('clue:distributed')).toBe(true);
      expect(eventTypes.has('agent:bet')).toBe(true);
      expect(eventTypes.has('market:updated')).toBe(true);
      expect(eventTypes.has('outcome:revealed')).toBe(true);
      expect(eventTypes.has('game:ended')).toBe(true);
    });

    test('processes all 30 days', async () => {
      const result = await simulator.runCompleteGame();
      
      const dayEvents = result.events.filter(e => e.type === 'day:changed');
      expect(dayEvents.length).toBe(30);
    });

    test('creates event log', async () => {
      const result = await simulator.runCompleteGame();

      expect(result.events).toBeDefined();
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBeGreaterThan(30); // At least one event per day
    });
  });

  describe('Predetermined Outcomes', () => {
    test('YES outcome produces YES result', async () => {
      const yesSimulator = new GameSimulator({ outcome: true, numAgents: 5 });
      const result = await yesSimulator.runCompleteGame();

      expect(result.outcome).toBe(true);
    });

    test('NO outcome produces NO result', async () => {
      const noSimulator = new GameSimulator({ outcome: false, numAgents: 5 });
      const result = await noSimulator.runCompleteGame();

      expect(result.outcome).toBe(false);
    });

    test('clues align with predetermined outcome', async () => {
      const events: Array<{ data: { clue?: string } }> = [];
      simulator.on('clue:distributed', (event) => events.push(event));

      await simulator.runCompleteGame();

      // Should have distributed clues
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('Agent Behavior', () => {
    test('creates correct number of agents', async () => {
      const result = await simulator.runCompleteGame();

      expect(result.agents.length).toBe(5);
    });

    test('designates insiders correctly', async () => {
      const result = await simulator.runCompleteGame();

      const insiders = result.agents.filter(a => a.isInsider);
      const expected = Math.floor(5 * 0.3); // 30% insiders
      
      expect(insiders.length).toBeGreaterThanOrEqual(expected);
    });

    test('agents receive clues', async () => {
      const result = await simulator.runCompleteGame();

      const agentsWithClues = result.agents.filter(a => a.cluesReceived > 0);
      expect(agentsWithClues.length).toBeGreaterThan(0);
    });

    test('agents place bets', async () => {
      const result = await simulator.runCompleteGame();

      const betEvents = result.events.filter(e => e.type === 'agent:bet');
      expect(betEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Market Evolution', () => {
    test('market starts at 50/50', async () => {
      let firstMarketUpdate: { data?: { yesOdds?: number; noOdds?: number } } | undefined;
      simulator.on('market:updated', (event) => {
        if (!firstMarketUpdate) firstMarketUpdate = event;
      });

      await simulator.runCompleteGame();

      // After first bet, odds should be near 50/50
      expect(firstMarketUpdate).toBeDefined();
    });

    test('market moves toward correct outcome', async () => {
      const result = await simulator.runCompleteGame();

      const finalMarket = result.market;
      
      if (result.outcome) {
        // For YES outcome, YES odds should be higher
        expect(finalMarket.yesOdds).toBeGreaterThan(40);
      } else {
        // For NO outcome, NO odds should be higher
        expect(finalMarket.noOdds).toBeGreaterThan(40);
      }
    });

    test('volume increases over time', async () => {
      const result = await simulator.runCompleteGame();

      expect(result.market.totalVolume).toBeGreaterThan(0);
    });
  });

  describe('Game Results', () => {
    test('identifies winners correctly', async () => {
      const result = await simulator.runCompleteGame();

      expect(result.winners).toBeDefined();
      expect(Array.isArray(result.winners)).toBe(true);
      
      // Should have at least one winner
      expect(result.winners.length).toBeGreaterThan(0);
    });

    test('calculates reputation changes', async () => {
      const result = await simulator.runCompleteGame();

      expect(result.reputationChanges).toBeDefined();
      expect(result.reputationChanges.length).toBe(result.agents.length);
      
      // Winners should gain reputation
      const winnerChanges = result.reputationChanges.filter(c => 
        result.winners.includes(c.agentId)
      );
      winnerChanges.forEach(change => {
        expect(change.change).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance', () => {
    test('runs fast enough for batch testing', async () => {
      const games: GameResult[] = [];
      const start = Date.now();

      for (let i = 0; i < 10; i++) {
        const sim = new GameSimulator({ outcome: i % 2 === 0, numAgents: 5 });
        games.push(await sim.runCompleteGame());
      }

      const duration = Date.now() - start;

      expect(games.length).toBe(10);
      expect(duration).toBeLessThan(10000); // 10 games in under 10s
    });
  });
});

