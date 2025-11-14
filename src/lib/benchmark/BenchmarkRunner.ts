/**
 * Benchmark Runner
 * 
 * Coordinates the complete benchmarking process:
 * 1. Load or generate benchmark data
 * 2. Initialize simulation engine
 * 3. Run agent through simulation
 * 4. Collect metrics and trajectory data
 * 5. Save results
 * 
 * Can run multiple agents and compare their performance.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { BenchmarkDataGenerator, type BenchmarkGameSnapshot, type BenchmarkConfig } from './BenchmarkDataGenerator';
import { SimulationEngine, type SimulationConfig, type SimulationResult } from './SimulationEngine';
import { SimulationA2AInterface } from './SimulationA2AInterface';
import { TrajectoryRecorder } from '@/lib/training/TrajectoryRecorder';
import { logger } from '@/lib/logger';
import type { IAgentRuntime } from '@elizaos/core';

export interface BenchmarkRunConfig {
  /** Path to benchmark snapshot file (or will generate new one) */
  benchmarkPath?: string;
  
  /** If no snapshot provided, use this config to generate */
  generatorConfig?: BenchmarkConfig;
  
  /** Agent runtime to test */
  agentRuntime: IAgentRuntime;
  
  /** Agent user ID */
  agentUserId: string;
  
  /** Whether to save trajectory data for RL training */
  saveTrajectory: boolean;
  
  /** Output directory for results */
  outputDir: string;
}

export interface BenchmarkComparisonResult {
  /** All individual run results */
  runs: SimulationResult[];
  
  /** Comparison metrics */
  comparison: {
    avgPnl: number;
    avgAccuracy: number;
    avgOptimality: number;
    bestRun: string;
    worstRun: string;
  };
  
  /** Trajectory data (if saved) */
  trajectories?: string[];
}

export class BenchmarkRunner {
  /**
   * Run a single benchmark
   */
  static async runSingle(config: BenchmarkRunConfig): Promise<SimulationResult> {
    logger.info('Starting benchmark run', {
      agentUserId: config.agentUserId,
      benchmarkPath: config.benchmarkPath,
    });
    
    // 1. Load or generate benchmark
    const snapshot = config.benchmarkPath
      ? await this.loadBenchmark(config.benchmarkPath)
      : await this.generateBenchmark(config.generatorConfig!);
    
    // 2. Create simulation engine
    const simConfig: SimulationConfig = {
      snapshot,
      agentId: config.agentUserId,
      fastForward: true,
      responseTimeout: 30000,
    };
    
    const engine = new SimulationEngine(simConfig);
    
    // 3. Set up A2A interface for agent
    const a2aInterface = new SimulationA2AInterface(engine, config.agentUserId);
    
    // Inject A2A interface into agent runtime
    (config.agentRuntime as any).a2aClient = a2aInterface;
    
    // 4. Set up trajectory recording if enabled
    let trajectoryRecorder: TrajectoryRecorder | undefined;
    let trajectoryId: string | undefined;
    if (config.saveTrajectory) {
      try {
        trajectoryRecorder = new TrajectoryRecorder();
        trajectoryId = await trajectoryRecorder.startTrajectory({
          agentId: config.agentUserId,
          scenarioId: `benchmark-${snapshot.id}`,
        });
        logger.info('Trajectory recording started', { trajectoryId });
      } catch (error) {
        logger.warn('Failed to start trajectory recording', { error });
        // Continue without trajectory recording
      }
    }
    
    // 5. Run simulation
    const result = await engine.run();
    
    // 6. Save trajectory if enabled
    if (trajectoryRecorder && trajectoryId) {
      try {
        await trajectoryRecorder.endTrajectory(trajectoryId, {
          finalPnL: result.metrics.totalPnl,
          finalBalance: undefined,
        });
        logger.info('Trajectory recording saved', { trajectoryId });
      } catch (error) {
        logger.warn('Failed to save trajectory recording', { error });
      }
    }
    
    // 7. Save results
    await this.saveResult(result, config.outputDir);
    
    logger.info('Benchmark run completed', {
      agentUserId: config.agentUserId,
      totalPnl: result.metrics.totalPnl,
      accuracy: result.metrics.predictionMetrics.accuracy,
      optimalityScore: result.metrics.optimalityScore,
    });
    
    return result;
  }
  
