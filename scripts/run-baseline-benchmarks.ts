/**
 * Run Baseline Benchmark Tests
 * 
 * Runs benchmarks with forced model selection (QEN and LLaMA 8b) to establish baselines.
 * Results are saved to benchmarks/baselines/ for comparison with trained models.
 * 
 * Usage:
 *   npx ts-node scripts/run-baseline-benchmarks.ts --benchmark benchmarks/benchmark-week-*.json
 */

import { BenchmarkRunner } from '@/lib/benchmark/BenchmarkRunner';
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import * as path from 'path';
import { promises as fs } from 'fs';

interface BaselineConfig {
  benchmarkPath: string;
  agentUserId: string;
  outputDir: string;
  forceRegenerate?: boolean;
}

const BASELINE_MODELS = [
  {
    name: 'qwen',
    modelId: 'qwen/qwen3-32b',
    displayName: 'Qwen 32B',
    outputFile: 'baseline-qwen.json'
  },
  {
    name: 'llama8b',
    modelId: 'llama-3.1-8b-instant',
    displayName: 'LLaMA 8B Instant',
    outputFile: 'baseline-llama8b.json'
  }
];

async function runBaselineBenchmark(
  config: BaselineConfig,
  model: typeof BASELINE_MODELS[0]
): Promise<void> {
  const baselineOutputPath = path.join(config.outputDir, model.outputFile);
  
  // Idempotent check
  if (!config.forceRegenerate && await fs.access(baselineOutputPath).then(() => true).catch(() => false)) {
    logger.info(`Baseline ${model.name} already exists, skipping`, { path: baselineOutputPath });
    console.log(`  ⏭️  ${model.displayName} baseline already exists: ${baselineOutputPath}`);
    return;
  }
  
  logger.info(`Running baseline benchmark with ${model.displayName}`, {
    model: model.modelId,
    benchmark: config.benchmarkPath
  });
  
  console.log(`\n📊 Running ${model.displayName} baseline...`);
  
  // Get or create agent runtime
  const runtime = await agentRuntimeManager.getRuntime(config.agentUserId);
  
  // Run benchmark with forced model
  const result = await BenchmarkRunner.runSingle({
    benchmarkPath: config.benchmarkPath,
    agentRuntime: runtime,
    agentUserId: config.agentUserId,
    saveTrajectory: false, // Don't save trajectories for baselines
    outputDir: path.join(config.outputDir, model.name),
    forceModel: model.modelId
  });
  
  // Save baseline result
  const baselineResult = {
    model: {
      name: model.name,
      modelId: model.modelId,
      displayName: model.displayName
    },
    benchmark: {
      id: result.benchmarkId,
      path: config.benchmarkPath
    },
    metrics: {
      totalPnl: result.metrics.totalPnl,
      predictionAccuracy: result.metrics.predictionMetrics.accuracy,
      perpWinRate: result.metrics.perpMetrics.winRate,
      optimalityScore: result.metrics.optimalityScore,
      totalTrades: result.metrics.predictionMetrics.totalPositions + result.metrics.perpMetrics.totalTrades,
      correctPredictions: result.metrics.predictionMetrics.correctPredictions,
      incorrectPredictions: result.metrics.predictionMetrics.incorrectPredictions
    },
    timing: {
      totalDuration: result.metrics.timing.totalDuration,
      avgResponseTime: result.metrics.timing.avgResponseTime
    },
    runAt: new Date().toISOString()
  };
  
  await fs.mkdir(config.outputDir, { recursive: true });
  await fs.writeFile(baselineOutputPath, JSON.stringify(baselineResult, null, 2));
  
  logger.info(`Baseline ${model.name} completed`, {
    totalPnl: result.metrics.totalPnl,
    accuracy: result.metrics.predictionMetrics.accuracy
  });
  
  console.log(`  ✅ ${model.displayName} baseline complete:`);
  console.log(`     P&L: $${result.metrics.totalPnl.toFixed(2)}`);
  console.log(`     Accuracy: ${(result.metrics.predictionMetrics.accuracy * 100).toFixed(1)}%`);
  console.log(`     Optimality: ${result.metrics.optimalityScore.toFixed(1)}%`);
  console.log(`     Saved to: ${baselineOutputPath}`);
}

async function ensureTestAgent(): Promise<string> {
  // Find or create test agent for baselines
  let agent = await prisma.user.findFirst({
    where: {
      isAgent: true,
      username: { startsWith: 'baseline-test-agent' }
    }
  });
  
  if (!agent) {
    const { ethers } = await import('ethers');
    const { generateSnowflakeId } = await import('@/lib/snowflake');
    
    const agentId = await generateSnowflakeId();
    agent = await prisma.user.create({
      data: {
        id: agentId,
        privyId: `did:privy:baseline-test-${agentId}`,
        username: `baseline-test-agent-${agentId.slice(-6)}`,
        displayName: 'Baseline Test Agent',
        walletAddress: ethers.Wallet.createRandom().address,
        isAgent: true,
        autonomousTrading: true,
        autonomousPosting: false,
        autonomousCommenting: false,
        agentSystem: 'You are a baseline test agent for benchmarking.',
        agentModelTier: 'lite',
        virtualBalance: 10000,
        reputationPoints: 1000,
        agentPointsBalance: 1000,
        isTest: true,
        updatedAt: new Date()
      }
    });
    
    logger.info('Created baseline test agent', { agentId: agent.id });
  }
  
  return agent.id;
}

async function main() {
  const args = process.argv.slice(2);
  
  const benchmarkPath = args.find(a => a.startsWith('--benchmark'))?.split('=')[1] || 
    args.find(a => a.startsWith('--benchmark='))?.split('=')[1];
  const outputDir = args.find(a => a.startsWith('--output'))?.split('=')[1] || 
    args.find(a => a.startsWith('--output='))?.split('=')[1] ||
    path.join(process.cwd(), 'benchmarks', 'baselines');
  const forceRegenerate = args.includes('--force');
  
  if (!benchmarkPath) {
    console.error('Error: --benchmark argument is required');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/run-baseline-benchmarks.ts --benchmark=benchmarks/benchmark-week-*.json');
    console.log('\nOptions:');
    console.log('  --output=path/to/baselines    Output directory (default: benchmarks/baselines)');
    console.log('  --force                       Regenerate even if baselines exist');
    process.exit(1);
  }
  
  // Verify benchmark exists
  if (!await fs.access(benchmarkPath).then(() => true).catch(() => false)) {
    console.error(`Error: Benchmark file not found: ${benchmarkPath}`);
    process.exit(1);
  }
  
  console.log('\n🎯 BASELINE BENCHMARK TESTS\n');
  console.log(`Benchmark: ${benchmarkPath}`);
  console.log(`Output: ${outputDir}\n`);
  
  // Ensure test agent exists
  const agentUserId = await ensureTestAgent();
  console.log(`Using test agent: ${agentUserId.substring(0, 12)}...\n`);
  
  // Run baselines for each model
  for (const model of BASELINE_MODELS) {
    await runBaselineBenchmark(
      { benchmarkPath, agentUserId, outputDir, forceRegenerate },
      model
    );
    
    // Small delay between runs
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n✅ All baseline benchmarks complete!\n');
  console.log('Baseline results saved to:');
  BASELINE_MODELS.forEach(model => {
    console.log(`  - ${model.displayName}: ${path.join(outputDir, model.outputFile)}`);
  });
  console.log('\nUse these baselines for comparison with trained models.\n');
  
  await prisma.$disconnect();
}

main().catch(console.error);

