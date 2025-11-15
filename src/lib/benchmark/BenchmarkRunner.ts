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
  
  /** Force specific model (bypasses W&B lookup) - for baseline testing */
  forceModel?: string;
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
    interface RuntimeWithA2A extends IAgentRuntime {
      a2aClient?: SimulationA2AInterface;
    }
    (config.agentRuntime as RuntimeWithA2A).a2aClient = a2aInterface;
    
    // Force model if specified (for baseline testing)
    if (config.forceModel) {
      logger.info('Forcing model for benchmark', { 
        agentUserId: config.agentUserId,
        forcedModel: config.forceModel 
      });
      
      // Set model in runtime settings to bypass W&B lookup
      const runtime = config.agentRuntime as RuntimeWithA2A & { 
        character?: { settings?: Record<string, string> };
        getSetting?: (key: string) => string | undefined;
        setSetting?: (key: string, value: string) => void;
      };
      
      // Determine if it's a Groq model or W&B model
      const isGroqModel = config.forceModel.includes('qwen') || config.forceModel.includes('llama');
      
      if (runtime.character?.settings) {
        if (isGroqModel) {
          // Force Groq model by disabling W&B
          runtime.character.settings.WANDB_ENABLED = 'false';
          runtime.character.settings.LARGE_GROQ_MODEL = config.forceModel;
          runtime.character.settings.SMALL_GROQ_MODEL = config.forceModel;
        } else {
          // Force W&B model
          runtime.character.settings.WANDB_ENABLED = 'true';
          runtime.character.settings.WANDB_MODEL = config.forceModel;
        }
      }
      
      // Also set via setSetting if available
      if (runtime.setSetting) {
        if (isGroqModel) {
          runtime.setSetting('WANDB_ENABLED', 'false');
          runtime.setSetting('LARGE_GROQ_MODEL', config.forceModel);
          runtime.setSetting('SMALL_GROQ_MODEL', config.forceModel);
        } else {
          runtime.setSetting('WANDB_ENABLED', 'true');
          runtime.setSetting('WANDB_MODEL', config.forceModel);
        }
      }
    }
    
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
    
    // 5. Initialize simulation
    engine.initialize();
    
    // 6. Run simulation loop
    logger.info('Starting simulation loop', {
      agentUserId: config.agentUserId,
      totalTicks: snapshot.ticks.length,
    });
    
    // Import AutonomousCoordinator for running agent ticks
    const { AutonomousCoordinator } = await import('@/lib/agents/autonomous/AutonomousCoordinator');
    const coordinator = new AutonomousCoordinator();
    
    // Run autonomous ticks for each simulation tick
    let ticksCompleted = 0;
    while (!engine.isComplete()) {
      const currentTick = engine.getCurrentTickNumber();
      
      if (currentTick % 100 === 0 || currentTick < 5) {
        logger.info(`Benchmark progress: ${currentTick}/${snapshot.ticks.length} ticks`, {
          agentUserId: config.agentUserId,
        });
      }
      
      // Execute autonomous tick (agent makes decisions via A2A)
      const tickResult = await coordinator.executeAutonomousTick(
        config.agentUserId,
        config.agentRuntime
      ).catch((error: Error) => {
        logger.error('Tick execution error', { error, tick: currentTick });
        return { success: false, actionsExecuted: {}, duration: 0, method: 'error' };
      });
      
      if (tickResult.success && tickResult.actionsExecuted && 'trades' in tickResult.actionsExecuted && (tickResult.actionsExecuted.trades > 0 || tickResult.actionsExecuted.posts > 0)) {
        logger.debug('Agent took actions', {
          tick: currentTick,
          actions: tickResult.actionsExecuted,
        });
      }
      
      // Advance simulation tick
      engine.advanceTick();
      ticksCompleted++;
      
      // Small delay to avoid overwhelming the system (can be made faster)
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    logger.info('Simulation loop complete', {
      agentUserId: config.agentUserId,
      ticksCompleted,
      totalTicks: snapshot.ticks.length,
    });
    
    // 7. Calculate final results
    const result = await engine.run();
    
    // 8. Validate results - ensure agent actually did something
    if (result.ticksProcessed === 0) {
      throw new Error('Benchmark failed: No ticks were processed');
    }
    
    if (result.actions.length === 0) {
      logger.warn('Benchmark completed but agent took no actions', {
        agentUserId: config.agentUserId,
        ticksProcessed: result.ticksProcessed,
      });
    }
    
    // 9. Save trajectory if enabled
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
    
    // 10. Save results
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

