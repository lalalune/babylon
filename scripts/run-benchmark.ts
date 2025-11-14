/**
 * Run Benchmark Script
 * 
 * Runs an agent through a benchmark simulation and generates performance reports.
 * 
 * Usage:
 *   # Single run
 *   npx ts-node scripts/run-benchmark.ts --benchmark benchmarks/benchmark-123.json --agent agent-id
 *   
 *   # Multiple runs for statistical significance
 *   npx ts-node scripts/run-benchmark.ts --benchmark benchmarks/benchmark-123.json --agent agent-id --runs 5
 *   
 *   # Save trajectories for RL training
 *   npx ts-node scripts/run-benchmark.ts --benchmark benchmarks/benchmark-123.json --agent agent-id --runs 5 --save-trajectories
 */

import { BenchmarkRunner, type BenchmarkRunConfig } from '@/lib/benchmark/BenchmarkRunner';
import { MetricsVisualizer } from '@/lib/benchmark/MetricsVisualizer';
import { logger } from '@/lib/logger';
import * as path from 'path';

// This is a simplified version - in production you'd load actual agent runtime
class MockAgentRuntime {
  // Mock implementation for testing
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const benchmarkPath = args.find(a => a.startsWith('--benchmark'))?.split('=')[1];
  const agentId = args.find(a => a.startsWith('--agent'))?.split('=')[1] || 'test-agent';
  const numRuns = parseInt(args.find(a => a.startsWith('--runs'))?.split('=')[1] || '1');
  const saveTrajectories = args.includes('--save-trajectories');
  const outputDir = args.find(a => a.startsWith('--output'))?.split('=')[1] || path.join(process.cwd(), 'benchmark-results', `${Date.now()}`);
  
  if (!benchmarkPath) {
    console.error('Error: --benchmark argument is required');
    console.log('\nUsage:');
    console.log('  npx ts-node scripts/run-benchmark.ts --benchmark=benchmarks/benchmark-123.json --agent=agent-id');
    process.exit(1);
  }
  
  logger.info('Starting benchmark run', {
    benchmarkPath,
    agentId,
    numRuns,
    saveTrajectories,
    outputDir,
  });
  
  // Create agent runtime (mock for now)
  const agentRuntime = new MockAgentRuntime() as any;
  
  // Configure benchmark run
  const config: BenchmarkRunConfig = {
    benchmarkPath,
    agentRuntime,
    agentUserId: agentId,
    saveTrajectory: saveTrajectories,
    outputDir,
  };
  
  if (numRuns === 1) {
    // Single run
    console.log('\n🚀 Running single benchmark...\n');
    const result = await BenchmarkRunner.runSingle(config);
    
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
    console.log(`\n🚀 Running ${numRuns} benchmarks...\n`);
    const comparison = await BenchmarkRunner.runMultiple(config, numRuns);
    
    // Generate comparison visualizations
    await MetricsVisualizer.visualizeComparison(comparison, {
      outputDir,
      generateHtml: true,
      generateCsv: true,
      generateCharts: false,
    });
    
    console.log('\n✅ All Benchmarks Complete!\n');
    console.log('Summary:');
    console.log(`  Runs: ${comparison.runs.length}`);
    console.log(`  Avg P&L: $${comparison.comparison.avgPnl.toFixed(2)}`);
    console.log(`  Avg Accuracy: ${(comparison.comparison.avgAccuracy * 100).toFixed(1)}%`);
    console.log(`  Avg Optimality: ${comparison.comparison.avgOptimality.toFixed(1)}%`);
    console.log(`  Best Run: ${comparison.comparison.bestRun}`);
    console.log(`  Worst Run: ${comparison.comparison.worstRun}`);
    
    if (saveTrajectories) {
      console.log(`\n📊 Trajectories saved for RL training:`);
      comparison.trajectories?.forEach((t, i) => {
        console.log(`  Run ${i + 1}: ${t}`);
      });
    }
    
    console.log(`\nReports saved to: ${outputDir}`);
    console.log(`View comparison: file://${path.join(outputDir, 'comparison.html')}`);
  }
}

main().catch(console.error);

