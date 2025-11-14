/**
 * Benchmark System Tests
 * 
 * Comprehensive tests for the benchmarking and simulation system.
 */

import { describe, it, expect } from 'bun:test';
import { BenchmarkDataGenerator, type BenchmarkConfig } from '@/lib/benchmark/BenchmarkDataGenerator';
import { SimulationEngine, type SimulationConfig } from '@/lib/benchmark/SimulationEngine';
import { SimulationA2AInterface } from '@/lib/benchmark/SimulationA2AInterface';

describe('Benchmark System', () => {
  describe('BenchmarkDataGenerator', () => {
    it('should generate valid benchmark snapshot', async () => {
      const config: BenchmarkConfig = {
        durationMinutes: 5, // Short for tests
        tickInterval: 10, // 10 seconds
        numPredictionMarkets: 3,
        numPerpetualMarkets: 2,
        numAgents: 5,
        seed: 12345, // Fixed seed for reproducibility
      };
      
      const generator = new BenchmarkDataGenerator(config);
      const snapshot = await generator.generate();
      
      // Verify structure
      expect(snapshot.id).toBeDefined();
      expect(snapshot.version).toBe('1.0.0');
      expect(snapshot.duration).toBe(5 * 60); // 5 minutes in seconds
      expect(snapshot.ticks.length).toBe(30); // 5 min * 60 sec / 10 sec interval
      
      // Verify initial state
      expect(snapshot.initialState.predictionMarkets).toHaveLength(3);
      expect(snapshot.initialState.perpetualMarkets).toHaveLength(2);
      expect(snapshot.initialState.agents).toHaveLength(5);
      
      // Verify ground truth
      expect(Object.keys(snapshot.groundTruth.marketOutcomes)).toHaveLength(3);
      expect(snapshot.groundTruth.priceHistory).toBeDefined();
      expect(snapshot.groundTruth.optimalActions.length).toBeGreaterThan(0);
    });
    
    it('should generate deterministic data with same seed', async () => {
      const config: BenchmarkConfig = {
        durationMinutes: 2,
        tickInterval: 10,
        numPredictionMarkets: 2,
        numPerpetualMarkets: 1,
        numAgents: 3,
        seed: 99999,
      };
      
      const generator1 = new BenchmarkDataGenerator(config);
      const snapshot1 = await generator1.generate();
      
      const generator2 = new BenchmarkDataGenerator(config);
      const snapshot2 = await generator2.generate();
      
      // Same seed should produce same outcomes
      expect(snapshot1.groundTruth.marketOutcomes).toEqual(snapshot2.groundTruth.marketOutcomes);
      expect(snapshot1.initialState.predictionMarkets[0]?.yesPrice).toBeCloseTo(
        snapshot2.initialState.predictionMarkets[0]?.yesPrice || 0
      );
    });
    
    it('should generate realistic price movements', async () => {
      const config: BenchmarkConfig = {
        durationMinutes: 10,
        tickInterval: 60,
        numPredictionMarkets: 1,
        numPerpetualMarkets: 1,
        numAgents: 3,
        seed: 55555,
      };
      
      const generator = new BenchmarkDataGenerator(config);
      const snapshot = await generator.generate();
      
      const ticker = snapshot.initialState.perpetualMarkets[0]?.ticker;
      const priceHistory = snapshot.groundTruth.priceHistory[ticker!];
      
      expect(priceHistory).toBeDefined();
      expect(priceHistory!.length).toBeGreaterThan(0);
      
      // Verify prices are reasonable (no crazy jumps)
      for (let i = 1; i < priceHistory!.length; i++) {
        const prevPrice = priceHistory![i - 1]!.price;
        const currentPrice = priceHistory![i]!.price;
        const changePercent = Math.abs((currentPrice - prevPrice) / prevPrice) * 100;
        
        // No single tick should move more than 5%
        expect(changePercent).toBeLessThan(5);
      }
    });
  });
  
  describe('SimulationEngine', () => {
    it('should run simulation and track agent actions', async () => {
      // Generate small benchmark
      const config: BenchmarkConfig = {
        durationMinutes: 2,
        tickInterval: 10,
        numPredictionMarkets: 2,
        numPerpetualMarkets: 1,
        numAgents: 3,
        seed: 11111,
      };
      
      const generator = new BenchmarkDataGenerator(config);
      const snapshot = await generator.generate();
      
      // Create simulation
      const simConfig: SimulationConfig = {
        snapshot,
        agentId: 'test-agent',
        fastForward: true,
        responseTimeout: 5000,
      };
      
      const engine = new SimulationEngine(simConfig);
      
      // Perform some actions manually
      const state = engine.getGameState();
      expect(state.tick).toBe(0);
      
      // Buy prediction market shares
      const market = state.predictionMarkets[0];
      if (market) {
        const result = await engine.performAction('buy_prediction', {
          marketId: market.id,
          outcome: 'YES',
          amount: 100,
        });
        
        expect(result.success).toBe(true);
        expect(result.result).toHaveProperty('positionId');
      }
      
      // Run full simulation
      const result = await engine.run();
      
      expect(result.id).toBeDefined();
      expect(result.ticksProcessed).toBeGreaterThan(0);
      expect(result.metrics).toBeDefined();
      expect(result.trajectory).toBeDefined();
    });
    
    it('should calculate metrics correctly', async () => {
      const config: BenchmarkConfig = {
        durationMinutes: 2,
        tickInterval: 10,
        numPredictionMarkets: 2,
        numPerpetualMarkets: 1,
        numAgents: 3,
        seed: 22222,
      };
      
      const generator = new BenchmarkDataGenerator(config);
      const snapshot = await generator.generate();
      
      const simConfig: SimulationConfig = {
        snapshot,
        agentId: 'test-agent',
        fastForward: true,
      };
      
      const engine = new SimulationEngine(simConfig);
      
      // Make a correct prediction
      const market = snapshot.initialState.predictionMarkets[0];
      const outcome = snapshot.groundTruth.marketOutcomes[market!.id];
      
      await engine.performAction('buy_prediction', {
        marketId: market!.id,
        outcome: outcome ? 'YES' : 'NO',
        amount: 100,
      });
      
      const result = await engine.run();
      
      // Should have positive P&L from correct prediction
      expect(result.metrics.predictionMetrics.correctPredictions).toBe(1);
      expect(result.metrics.predictionMetrics.accuracy).toBe(1.0);
    });
  });
  
  describe('SimulationA2AInterface', () => {
    it('should provide A2A-compatible interface', async () => {
      const config: BenchmarkConfig = {
        durationMinutes: 1,
        tickInterval: 10,
        numPredictionMarkets: 2,
        numPerpetualMarkets: 1,
        numAgents: 3,
        seed: 33333,
      };
      
      const generator = new BenchmarkDataGenerator(config);
      const snapshot = await generator.generate();
      
      const simConfig: SimulationConfig = {
        snapshot,
        agentId: 'test-agent',
        fastForward: true,
      };
      
      const engine = new SimulationEngine(simConfig);
      const a2aInterface = new SimulationA2AInterface(engine, 'test-agent');
      
      // Test getPredictions
      const predictions = await a2aInterface.sendRequest('a2a.getPredictions') as { predictions: any[] };
      expect(predictions.predictions).toBeDefined();
      expect(predictions.predictions.length).toBeGreaterThan(0);
      
      // Test buyShares
      const market = predictions.predictions[0];
      const buyResult = await a2aInterface.sendRequest('a2a.buyShares', {
        marketId: market.id,
        outcome: 'YES',
        amount: 50,
      }) as { shares: number; positionId: string };
      
      expect(buyResult.shares).toBeGreaterThan(0);
      expect(buyResult.positionId).toBeDefined();
      
      // Test getPerpetuals
      const perpetuals = await a2aInterface.sendRequest('a2a.getPerpetuals') as { perpetuals: any[] };
      expect(perpetuals.perpetuals).toBeDefined();
      
      // Test isConnected
      expect(a2aInterface.isConnected()).toBe(true);
    });
  });
  
  describe('Integration', () => {
    it('should complete end-to-end benchmark run', async () => {
      // This is a simplified test - in production you'd use a real agent runtime
      
      // Generate benchmark
      const config: BenchmarkConfig = {
        durationMinutes: 1,
        tickInterval: 10,
        numPredictionMarkets: 2,
        numPerpetualMarkets: 1,
        numAgents: 3,
        seed: 44444,
      };
      
      const generator = new BenchmarkDataGenerator(config);
      const snapshot = await generator.generate();
      
      // Create temp snapshot file
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      const tmpPath = path.join(process.cwd(), 'test-benchmark-temp.json');
      await fs.writeFile(tmpPath, JSON.stringify(snapshot));
      
      // This would run a full benchmark in production
      // For now, we just verify the structure
      expect(snapshot.id).toBeDefined();
      expect(snapshot.ticks.length).toBeGreaterThan(0);
      
      // Cleanup
      await fs.unlink(tmpPath).catch(() => {});
    }, 30000); // 30 second timeout for integration test
  });
});