  /**
   * Run multiple benchmarks and compare
   */
  static async runMultiple(
    config: BenchmarkRunConfig,
    numRuns: number
  ): Promise<BenchmarkComparisonResult> {
    logger.info(`Running ${numRuns} benchmark iterations`, {
      agentUserId: config.agentUserId,
    });
    
    const runs: SimulationResult[] = [];
    const trajectoryPaths: string[] = [];
    
    for (let i = 0; i < numRuns; i++) {
      logger.info(`Starting run ${i + 1}/${numRuns}`);
      
      const result = await this.runSingle({
        ...config,
        outputDir: path.join(config.outputDir, `run-${i + 1}`),
      });
      
      runs.push(result);
      
      if (config.saveTrajectory) {
        trajectoryPaths.push(path.join(config.outputDir, `run-${i + 1}`, 'trajectory.json'));
      }
      
      // Small delay between runs
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    
    // Calculate comparison metrics
    const avgPnl = runs.reduce((sum, r) => sum + r.metrics.totalPnl, 0) / runs.length;
    const avgAccuracy = runs.reduce((sum, r) => sum + r.metrics.predictionMetrics.accuracy, 0) / runs.length;
    const avgOptimality = runs.reduce((sum, r) => sum + r.metrics.optimalityScore, 0) / runs.length;
    
    const bestRun = runs.reduce((best, current) =>
      current.metrics.totalPnl > best.metrics.totalPnl ? current : best
    );
    
    const worstRun = runs.reduce((worst, current) =>
      current.metrics.totalPnl < worst.metrics.totalPnl ? current : worst
    );
    
    const comparison = {
      avgPnl,
      avgAccuracy,
      avgOptimality,
      bestRun: bestRun.id,
      worstRun: worstRun.id,
    };
    
    // Save comparison report
    await this.saveComparison(
      { runs, comparison, trajectories: config.saveTrajectory ? trajectoryPaths : undefined },
      config.outputDir
    );
    
    logger.info('Multiple benchmarks completed', comparison);
    
    return { runs, comparison, trajectories: config.saveTrajectory ? trajectoryPaths : undefined };
  }
  
  /**
   * Compare two agents on same benchmark
   */
  static async compareAgents(
    agent1Config: BenchmarkRunConfig,
    agent2Config: BenchmarkRunConfig,
    benchmarkPath: string
  ): Promise<{
    agent1: SimulationResult;
    agent2: SimulationResult;
    winner: string;
    delta: {
      pnl: number;
      accuracy: number;
      optimality: number;
    };
  }> {
    logger.info('Comparing two agents', {
      agent1: agent1Config.agentUserId,
      agent2: agent2Config.agentUserId,
      benchmark: benchmarkPath,
    });
    
    // Run both agents on same benchmark
    const [result1, result2] = await Promise.all([
      this.runSingle({ ...agent1Config, benchmarkPath }),
      this.runSingle({ ...agent2Config, benchmarkPath }),
    ]);
    
    const winner = result1.metrics.totalPnl > result2.metrics.totalPnl
      ? agent1Config.agentUserId
      : agent2Config.agentUserId;
    
    const delta = {
      pnl: result1.metrics.totalPnl - result2.metrics.totalPnl,
      accuracy: result1.metrics.predictionMetrics.accuracy - result2.metrics.predictionMetrics.accuracy,
      optimality: result1.metrics.optimalityScore - result2.metrics.optimalityScore,
    };
    
    logger.info('Agent comparison completed', {
      winner,
      delta,
    });
    
    return {
      agent1: result1,
      agent2: result2,
      winner,
      delta,
    };
  }
  
  /**
   * Load benchmark from file
   */
  private static async loadBenchmark(benchmarkPath: string): Promise<BenchmarkGameSnapshot> {
    const data = await fs.readFile(benchmarkPath, 'utf-8');
    return JSON.parse(data) as BenchmarkGameSnapshot;
  }
  
  /**
   * Generate new benchmark
   */
  private static async generateBenchmark(config: BenchmarkConfig): Promise<BenchmarkGameSnapshot> {
    logger.info('Generating new benchmark', config);
    
    const generator = new BenchmarkDataGenerator(config);
    const snapshot = await generator.generate();
    
    // Save for reuse
    const outputPath = path.join(process.cwd(), 'benchmarks', `benchmark-${snapshot.id}.json`);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2));
    
    logger.info('Benchmark generated and saved', { path: outputPath });
    
    return snapshot;
  }
  
  /**
   * Save simulation result
   */
  private static async saveResult(result: SimulationResult, outputDir: string): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });
    
    // Save full result
    const resultPath = path.join(outputDir, 'result.json');
    await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
    
    // Save metrics summary
    const metricsPath = path.join(outputDir, 'metrics.json');
    await fs.writeFile(metricsPath, JSON.stringify(result.metrics, null, 2));
    
    // Save trajectory
    const trajectoryPath = path.join(outputDir, 'trajectory.json');
    await fs.writeFile(trajectoryPath, JSON.stringify(result.trajectory, null, 2));
    
    logger.debug('Results saved', { outputDir });
  }
  
  /**
   * Save comparison report
   */
  private static async saveComparison(
    comparison: BenchmarkComparisonResult,
    outputDir: string
  ): Promise<void> {
    await fs.mkdir(outputDir, { recursive: true });
    
    const comparisonPath = path.join(outputDir, 'comparison.json');
    await fs.writeFile(comparisonPath, JSON.stringify(comparison, null, 2));
    
    logger.debug('Comparison saved', { outputDir });
  }
}

