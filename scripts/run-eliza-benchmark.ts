/**
 * Run Eliza Agent Through Benchmark
 * 
 * Runs an Eliza agent through a benchmark simulation using the A2A interface.
 * The agent will connect via A2A and interact with the simulated game.
 * 
 * Usage:
 *   npx ts-node scripts/run-eliza-benchmark.ts \
 *     --benchmark=benchmarks/benchmark-123.json \
 *     --agent-id=agent-user-id \
 *     --runs=5 \
 *     --output=results/eliza-agent
 */

import { BenchmarkDataGenerator, type BenchmarkConfig } from '@/lib/benchmark/BenchmarkDataGenerator';
import { SimulationEngine, type SimulationConfig, type SimulationResult } from '@/lib/benchmark/SimulationEngine';
import { SimulationA2AInterface } from '@/lib/benchmark/SimulationA2AInterface';
import { MetricsVisualizer } from '@/lib/benchmark/MetricsVisualizer';
import { AutonomousCoordinator } from '@/lib/agents/autonomous/AutonomousCoordinator';
// @ts-expect-error - initializeAgentRuntime may not be exported yet
import { initializeAgentRuntime } from '@/lib/agents/plugins/babylon/integration';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import * as path from 'path';
import { promises as fs } from 'fs';

interface ElizaBenchmarkConfig {
  benchmarkPath?: string;
  generatorConfig?: BenchmarkConfig;
  agentUserId: string;
  runs: number;
  outputDir: string;
  tickInterval?: number; // How often to run autonomous tick (ms)
}

async function loadBenchmark(benchmarkPath: string) {
  const data = await fs.readFile(benchmarkPath, 'utf-8');
  const snapshot = JSON.parse(data);
  
  // Validate benchmark data
  const { BenchmarkValidator } = await import('@/lib/benchmark/BenchmarkValidator');
  const validator: typeof BenchmarkValidator = BenchmarkValidator;
  validator.validateOrThrow(snapshot);
  
  return snapshot;
}

async function generateBenchmark(config: BenchmarkConfig) {
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

async function runElizaBenchmark(config: ElizaBenchmarkConfig): Promise<SimulationResult> {
  logger.info('Starting Eliza agent benchmark', {
    agentUserId: config.agentUserId,
    benchmarkPath: config.benchmarkPath,
  });
  
  // 1. Load or generate benchmark
  const snapshot = config.benchmarkPath
    ? await loadBenchmark(config.benchmarkPath)
    : await generateBenchmark(config.generatorConfig!);
  
  // 2. Get agent from database
  const agent = await prisma.user.findUnique({
    where: { id: config.agentUserId },
    select: {
      id: true,
      username: true,
      isAgent: true,
      autonomousTrading: true,
      autonomousPosting: true,
      autonomousCommenting: true,
    },
  });
  
  if (!agent || !agent.isAgent) {
    throw new Error(`Agent ${config.agentUserId} not found or not an agent`);
  }
  
  logger.info('Found agent', { username: agent.username });
  
  // 3. Initialize Eliza runtime for agent
  const runtime = await initializeAgentRuntime(config.agentUserId);
  
  // 4. Create simulation engine
  const simConfig: SimulationConfig = {
    snapshot,
    agentId: config.agentUserId,
    fastForward: true,
    responseTimeout: 30000,
  };
  
  const engine = new SimulationEngine(simConfig);
  
  // 5. Create A2A interface and inject into runtime
  const a2aInterface = new SimulationA2AInterface(engine, config.agentUserId);
  (runtime as any).a2aClient = a2aInterface;
  
  logger.info('Runtime and A2A interface initialized');
  
  // 6. Initialize simulation
  engine.initialize();
  
  // 7. Create autonomous coordinator
  const coordinator = new AutonomousCoordinator();
  
  // 8. Run simulation with autonomous ticks
  const tickInterval = config.tickInterval || 5000; // 5 seconds default
  
  logger.info('Starting simulation loop', { 
    totalTicks: snapshot.ticks.length,
    tickInterval,
  });
  
  // Run autonomous ticks for each simulation tick
  while (!engine.isComplete()) {
    const currentTick = engine.getGameState().tick;
    
    logger.info(`Autonomous tick ${currentTick + 1}/${snapshot.ticks.length}`);
    
    // Execute autonomous tick (agent makes decisions via A2A)
    await coordinator.executeAutonomousTick(
      config.agentUserId,
      runtime
    ).then((tickResult) => {
      logger.info('Tick result', {
        success: tickResult.success,
        actionsExecuted: tickResult.actionsExecuted,
        method: tickResult.method,
      });
    }).catch((error: Error) => {
      logger.error('Tick execution error', { error, tick: currentTick });
      // Continue to next tick even if this one failed
    });
    
    // Advance simulation tick
    engine.advanceTick();
    
    // Small delay between ticks for rate limiting
    if (tickInterval > 0) {
      await new Promise(resolve => setTimeout(resolve, tickInterval));
    }
  }
  
  logger.info('Simulation loop complete', {
    totalTicks: snapshot.ticks.length,
  });
  
  // 9. Calculate final results
  const result = await engine.run();
  
  // 10. Save results
  await fs.mkdir(config.outputDir, { recursive: true });
  
  const resultPath = path.join(config.outputDir, 'result.json');
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2));
  
  const metricsPath = path.join(config.outputDir, 'metrics.json');
  await fs.writeFile(metricsPath, JSON.stringify(result.metrics, null, 2));
  
  // Save actions log
  const actionsPath = path.join(config.outputDir, 'actions.json');
  await fs.writeFile(actionsPath, JSON.stringify(result.actions, null, 2));
  
  logger.info('Eliza benchmark completed', {
    agentUserId: config.agentUserId,
    totalPnl: result.metrics.totalPnl,
    accuracy: result.metrics.predictionMetrics.accuracy,
    optimalityScore: result.metrics.optimalityScore,
  });
  
  return result;
}

