#!/usr/bin/env bun
/**
 * Load Test CLI
 * 
 * Run database load tests locally to simulate concurrent users
 * and identify performance bottlenecks.
 * 
 * Usage:
 *   bun run scripts/run-load-test.ts [scenario]
 *   
 * Scenarios: light, normal, heavy, stress
 */

import { LoadTestSimulator, TEST_SCENARIOS } from '@/lib/testing/load-test-simulator';
import { queryMonitor } from '@/lib/db/query-monitor';

// Parse command line arguments
const args = process.argv.slice(2);
const scenarioName = args[0] || 'normal';
const baseUrl = args[1] || 'http://localhost:3000';

// Validate scenario
const validScenarios = ['light', 'normal', 'heavy', 'stress'] as const;
type ScenarioName = typeof validScenarios[number];

if (!validScenarios.includes(scenarioName as ScenarioName)) {
  console.error(`Invalid scenario: ${scenarioName}`);
  console.error(`Valid scenarios: ${validScenarios.join(', ')}`);
  process.exit(1);
}

// Get scenario configuration
const scenarioKey = scenarioName.toUpperCase() as keyof typeof TEST_SCENARIOS;
const config = TEST_SCENARIOS[scenarioKey];

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Babylon Load Test');
  console.log('═══════════════════════════════════════');
  console.log(`Scenario: ${scenarioName}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Concurrent Users: ${config.concurrentUsers}`);
  console.log(`Duration: ${config.durationSeconds}s`);
  console.log(`Ramp-up: ${config.rampUpSeconds || 0}s`);
  console.log('═══════════════════════════════════════\n');

  // Check if server is running (just verify it responds, don't check status)
  const response = await fetch(`${baseUrl}/api/stats`).catch(() => {
    console.error('❌ Could not connect to server');
    console.error(`   Make sure the server is running at ${baseUrl}`);
    process.exit(1);
    throw new Error('Server not running');
  });
  // Server responded (even if with error), so it's running
  console.log(`✅ Server responding (status: ${response.status})\n`);

  console.log('✅ Server is running\n');
  console.log('Starting load test...\n');

  // Enable query monitoring
  process.env.ENABLE_QUERY_MONITORING = 'true';

  // Run test
  const simulator = new LoadTestSimulator(baseUrl);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Stopping test...');
    simulator.stop();
  });

  const result = await simulator.runTest(config);

  // Display results
  console.log('\n═══════════════════════════════════════');
  console.log('  Load Test Results');
  console.log('═══════════════════════════════════════');
  console.log(`Total Requests:      ${result.totalRequests.toLocaleString()}`);
  console.log(`Successful:          ${result.successfulRequests.toLocaleString()} (${(result.throughput.successRate * 100).toFixed(2)}%)`);
  console.log(`Failed:              ${result.failedRequests.toLocaleString()}`);
  console.log(`Duration:            ${(result.durationMs / 1000).toFixed(2)}s`);
  console.log(`Throughput:          ${result.throughput.requestsPerSecond.toFixed(2)} req/s`);
  console.log('');
  console.log('Response Times:');
  console.log(`  Min:               ${result.responseTime.min.toFixed(2)}ms`);
  console.log(`  Mean:              ${result.responseTime.mean.toFixed(2)}ms`);
  console.log(`  Median:            ${result.responseTime.median.toFixed(2)}ms`);
  console.log(`  95th Percentile:   ${result.responseTime.p95.toFixed(2)}ms`);
  console.log(`  99th Percentile:   ${result.responseTime.p99.toFixed(2)}ms`);
  console.log(`  Max:               ${result.responseTime.max.toFixed(2)}ms`);
  console.log('');

  // Display endpoint stats
  console.log('Endpoint Performance:');
  const sortedEndpoints = Object.entries(result.endpointStats)
    .sort((a, b) => b[1].avgResponseTime - a[1].avgResponseTime);

  for (const [endpoint, stats] of sortedEndpoints) {
    const errorRate = stats.count > 0 ? (stats.errorCount / stats.count) * 100 : 0;
    const successRate = stats.count > 0 ? (stats.successCount / stats.count) * 100 : 0;
    console.log(`  ${endpoint}`);
    console.log(`    Requests: ${stats.count.toLocaleString()} (${stats.successCount} successful)`);
    console.log(`    Avg Time: ${stats.avgResponseTime.toFixed(2)}ms (successful only)`);
    console.log(`    Success:  ${successRate.toFixed(2)}%`);
    console.log(`    Errors:   ${stats.errorCount} (${errorRate.toFixed(2)}%)`);
  }

  // Display errors if any
  if (result.errors.length > 0) {
    console.log('');
    console.log('Errors:');
    for (const error of result.errors.slice(0, 10)) {
      console.log(`  ${error.endpoint}: ${error.error} (${error.count}x)`);
    }
    if (result.errors.length > 10) {
      console.log(`  ... and ${result.errors.length - 10} more error types`);
    }
  }

  // Display database query stats if available
  console.log('');
  console.log('Database Query Performance:');
  const queryStats = queryMonitor.getQueryStats();
  console.log(`  Total Queries:     ${queryStats.totalQueries.toLocaleString()}`);
  console.log(`  Slow Queries:      ${queryStats.slowQueries} (${queryStats.totalQueries > 0 ? ((queryStats.slowQueries / queryStats.totalQueries) * 100).toFixed(2) : 0}%)`);
  console.log(`  Avg Duration:      ${queryStats.avgDuration.toFixed(2)}ms`);
  console.log(`  95th Percentile:   ${queryStats.p95Duration.toFixed(2)}ms`);
  console.log(`  99th Percentile:   ${queryStats.p99Duration.toFixed(2)}ms`);

  // Display top slow queries
  const slowQueries = queryMonitor.getSlowQueryStats();
  const topSlowQueries = Object.entries(slowQueries)
    .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
    .slice(0, 5);

  if (topSlowQueries.length > 0) {
    console.log('');
    console.log('Top 5 Slowest Query Types:');
    for (const [query, stats] of topSlowQueries) {
      console.log(`  ${query}`);
      console.log(`    Count:       ${stats.count}`);
      console.log(`    Avg:         ${stats.avgDuration.toFixed(2)}ms`);
      console.log(`    Max:         ${stats.maxDuration.toFixed(2)}ms`);
    }
  }

  console.log('═══════════════════════════════════════\n');

  // Assessment
  const p95ResponseTime = result.responseTime.p95;
  const successRate = result.throughput.successRate;
  const slowQueryRate = queryStats.totalQueries > 0 
    ? queryStats.slowQueries / queryStats.totalQueries 
    : 0;

  console.log('Assessment:');
  
  if (successRate >= 0.99 && p95ResponseTime < 200 && slowQueryRate < 0.05) {
    console.log('✅ EXCELLENT - System performing well under load');
  } else if (successRate >= 0.95 && p95ResponseTime < 500 && slowQueryRate < 0.1) {
    console.log('⚠️  GOOD - Some optimizations recommended');
  } else if (successRate >= 0.90 && p95ResponseTime < 1000) {
    console.log('⚠️  FAIR - Significant optimizations needed');
  } else {
    console.log('❌ POOR - Critical performance issues detected');
  }

  console.log('');

  // Recommendations
  const recommendations: string[] = [];

  if (p95ResponseTime > 200) {
    recommendations.push('• Optimize slow API endpoints (p95 > 200ms)');
  }

  if (slowQueryRate > 0.05) {
    recommendations.push('• Optimize database queries (>5% slow queries)');
  }

  if (successRate < 0.99) {
    recommendations.push('• Investigate and fix failing requests');
  }

  if (queryStats.p95Duration > 50) {
    recommendations.push('• Add database indexes for slow queries');
  }

  if (recommendations.length > 0) {
    console.log('Recommendations:');
    for (const rec of recommendations) {
      console.log(rec);
    }
    console.log('');
  }

  // Save results to file
  const resultsFile = `load-test-results-${scenarioName}-${Date.now()}.json`;
  await Bun.write(resultsFile, JSON.stringify(result, null, 2));
  console.log(`Results saved to: ${resultsFile}\n`);
}

main();

