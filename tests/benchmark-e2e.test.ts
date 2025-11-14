/**
 * End-to-End Integration Tests for Benchmark System
 * 
 * Tests the complete flow of running an agent through a benchmark.
 */

import { describe, it, expect } from 'bun:test';
import { BenchmarkDataGenerator, type BenchmarkConfig } from '@/lib/benchmark/BenchmarkDataGenerator';
import { SimulationEngine, type SimulationConfig } from '@/lib/benchmark/SimulationEngine';
import { SimulationA2AInterface } from '@/lib/benchmark/SimulationA2AInterface';

// Mock agent that makes simple decisions
class MockAgent {
  private a2aClient: SimulationA2AInterface;
  private actionsTaken: number = 0;
  
  constructor(a2aClient: SimulationA2AInterface) {
    this.a2aClient = a2aClient;
  }
  
  async executeTick(): Promise<void> {
    try {
      // Get market data
      const predictions = await this.a2aClient.sendRequest('a2a.getPredictions') as any;
      
      // Simple strategy: buy YES on first market if price < 0.6
      if (predictions.predictions && predictions.predictions.length > 0) {
        const market = predictions.predictions[0];
        if (market.yesPrice < 0.6) {
          await this.a2aClient.sendRequest('a2a.buyShares', {
            marketId: market.id,
            outcome: 'YES',
            amount: 100,
          });
          this.actionsTaken++;
        }
      }
    } catch (error) {
      // Silently continue on errors
    }
  }
  
  getActionCount(): number {
    return this.actionsTaken;
  }
}