async function runMultiple(config: ElizaBenchmarkConfig) {
  logger.info(`Running ${config.runs} benchmark iterations`);
  
  const runs: SimulationResult[] = [];
  
  for (let i = 0; i < config.runs; i++) {
    logger.info(`Starting run ${i + 1}/${config.runs}`);
    
    const result = await runElizaBenchmark({
      ...config,
      outputDir: path.join(config.outputDir, `run-${i + 1}`),
    });
    
    runs.push(result);
    
    // Delay between runs
    await new Promise(resolve => setTimeout(resolve, 2000));
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
    runs,
    comparison: {
      avgPnl,
      avgAccuracy,
      avgOptimality,
      bestRun: bestRun.id,
      worstRun: worstRun.id,
    },
  };
  
  // Save comparison
  const comparisonPath = path.join(config.outputDir, 'comparison.json');
  await fs.writeFile(comparisonPath, JSON.stringify(comparison, null, 2));
  
  // Generate visualizations
  await MetricsVisualizer.visualizeComparison(comparison, {
    outputDir: config.outputDir,
    generateHtml: true,
    generateCsv: true,
    generateCharts: false,
  });
  
  logger.info('Multiple benchmarks completed', comparison.comparison);
  
  return comparison;
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const benchmarkPath = args.find(a => a.startsWith('--benchmark='))?.split('=')[1];
  const agentId = args.find(a => a.startsWith('--agent-id='))?.split('=')[1];
  const numRuns = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1] || '1');
  const outputDir = args.find(a => a.startsWith('--output='))?.split('=')[1] || 
    path.join(process.cwd(), 'benchmark-results', 'eliza', `${Date.now()}`);
  const tickInterval = parseInt(args.find(a => a.startsWith('--tick-interval='))?.split('=')[1] || '5000');
  
  // Generation params (if no benchmark provided)
  const duration = parseInt(args.find(a => a.startsWith('--duration='))?.split('=')[1] || '5');
  const interval = parseInt(args.find(a => a.startsWith('--interval='))?.split('=')[1] || '60');
  const markets = parseInt(args.find(a => a.startsWith('--markets='))?.split('=')[1] || '5');
  const perpetuals = parseInt(args.find(a => a.startsWith('--perpetuals='))?.split('=')[1] || '3');
  const agents = parseInt(args.find(a => a.startsWith('--agents='))?.split('=')[1] || '8');
  const seed = parseInt(args.find(a => a.startsWith('--seed='))?.split('=')[1] || '') || Date.now();
  
  if (!agentId) {
    console.error('Error: --agent-id is required');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/run-eliza-benchmark.ts --agent-id=user-123 [options]');
    console.log('\nOptions:');
    console.log('  --benchmark=path/to/benchmark.json  Use existing benchmark');
    console.log('  --runs=5                             Number of runs (default: 1)');
    console.log('  --output=path/to/results             Output directory');
    console.log('  --tick-interval=5000                 Ms between autonomous ticks (default: 5000)');
    console.log('\nGeneration options (if no benchmark):');
    console.log('  --duration=5                         Minutes (default: 5)');
    console.log('  --interval=60                        Seconds between ticks (default: 60)');
    console.log('  --markets=5                          Number of prediction markets');
    console.log('  --perpetuals=3                       Number of perpetual markets');
    console.log('  --agents=8                           Number of other agents');
    console.log('  --seed=12345                         Random seed for reproducibility');
    process.exit(1);
  }
  
  const config: ElizaBenchmarkConfig = {
    benchmarkPath,
    generatorConfig: benchmarkPath ? undefined : {
      durationMinutes: duration,
      tickInterval: interval,
      numPredictionMarkets: markets,
      numPerpetualMarkets: perpetuals,
      numAgents: agents,
      seed,
    },
    agentUserId: agentId,
    runs: numRuns,
    outputDir,
    tickInterval,
  };
  
  if (numRuns === 1) {
    // Single run
    console.log('\n🚀 Running single Eliza benchmark...\n');
    const result = await runElizaBenchmark(config);
    
    // Generate visualizations
    await MetricsVisualizer.visualizeSingleRun(result, {
      outputDir,
      generateHtml: true,
      generateCsv: true,
      generateCharts: false,
    });
    
    console.log('\n✅ Benchmark Complete!\n');
    console.log('Results:');
    console.log(`  Total P&L: $${result.metrics.totalPnl.toFixed(2)}`);
    console.log(`  Prediction Accuracy: ${(result.metrics.predictionMetrics.accuracy * 100).toFixed(1)}%`);
    console.log(`  Perp Win Rate: ${(result.metrics.perpMetrics.winRate * 100).toFixed(1)}%`);
    console.log(`  Optimality Score: ${result.metrics.optimalityScore.toFixed(1)}%`);
    console.log(`  Duration: ${(result.metrics.timing.totalDuration / 1000).toFixed(1)}s`);
    console.log(`\nReports saved to: ${outputDir}`);
    console.log(`View report: file://${path.join(outputDir, 'index.html')}`);
    
  } else {
    // Multiple runs
    console.log(`\n🚀 Running ${numRuns} Eliza benchmarks...\n`);
    const comparison = await runMultiple(config);
    
    console.log('\n✅ All Benchmarks Complete!\n');
    console.log('Summary:');
    console.log(`  Runs: ${comparison.runs.length}`);
    console.log(`  Avg P&L: $${comparison.comparison.avgPnl.toFixed(2)}`);
    console.log(`  Avg Accuracy: ${(comparison.comparison.avgAccuracy * 100).toFixed(1)}%`);
    console.log(`  Avg Optimality: ${comparison.comparison.avgOptimality.toFixed(1)}%`);
    console.log(`  Best Run: ${comparison.comparison.bestRun}`);
    console.log(`  Worst Run: ${comparison.comparison.worstRun}`);
    console.log(`\nReports saved to: ${outputDir}`);
    console.log(`View comparison: file://${path.join(outputDir, 'comparison.html')}`);
  }
  
  await prisma.$disconnect();
}

main();

