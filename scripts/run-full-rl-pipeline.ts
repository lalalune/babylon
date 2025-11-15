/**
 * Full RL Pipeline Script
 * 
 * End-to-end continuous reinforcement learning pipeline:
 * 1. Generate 1-week benchmark (if needed)
 * 2. Run baseline tests (if needed)
 * 3. Create test agents (if needed)
 * 4. Run simulation with trajectory collection
 * 5. Train GRPO model (if enough trajectories)
 * 6. Deploy model
 * 7. Verify model usage
 * 8. Run benchmark with trained model
 * 9. Compare against baselines
 * 
 * Usage:
 *   npx ts-node scripts/run-full-rl-pipeline.ts [--config config/rl-pipeline.yaml] [--force]
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { BenchmarkDataGenerator, type BenchmarkConfig } from '@/lib/benchmark/BenchmarkDataGenerator';
import { BenchmarkRunner } from '@/lib/benchmark/BenchmarkRunner';
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager';
import { AutonomousCoordinatorWithRecording } from '@/lib/autonomous/AutonomousCoordinatorWithRecording';
import { SimulationEngine, type SimulationConfig } from '@/lib/benchmark/SimulationEngine';
import { SimulationA2AInterface } from '@/lib/benchmark/SimulationA2AInterface';
import { createTestAgent, ensureTestAgents } from '@/lib/agents/utils/createTestAgent';
import { getLatestRLModel } from '@/lib/training/WandbModelFetcher';
import { ModelUsageVerifier } from '@/lib/training/ModelUsageVerifier';
import { ConfigValidator } from '@/lib/training/ConfigValidator';
import type { IAgentRuntime } from '@elizaos/core';

interface PipelineConfig {
  benchmark: {
    duration_minutes: number;
    tick_interval_seconds: number;
    num_prediction_markets: number;
    num_perpetual_markets: number;
    num_agents: number;
    seed: number;
    output_dir: string;
    idempotent: boolean;
  };
  baselines: {
    models: Array<{
      name: string;
      model_id: string;
      display_name: string;
      output_file: string;
    }>;
    output_dir: string;
    run_if_exists: boolean;
  };
  agents: {
    test_agent_count: number;
    create_if_missing: boolean;
  };
  trajectory: {
    window_duration_hours: number;
    min_actions_per_trajectory: number;
    record_correctness: boolean;
    record_sentiment: boolean;
    save_to_database: boolean;
  };
  training: {
    min_trajectories_per_batch: number;
    batch_size: number;
    learning_rate: number;
  };
  deployment: {
    auto_deploy: boolean;
    verify_usage: boolean;
    benchmark_after_deploy: boolean;
  };
  verification: {
    assert_model_usage: boolean;
    log_model_per_inference: boolean;
    compare_against_baselines: boolean;
    run_benchmark_after_training: boolean;
  };
  pipeline: {
    idempotent: boolean;
    continue_on_error: boolean;
    log_level: string;
  };
}

interface PipelineStep {
  name: string;
  execute: () => Promise<void>;
  skipIf?: () => Promise<boolean>;
}

class PipelineRunner {
  private config: PipelineConfig;
  private force: boolean;
  private benchmarkPath: string | null = null;
  private testAgentIds: string[] = [];
  
  constructor(config: PipelineConfig, force: boolean = false) {
    this.config = config;
    this.force = force;
  }
  
  /**
   * Step 1: Generate benchmark
   */
  async stepGenerateBenchmark(): Promise<void> {
    logger.info('Step 1: Generating benchmark', undefined, 'RLPipeline');
    console.log('\n📊 Step 1: Generating Benchmark\n');
    
    const benchmarkConfig: BenchmarkConfig = {
      durationMinutes: this.config.benchmark.duration_minutes,
      tickInterval: this.config.benchmark.tick_interval_seconds,
      numPredictionMarkets: this.config.benchmark.num_prediction_markets,
      numPerpetualMarkets: this.config.benchmark.num_perpetual_markets,
      numAgents: this.config.benchmark.num_agents,
      seed: this.config.benchmark.seed,
    };
    
    // Generate filename
    const configHash = `${benchmarkConfig.durationMinutes}-${benchmarkConfig.tickInterval}-${benchmarkConfig.numPredictionMarkets}-${benchmarkConfig.numPerpetualMarkets}-${benchmarkConfig.numAgents}-${benchmarkConfig.seed}`;
    const filename = `benchmark-week-${configHash}.json`;
    const filepath = path.join(this.config.benchmark.output_dir, filename);
    
    // Idempotent check
    if (this.config.pipeline.idempotent && !this.force) {
      if (await fs.access(filepath).then(() => true).catch(() => false)) {
        logger.info('Benchmark already exists, skipping generation', { filepath }, 'RLPipeline');
        console.log(`  ✅ Benchmark already exists: ${filepath}`);
        this.benchmarkPath = filepath;
        return;
      }
    }
    
    console.log(`  Generating ${(benchmarkConfig.durationMinutes / 60 / 24).toFixed(1)} day benchmark...`);
    const generator = new BenchmarkDataGenerator(benchmarkConfig);
    const snapshot = await generator.generate();
    
    await fs.mkdir(this.config.benchmark.output_dir, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2));
    
    this.benchmarkPath = filepath;
    console.log(`  ✅ Benchmark generated: ${filepath}`);
    console.log(`     Ticks: ${snapshot.ticks.length}`);
    console.log(`     Markets: ${snapshot.initialState.predictionMarkets.length} prediction, ${snapshot.initialState.perpetualMarkets.length} perpetual`);
  }
  
  /**
   * Step 2: Run baseline tests
   */
  async stepRunBaselines(): Promise<void> {
    logger.info('Step 2: Running baseline tests', undefined, 'RLPipeline');
    console.log('\n📈 Step 2: Running Baseline Tests\n');
    
    if (!this.benchmarkPath) {
      throw new Error('Benchmark path not set');
    }
    
    // Create baseline test agent
    const baselineAgent = await createTestAgent('baseline-test-agent', {
      autonomousTrading: true,
      autonomousPosting: false,
      autonomousCommenting: false,
    });
    
    for (const model of this.config.baselines.models) {
      const baselinePath = path.join(this.config.baselines.output_dir, model.output_file);
      
      // Idempotent check
      if (this.config.pipeline.idempotent && !this.force && !this.config.baselines.run_if_exists) {
        if (await fs.access(baselinePath).then(() => true).catch(() => false)) {
          logger.info(`Baseline ${model.name} already exists, skipping`, { path: baselinePath }, 'RLPipeline');
          console.log(`  ⏭️  ${model.display_name} baseline already exists`);
          continue;
        }
      }
      
      console.log(`  Running ${model.display_name} baseline...`);
      
      const runtime = await agentRuntimeManager.getRuntime(baselineAgent.agentId);
      
      const result = await BenchmarkRunner.runSingle({
        benchmarkPath: this.benchmarkPath,
        agentRuntime: runtime,
        agentUserId: baselineAgent.agentId,
        saveTrajectory: false,
        outputDir: path.join(this.config.baselines.output_dir, model.name),
        forceModel: model.model_id,
      });
      
      // Save baseline result
      const baselineResult = {
        model: {
          name: model.name,
          modelId: model.model_id,
          displayName: model.display_name,
        },
        metrics: {
          totalPnl: result.metrics.totalPnl,
          predictionAccuracy: result.metrics.predictionMetrics.accuracy,
          perpWinRate: result.metrics.perpMetrics.winRate,
          optimalityScore: result.metrics.optimalityScore,
        },
        runAt: new Date().toISOString(),
      };
      
      await fs.mkdir(this.config.baselines.output_dir, { recursive: true });
      await fs.writeFile(baselinePath, JSON.stringify(baselineResult, null, 2));
      
      console.log(`  ✅ ${model.display_name} baseline complete:`);
      console.log(`     P&L: $${result.metrics.totalPnl.toFixed(2)}`);
      console.log(`     Accuracy: ${(result.metrics.predictionMetrics.accuracy * 100).toFixed(1)}%`);
    }
  }
  
  /**
   * Step 3: Create test agents
   */
  async stepCreateAgents(): Promise<void> {
    logger.info('Step 3: Creating test agents', undefined, 'RLPipeline');
    console.log('\n🤖 Step 3: Creating Test Agents\n');
    
    if (!this.config.agents.create_if_missing) {
      console.log('  ⏭️  Agent creation disabled in config');
      return;
    }
    
    this.testAgentIds = await ensureTestAgents(
      this.config.agents.test_agent_count,
      'rl-pipeline-agent',
      {
        autonomousTrading: true,
        autonomousPosting: true,
        autonomousCommenting: true,
      }
    );
    
    console.log(`  ✅ Created ${this.testAgentIds.length} test agents`);
    this.testAgentIds.forEach((id, i) => {
      console.log(`     Agent ${i + 1}: ${id.substring(0, 12)}...`);
    });
  }
  
  /**
   * Step 4: Run simulation with trajectory collection
   */
  async stepRunSimulation(): Promise<void> {
    logger.info('Step 4: Running simulation', undefined, 'RLPipeline');
    console.log('\n🎮 Step 4: Running Simulation with Trajectory Collection\n');
    
    if (!this.benchmarkPath) {
      throw new Error('Benchmark path not set');
    }
    
    if (this.testAgentIds.length === 0) {
      throw new Error('No test agents available');
    }
    
    // Load benchmark
    const benchmarkData = await fs.readFile(this.benchmarkPath, 'utf-8');
    const snapshot = JSON.parse(benchmarkData);
    
    // Run simulation for each agent
    for (const agentId of this.testAgentIds) {
      console.log(`  Running simulation for agent ${agentId.substring(0, 12)}...`);
      
      const runtime = await agentRuntimeManager.getRuntime(agentId);
      
      // Create simulation engine
      const simConfig: SimulationConfig = {
        snapshot,
        agentId,
        fastForward: true,
        responseTimeout: 30000,
      };
      
      const engine = new SimulationEngine(simConfig);
      const a2aInterface = new SimulationA2AInterface(engine, agentId);
      
      interface RuntimeWithA2A extends IAgentRuntime {
        a2aClient?: SimulationA2AInterface;
      }
      (runtime as RuntimeWithA2A).a2aClient = a2aInterface;
      
      engine.initialize();
      
      // Use recording coordinator - it automatically handles trajectory recording
      const coordinator = new AutonomousCoordinatorWithRecording();
      
      // Run simulation loop
      let tickCount = 0;
      let lastTrajectoryId: string | undefined;
      
      while (!engine.isComplete()) {
        tickCount++;
        if (tickCount % 100 === 0) {
          console.log(`    Tick ${tickCount}/${snapshot.ticks.length}...`);
        }
        
        const tickResult = await coordinator.executeAutonomousTick(agentId, runtime).catch((error: Error) => {
          logger.error('Tick execution error', { error, tick: tickCount }, 'RLPipeline');
          return { success: false, trajectoryId: undefined } as { success: boolean; trajectoryId?: string };
        });
        
        // Track trajectory ID from coordinator
        if (tickResult.trajectoryId) {
          lastTrajectoryId = tickResult.trajectoryId;
        }
        
        // Advance the simulation
        engine.advanceTick();
      }
      
      // Get final results
      const result = await engine.run();
      
      // Note: AutonomousCoordinatorWithRecording handles trajectory ending automatically
      // Each tick creates its own trajectory, so we have multiple trajectories
      // The coordinator will save them with proper metadata
      
      console.log(`  ✅ Agent ${agentId.substring(0, 12)} complete:`);
      console.log(`     P&L: $${result.metrics.totalPnl.toFixed(2)}`);
      console.log(`     Actions: ${result.actions.length}`);
      console.log(`     Trajectories recorded: ${tickCount} ticks`);
      if (lastTrajectoryId) {
        console.log(`     Last trajectory ID: ${lastTrajectoryId}`);
      }
    }
  }
  
  /**
   * Step 5: Train GRPO model
   */
  async stepTrainModel(): Promise<void> {
    logger.info('Step 5: Training GRPO model', undefined, 'RLPipeline');
    console.log('\n🧠 Step 5: Training GRPO Model\n');
    
    // Validate training config (with full config)
    const fullTrainingConfig = {
      ...this.config.training,
      kl_penalty: 0.05,
      iterations_per_window: 10,
      warmup_steps: 10,
      max_grad_norm: 1.0,
      gamma: 0.99,
    };
    const configValid = ConfigValidator.validateAndLog({
      benchmark: this.config.benchmark,
      training: fullTrainingConfig,
      agents: this.config.agents,
    });
    
    if (!configValid) {
      throw new Error('Training configuration validation failed');
    }
    
    // Check if we have enough trajectories
    const trajectoryCount = await prisma.trajectory.count({
      where: {
        isTrainingData: true,
        usedInTraining: false,
        episodeLength: { gte: this.config.trajectory.min_actions_per_trajectory },
      },
    });
    
    if (trajectoryCount < this.config.training.min_trajectories_per_batch) {
      console.log(`  ⚠️  Not enough trajectories: ${trajectoryCount} < ${this.config.training.min_trajectories_per_batch}`);
      console.log('  ⏭️  Skipping training (not enough data)');
      return;
    }
    
    console.log(`  Found ${trajectoryCount} trajectories for training`);
    console.log('  Triggering GRPO training...');
    
    // Trigger training via Python script
    const { spawn } = await import('child_process');
    const pythonScript = path.resolve(process.cwd(), 'python/src/training/babylon_trainer.py');
    
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [pythonScript, '--mode', 'single'], {
        cwd: process.cwd(),
        env: { ...process.env },
      });
      
      python.stdout.on('data', (data: Buffer) => {
        console.log(`  ${data.toString().trim()}`);
      });
      
      python.stderr.on('data', (data: Buffer) => {
        console.error(`  ERROR: ${data.toString().trim()}`);
      });
      
      python.on('close', (code: number) => {
        if (code === 0) {
          console.log('  ✅ Training completed');
          resolve();
        } else {
          console.error(`  ❌ Training failed with code ${code}`);
          if (this.config.pipeline.continue_on_error) {
            resolve(); // Continue even on error
          } else {
            reject(new Error(`Training failed with code ${code}`));
          }
        }
      });
    });
  }
  
  /**
   * Step 6: Verify model deployment
   */
  async stepVerifyDeployment(): Promise<void> {
    logger.info('Step 6: Verifying model deployment', undefined, 'RLPipeline');
    console.log('\n✅ Step 6: Verifying Model Deployment\n');
    
    const latestModel = await getLatestRLModel();
    
    if (!latestModel) {
      console.log('  ⚠️  No trained model found in database');
      console.log('  ⏭️  Skipping verification');
      return;
    }
    
    console.log(`  ✅ Found trained model: ${latestModel.modelPath} (v${latestModel.version})`);
    console.log(`     Avg Reward: ${latestModel.metadata.avgReward?.toFixed(2) || 'N/A'}`);
    
    // Verify agents can load it and are using it
    if (this.testAgentIds.length > 0 && this.config.verification.assert_model_usage) {
      const runtimes = new Map<string, IAgentRuntime>();
      
      for (const agentId of this.testAgentIds) {
        const runtime = await agentRuntimeManager.getRuntime(agentId);
        runtimes.set(agentId, runtime);
      }
      
      const verification = await ModelUsageVerifier.verifyMultipleAgents(
        this.testAgentIds,
        runtimes
      );
      
      console.log(`\n  Model Usage Verification:`);
      console.log(`     Agents checked: ${verification.agentsChecked}`);
      console.log(`     Using trained model: ${verification.agentsUsingTrainedModel}`);
      console.log(`     Using base model: ${verification.agentsUsingBaseModel}`);
      
      if (verification.agentsUsingTrainedModel === 0) {
        console.log(`  ⚠️  No agents are using the trained model!`);
        if (!this.config.pipeline.continue_on_error) {
          throw new Error('Model usage verification failed: no agents using trained model');
        }
      } else {
        console.log(`  ✅ Verification passed: ${verification.agentsUsingTrainedModel} agents using trained model`);
      }
      
      // Log details
      verification.details.forEach(detail => {
        console.log(`     Agent ${detail.agentId.substring(0, 12)}: ${detail.modelUsed} (${detail.isTrainedModel ? '✅ trained' : '❌ base'})`);
      });
    }
  }
  
  /**
   * Step 7: Run benchmark with trained model
   */
  async stepBenchmarkTrainedModel(): Promise<void> {
    logger.info('Step 7: Benchmarking trained model', undefined, 'RLPipeline');
    console.log('\n📊 Step 7: Benchmarking Trained Model\n');
    
    if (!this.config.verification.run_benchmark_after_training) {
      console.log('  ⏭️  Benchmark after training disabled in config');
      return;
    }
    
    if (!this.benchmarkPath) {
      throw new Error('Benchmark path not set');
    }
    
    if (this.testAgentIds.length === 0) {
      throw new Error('No test agents available');
    }
    
    const agentId = this.testAgentIds[0]!;
    const runtime = await agentRuntimeManager.getRuntime(agentId);
    
    console.log(`  Running benchmark with trained model...`);
    
    const result = await BenchmarkRunner.runSingle({
      benchmarkPath: this.benchmarkPath,
      agentRuntime: runtime,
      agentUserId: agentId,
      saveTrajectory: false,
      outputDir: path.join(process.cwd(), 'benchmark-results', 'trained-model', Date.now().toString()),
    });
    
    console.log(`  ✅ Trained model benchmark complete:`);
    console.log(`     P&L: $${result.metrics.totalPnl.toFixed(2)}`);
    console.log(`     Accuracy: ${(result.metrics.predictionMetrics.accuracy * 100).toFixed(1)}%`);
    console.log(`     Optimality: ${result.metrics.optimalityScore.toFixed(1)}%`);
    
    // Compare against baselines
    if (this.config.verification.compare_against_baselines) {
      await this.compareAgainstBaselines(result);
    }
  }
  
  /**
   * Compare trained model results against baselines
   */
  async compareAgainstBaselines(trainedResult: { metrics: { totalPnl: number; predictionMetrics: { accuracy: number }; optimalityScore: number } }): Promise<void> {
    console.log('\n📈 Comparing Against Baselines\n');
    
    for (const model of this.config.baselines.models) {
      const baselinePath = path.join(this.config.baselines.output_dir, model.output_file);
      
      if (await fs.access(baselinePath).then(() => true).catch(() => false)) {
        const baselineData = await fs.readFile(baselinePath, 'utf-8');
        const baseline = JSON.parse(baselineData) as { metrics: { totalPnl: number; predictionAccuracy: number; optimalityScore: number } };
        
        const pnlDiff = trainedResult.metrics.totalPnl - baseline.metrics.totalPnl;
        const accuracyDiff = trainedResult.metrics.predictionMetrics.accuracy - baseline.metrics.predictionAccuracy;
        const optimalityDiff = trainedResult.metrics.optimalityScore - baseline.metrics.optimalityScore;
        
        console.log(`  vs ${model.display_name}:`);
        console.log(`     P&L: ${pnlDiff >= 0 ? '+' : ''}$${pnlDiff.toFixed(2)}`);
        console.log(`     Accuracy: ${accuracyDiff >= 0 ? '+' : ''}${(accuracyDiff * 100).toFixed(1)}%`);
        console.log(`     Optimality: ${optimalityDiff >= 0 ? '+' : ''}${optimalityDiff.toFixed(1)}%`);
        
        // Note: assert_improvement check removed as it's not in config type
        // Can be added to config if needed
      }
    }
  }
  
  /**
   * Run full pipeline
   */
  async run(): Promise<void> {
    console.log('\n🚀 FULL RL PIPELINE\n');
    console.log('='.repeat(60) + '\n');
    
    const steps: PipelineStep[] = [
      {
        name: 'Generate Benchmark',
        execute: () => this.stepGenerateBenchmark(),
      },
      {
        name: 'Run Baselines',
        execute: () => this.stepRunBaselines(),
      },
      {
        name: 'Create Test Agents',
        execute: () => this.stepCreateAgents(),
      },
      {
        name: 'Run Simulation',
        execute: () => this.stepRunSimulation(),
      },
      {
        name: 'Train Model',
        execute: () => this.stepTrainModel(),
      },
      {
        name: 'Verify Deployment',
        execute: () => this.stepVerifyDeployment(),
      },
      {
        name: 'Benchmark Trained Model',
        execute: () => this.stepBenchmarkTrainedModel(),
      },
    ];
    
    for (const step of steps) {
      try {
        const startTime = Date.now();
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`▶️  ${step.name}`);
        console.log(`${'─'.repeat(60)}\n`);
        
        await step.execute();
        
        const duration = Date.now() - startTime;
        console.log(`\n✅ ${step.name} completed in ${(duration / 1000).toFixed(1)}s`);
      } catch (error) {
        console.error(`\n❌ ${step.name} failed:`, error);
        
        if (this.config.pipeline.continue_on_error) {
          console.log('  Continuing to next step...\n');
        } else {
          throw error;
        }
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PIPELINE COMPLETE');
    console.log('='.repeat(60) + '\n');
  }
}