describe('Benchmark System E2E', () => {
  it('should run a complete benchmark with mock agent', async () => {
    // 1. Generate small benchmark
    const config: BenchmarkConfig = {
      durationMinutes: 1, // Very short for test
      tickInterval: 10,
      numPredictionMarkets: 2,
      numPerpetualMarkets: 1,
      numAgents: 3,
      seed: 99999,
    };
    
    const generator = new BenchmarkDataGenerator(config);
    const snapshot = await generator.generate();
    
    expect(snapshot).toBeDefined();
    expect(snapshot.ticks.length).toBeGreaterThan(0);
    
    // 2. Create simulation engine
    const simConfig: SimulationConfig = {
      snapshot,
      agentId: 'test-agent-e2e',
      fastForward: true,
      responseTimeout: 5000,
    };
    
    const engine = new SimulationEngine(simConfig);
    
    // 3. Create A2A interface
    const a2aInterface = new SimulationA2AInterface(engine, 'test-agent-e2e');
    
    // 4. Create mock agent
    const mockAgent = new MockAgent(a2aInterface);
    
    // 5. Initialize and run simulation
    engine.initialize();
    
    const totalTicks = engine.getTotalTicks();
    
    while (!engine.isComplete()) {
      // Agent makes decisions
      await mockAgent.executeTick();
      
      // Advance tick
      engine.advanceTick();
    }
    
    // 6. Get results
    const result = await engine.run();
    
    // Verify results structure
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.agentId).toBe('test-agent-e2e');
    expect(result.benchmarkId).toBe(snapshot.id);
    // Ticks processed should match total ticks (currentTick will be at totalTicks after completion)
    expect(result.ticksProcessed).toBe(totalTicks);
    expect(result.actions).toBeDefined();
    expect(result.metrics).toBeDefined();
    expect(result.trajectory).toBeDefined();
    
    // Verify metrics structure
    expect(result.metrics.totalPnl).toBeDefined();
    expect(result.metrics.predictionMetrics).toBeDefined();
    expect(result.metrics.perpMetrics).toBeDefined();
    expect(result.metrics.socialMetrics).toBeDefined();
    expect(result.metrics.timing).toBeDefined();
    expect(result.metrics.optimalityScore).toBeDefined();
    
    // Verify agent took at least some actions
    expect(mockAgent.getActionCount()).toBeGreaterThan(0);
    expect(result.actions.length).toBeGreaterThanOrEqual(mockAgent.getActionCount());
    
    // Verify trajectory data
    expect(result.trajectory.states).toBeDefined();
    expect(result.trajectory.actions).toBeDefined();
    expect(result.trajectory.rewards).toBeDefined();
    expect(result.trajectory.windowId).toBe(`benchmark-${snapshot.id}`);
  }, 30000); // 30 second timeout
  
  it('should calculate metrics correctly for known outcomes', async () => {
    // Generate benchmark with seed for reproducibility
    const config: BenchmarkConfig = {
      durationMinutes: 1,
      tickInterval: 10,
      numPredictionMarkets: 2,
      numPerpetualMarkets: 1,
      numAgents: 3,
      seed: 12345,
    };
    
    const generator = new BenchmarkDataGenerator(config);
    const snapshot = await generator.generate();
    
    const simConfig: SimulationConfig = {
      snapshot,
      agentId: 'test-agent-metrics',
      fastForward: true,
      responseTimeout: 5000,
    };
    
    const engine = new SimulationEngine(simConfig);
    const a2aInterface = new SimulationA2AInterface(engine, 'test-agent-metrics');
    
    engine.initialize();
    
    // Take one action we know the outcome of
    const predictions = await a2aInterface.sendRequest('a2a.getPredictions') as any;
    if (predictions.predictions && predictions.predictions.length > 0) {
      const market = predictions.predictions[0];
      const groundTruthOutcome = snapshot.groundTruth.marketOutcomes[market.id];
      
      // Buy the correct outcome
      await a2aInterface.sendRequest('a2a.buyShares', {
        marketId: market.id,
        outcome: groundTruthOutcome ? 'YES' : 'NO',
        amount: 100,
      });
    }
    
    // Run through all ticks
    while (!engine.isComplete()) {
      engine.advanceTick();
    }
    
    const result = await engine.run();
    
    // Since we bought the correct outcome, accuracy should be 100%
    expect(result.metrics.predictionMetrics.totalPositions).toBe(1);
    expect(result.metrics.predictionMetrics.correctPredictions).toBe(1);
    expect(result.metrics.predictionMetrics.accuracy).toBe(1.0);
  }, 30000);
  
  it('should handle agent errors gracefully', async () => {
    const config: BenchmarkConfig = {
      durationMinutes: 1,
      tickInterval: 10,
      numPredictionMarkets: 2,
      numPerpetualMarkets: 1,
      numAgents: 3,
      seed: 54321,
    };
    
    const generator = new BenchmarkDataGenerator(config);
    const snapshot = await generator.generate();
    
    const simConfig: SimulationConfig = {
      snapshot,
      agentId: 'test-agent-errors',
      fastForward: true,
      responseTimeout: 5000,
    };
    
    const engine = new SimulationEngine(simConfig);
    const a2aInterface = new SimulationA2AInterface(engine, 'test-agent-errors');
    
    engine.initialize();
    
    // Try to make invalid action
    try {
      await a2aInterface.sendRequest('a2a.buyShares', {
        marketId: 'nonexistent-market',
        outcome: 'YES',
        amount: 100,
      });
    } catch (error) {
      // Expected to fail
    }
    
    // Simulation should continue
    while (!engine.isComplete()) {
      engine.advanceTick();
    }
    
    const result = await engine.run();
    
    // Should still complete successfully
    expect(result).toBeDefined();
    expect(result.metrics).toBeDefined();
  }, 30000);
  
  it('should track all action types correctly', async () => {
    const config: BenchmarkConfig = {
      durationMinutes: 1,
      tickInterval: 10,
      numPredictionMarkets: 2,
      numPerpetualMarkets: 2,
      numAgents: 3,
      seed: 11111,
    };
    
    const generator = new BenchmarkDataGenerator(config);
    const snapshot = await generator.generate();
    
    const simConfig: SimulationConfig = {
      snapshot,
      agentId: 'test-agent-actions',
      fastForward: true,
      responseTimeout: 5000,
    };
    
    const engine = new SimulationEngine(simConfig);
    const a2aInterface = new SimulationA2AInterface(engine, 'test-agent-actions');
    
    engine.initialize();
    
    // Take different types of actions
    const predictions = await a2aInterface.sendRequest('a2a.getPredictions') as any;
    if (predictions.predictions && predictions.predictions.length > 0) {
      await a2aInterface.sendRequest('a2a.buyShares', {
        marketId: predictions.predictions[0].id,
        outcome: 'YES',
        amount: 50,
      });
    }
    
    const perpetuals = await a2aInterface.sendRequest('a2a.getPerpetuals') as any;
    if (perpetuals.perpetuals && perpetuals.perpetuals.length > 0) {
      await a2aInterface.sendRequest('a2a.openPosition', {
        ticker: perpetuals.perpetuals[0].ticker,
        side: 'LONG',
        size: 100,
        leverage: 2,
      });
    }
    
    await a2aInterface.sendRequest('a2a.createPost', {
      content: 'Test post',
    });
    
    // Complete simulation
    while (!engine.isComplete()) {
      engine.advanceTick();
    }
    
    const result = await engine.run();
    
    // Should have tracked all action types
    expect(result.actions.length).toBeGreaterThanOrEqual(3);
    
    const actionTypes = result.actions.map(a => a.type);
    expect(actionTypes).toContain('buy_prediction');
    expect(actionTypes).toContain('open_perp');
    expect(actionTypes).toContain('create_post');
  }, 30000);
});
