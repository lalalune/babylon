/**
 * Generate Benchmark Data Script
 * 
 * Creates a new benchmark snapshot for testing agent performance.
 * 
 * Usage:
 *   npx ts-node scripts/generate-benchmark.ts --duration 30 --markets 5 --agents 8
 */

import { BenchmarkDataGenerator, type BenchmarkConfig } from '@/lib/benchmark/BenchmarkDataGenerator';
import { promises as fs } from 'fs';
import * as path from 'path';
import { logger } from '@/lib/logger';

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const durationMinutes = parseInt(args.find(a => a.startsWith('--duration'))?.split('=')[1] || '30');
  const seed = parseInt(args.find(a => a.startsWith('--seed'))?.split('=')[1] || '') || 12345;
  const force = args.includes('--force');
  
  const config: BenchmarkConfig = {
    durationMinutes,
    tickInterval: parseInt(args.find(a => a.startsWith('--interval'))?.split('=')[1] || '60'), // 60 seconds
    numPredictionMarkets: parseInt(args.find(a => a.startsWith('--markets'))?.split('=')[1] || '5'),
    numPerpetualMarkets: parseInt(args.find(a => a.startsWith('--perpetuals'))?.split('=')[1] || '3'),
    numAgents: parseInt(args.find(a => a.startsWith('--agents'))?.split('=')[1] || '8'),
    seed,
  };
  
  // Save to file
  const outputDir = path.join(process.cwd(), 'benchmarks');
  await fs.mkdir(outputDir, { recursive: true });
  
  // Generate filename based on config (for idempotency)
  const configHash = `${durationMinutes}-${config.tickInterval}-${config.numPredictionMarkets}-${config.numPerpetualMarkets}-${config.numAgents}-${seed}`;
  const filename = `benchmark-week-${configHash}.json`;
  const filepath = path.join(outputDir, filename);
  
  // Idempotent check: skip if file exists and not forcing
  if (!force && await fs.access(filepath).then(() => true).catch(() => false)) {
    logger.info('Benchmark already exists, skipping generation', { filepath });
    console.log(`\n✅ Benchmark already exists: ${filepath}`);
    console.log(`   Use --force to regenerate\n`);
    return;
  }
  
  logger.info('Generating benchmark with config:', config);
  
  // Generate benchmark
  const generator = new BenchmarkDataGenerator(config);
  const snapshot = await generator.generate();
  
  await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2));
  
  logger.info('Benchmark generated successfully!', {
    id: snapshot.id,
    filepath,
    duration: snapshot.duration,
    ticks: snapshot.ticks.length,
    markets: snapshot.initialState.predictionMarkets.length,
    perpetuals: snapshot.initialState.perpetualMarkets.length,
  });
  
  // Print summary
  console.log('\n✅ Benchmark Generated Successfully!\n');
  console.log(`ID: ${snapshot.id}`);
  console.log(`File: ${filepath}`);
  console.log(`Duration: ${durationMinutes} minutes (${(durationMinutes / 60).toFixed(1)} hours)`);
  console.log(`Ticks: ${snapshot.ticks.length}`);
  console.log(`Markets: ${snapshot.initialState.predictionMarkets.length} prediction, ${snapshot.initialState.perpetualMarkets.length} perpetual`);
  console.log(`Agents: ${snapshot.initialState.agents.length}`);
  console.log(`\nOptimal Actions: ${snapshot.groundTruth.optimalActions.length}`);
  console.log(`Social Opportunities: ${snapshot.groundTruth.socialOpportunities.length}`);
  console.log('\nUse this benchmark with:');
  console.log(`  npx ts-node scripts/run-benchmark.ts --benchmark ${filepath}`);
}

main().catch(console.error);