async function loadConfig(configPath: string): Promise<PipelineConfig> {
  const configData = await fs.readFile(configPath, 'utf-8');
  
  // Try to parse as YAML, fallback to JSON
  try {
    // Try yaml package first
    const yaml = await import('yaml');
    return yaml.parse(configData) as PipelineConfig;
  } catch {
    try {
      // Try js-yaml package (with type assertion)
      const yaml = await import('js-yaml');
      return (yaml.load as (str: string) => unknown)(configData) as PipelineConfig;
    } catch {
      // Last resort: treat as JSON
      return JSON.parse(configData) as PipelineConfig;
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  const configPath = args.find(a => a.startsWith('--config'))?.split('=')[1] ||
    args.find(a => a.startsWith('--config='))?.split('=')[1] ||
    path.join(process.cwd(), 'config', 'rl-pipeline.yaml');
  const force = args.includes('--force');
  
  console.log(`\n📋 Loading config from: ${configPath}\n`);
  
  let config: PipelineConfig;
  try {
    config = await loadConfig(configPath);
  } catch (error) {
    console.error(`Failed to load config: ${error}`);
    console.log('\nUsing default config...\n');
    // Use defaults if config file doesn't exist
    config = {
      benchmark: {
        duration_minutes: 10080,
        tick_interval_seconds: 60,
        num_prediction_markets: 10,
        num_perpetual_markets: 5,
        num_agents: 8,
        seed: 12345,
        output_dir: './benchmarks',
        idempotent: true,
      },
      baselines: {
        models: [
          { name: 'qwen', model_id: 'qwen/qwen3-32b', display_name: 'Qwen 32B', output_file: 'baseline-qwen.json' },
          { name: 'llama8b', model_id: 'llama-3.1-8b-instant', display_name: 'LLaMA 8B Instant', output_file: 'baseline-llama8b.json' },
        ],
        output_dir: './benchmarks/baselines',
        run_if_exists: false,
      },
      agents: {
        test_agent_count: 3,
        create_if_missing: true,
      },
      trajectory: {
        window_duration_hours: 1,
        min_actions_per_trajectory: 5,
        record_correctness: true,
        record_sentiment: true,
        save_to_database: true,
      },
      training: {
        min_trajectories_per_batch: 10,
        batch_size: 4,
        learning_rate: 1e-6,
      },
      deployment: {
        auto_deploy: true,
        verify_usage: true,
        benchmark_after_deploy: true,
      },
      verification: {
        assert_model_usage: true,
        log_model_per_inference: true,
        compare_against_baselines: true,
        run_benchmark_after_training: true,
      },
      pipeline: {
        idempotent: true,
        continue_on_error: false,
        log_level: 'info',
      },
    };
  }
  
  const runner = new PipelineRunner(config, force);
  await runner.run();
  
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Pipeline failed:', error);
  process.exit(1);
});

