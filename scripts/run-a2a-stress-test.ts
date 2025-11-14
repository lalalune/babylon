#!/usr/bin/env bun
/**
 * A2A Stress Test CLI
 * 
 * Run stress tests on Agent-to-Agent (A2A) protocol endpoints to verify
 * rate limiting, performance, and reliability under load.
 * 
 * Usage:
 *   bun run scripts/run-a2a-stress-test.ts [scenario]
 *   
 * Scenarios: light, normal, heavy, rate-limit, coalition
 */

import { LoadTestSimulator, type LoadTestResult } from '@/lib/testing/load-test-simulator';
import { A2A_TEST_SCENARIOS } from '@/lib/testing/a2a-load-test-scenarios';

// Parse command line arguments
const args = process.argv.slice(2);
const scenarioName = args[0] || 'normal';
const baseUrl = args[1] || 'http://localhost:3000';

// Validate scenario
const validScenarios = ['light', 'normal', 'heavy', 'rate-limit', 'coalition'] as const;
type ScenarioName = typeof validScenarios[number];

if (!validScenarios.includes(scenarioName as ScenarioName)) {
  console.error(`Invalid scenario: ${scenarioName}`);
  console.error(`Valid scenarios: ${validScenarios.join(', ')}`);
  process.exit(1);
}

// Get scenario configuration
const scenarioKey = scenarioName.toUpperCase().replace('-', '_') as keyof typeof A2A_TEST_SCENARIOS;
const config = A2A_TEST_SCENARIOS[scenarioKey];

/**
 * Analyze rate limit errors
 */
function analyzeRateLimitErrors(result: LoadTestResult) {
  const rateLimitErrors = result.errors.filter(e => 
    e.error.includes('429') || e.error.toLowerCase().includes('rate limit')
  );
  
  const totalRateLimitErrors = rateLimitErrors.reduce((sum, e) => sum + e.count, 0);
  const rateLimitErrorRate = result.totalRequests > 0 
    ? (totalRateLimitErrors / result.totalRequests) * 100 
    : 0;
  
  return {
    count: totalRateLimitErrors,
    rate: rateLimitErrorRate,
    errors: rateLimitErrors
  };
}

/**
 * Display A2A-specific metrics
 */
function displayA2AMetrics(result: LoadTestResult) {
  console.log('\n═══════════════════════════════════════');
  console.log('  A2A Protocol Metrics');
  console.log('═══════════════════════════════════════');
  
  // Rate limiting analysis
  const rateLimitAnalysis = analyzeRateLimitErrors(result);
  
  console.log('\nRate Limiting:');
  console.log(`  Rate Limit Errors:     ${rateLimitAnalysis.count.toLocaleString()}`);
  console.log(`  Rate Limit Error Rate: ${rateLimitAnalysis.rate.toFixed(2)}%`);
  
  if (scenarioName === 'rate-limit') {
    if (rateLimitAnalysis.count > 0) {
      console.log('  ✅ Rate limiting is WORKING (expected errors in this test)');
    } else {
      console.log('  ⚠️  Rate limiting may NOT be working (no rate limit errors detected)');
    }
  } else {
    if (rateLimitAnalysis.rate < 1) {
      console.log('  ✅ Rate limiting is properly configured');
    } else if (rateLimitAnalysis.rate < 5) {
      console.log('  ⚠️  Some rate limiting issues detected');
    } else {
      console.log('  ❌ High rate limit error rate - check configuration');
    }
  }
  
  // A2A method performance
  console.log('\nA2A Method Performance:');
  const a2aEndpoints = Object.entries(result.endpointStats).filter(([endpoint]) => 
    endpoint === '/api/a2a'
  );
  
  for (const [endpoint, stats] of a2aEndpoints) {
    const errorRate = stats.count > 0 ? (stats.errorCount / stats.count) * 100 : 0;
    const successRate = stats.count > 0 ? (stats.successCount / stats.count) * 100 : 0;
    
    console.log(`\n  ${endpoint}`);
    console.log(`    Total Requests:    ${stats.count.toLocaleString()}`);
    console.log(`    Successful:        ${stats.successCount.toLocaleString()} (${successRate.toFixed(2)}%)`);
    console.log(`    Failed:            ${stats.errorCount.toLocaleString()} (${errorRate.toFixed(2)}%)`);
    console.log(`    Avg Response Time: ${stats.avgResponseTime.toFixed(2)}ms`);
  }
  
  // JSON-RPC specific metrics
  console.log('\nJSON-RPC Metrics:');
  const jsonRpcErrors = result.errors.filter(e => 
    !e.error.includes('429') && e.endpoint === '/api/a2a'
  );
  
  if (jsonRpcErrors.length > 0) {
    console.log('  Top JSON-RPC Errors:');
    for (const error of jsonRpcErrors.slice(0, 5)) {
      console.log(`    ${error.error}: ${error.count}x`);
    }
  } else {
    console.log('  ✅ No JSON-RPC protocol errors');
  }
}

/**
 * Generate recommendations specific to A2A
 */
function generateA2ARecommendations(result: LoadTestResult): string[] {
  const recommendations: string[] = [];
  const rateLimitAnalysis = analyzeRateLimitErrors(result);
  
  // Rate limiting recommendations
  if (scenarioName !== 'rate-limit') {
    if (rateLimitAnalysis.rate > 5) {
      recommendations.push('• Increase rate limit threshold or reduce concurrent agents');
    }
    if (rateLimitAnalysis.rate === 0 && result.throughput.requestsPerSecond > 100) {
      recommendations.push('• Rate limiting may not be active - verify implementation');
    }
  }
  
  // Performance recommendations
  const a2aStats = result.endpointStats['/api/a2a'];
  if (a2aStats) {
    if (a2aStats.avgResponseTime > 200) {
      recommendations.push('• A2A endpoint response time is high - optimize message routing');
    }
    
    const errorRate = a2aStats.count > 0 ? (a2aStats.errorCount / a2aStats.count) : 0;
    if (errorRate > 0.05) {
      recommendations.push('• High A2A error rate - check agent authentication and validation');
    }
  }
  
  // Connection recommendations
  if (result.responseTime.p95 > 500) {
    recommendations.push('• Consider implementing connection pooling for agents');
  }
  
  return recommendations;
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Babylon A2A Protocol Stress Test');
  console.log('═══════════════════════════════════════');
  console.log(`Scenario: ${scenarioName}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Concurrent Agents: ${config.concurrentUsers}`);
  console.log(`Duration: ${config.durationSeconds}s`);
  console.log(`Ramp-up: ${config.rampUpSeconds || 0}s`);
  console.log(`Think Time: ${config.thinkTimeMs || 0}ms`);
  console.log(`Max RPS: ${config.maxRps || 'unlimited'}`);
  console.log('═══════════════════════════════════════\n');

  // Check if server is running
  try {
    const response = await fetch(`${baseUrl}/api/a2a`);
    const data = await response.json();
    
    if (data.service !== 'Babylon A2A Protocol') {
      console.error('❌ A2A endpoint not responding correctly');
      console.error(`   Expected: Babylon A2A Protocol`);
      console.error(`   Got: ${JSON.stringify(data)}`);
      process.exit(1);
    }
    
    console.log(`✅ A2A endpoint is active (version: ${data.version})\n`);
  } catch (error) {
    console.error('❌ Could not connect to A2A endpoint');
    console.error(`   Make sure the server is running at ${baseUrl}`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  console.log('Starting A2A stress test...\n');

  // Run test
  const simulator = new LoadTestSimulator(baseUrl);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⚠️  Stopping test...');
    simulator.stop();
  });

  const result = await simulator.runTest(config);

  // Display standard results
  console.log('\n═══════════════════════════════════════');
  console.log('  Test Results Summary');
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

  // Display A2A-specific metrics
  displayA2AMetrics(result);

  // Assessment
  console.log('\n═══════════════════════════════════════');
  console.log('  Assessment');
  console.log('═══════════════════════════════════════');
  
  const p95ResponseTime = result.responseTime.p95;
  const successRate = result.throughput.successRate;
  const rateLimitAnalysis = analyzeRateLimitErrors(result);
  
  if (scenarioName === 'rate-limit') {
    // For rate limit test, we EXPECT errors
    if (rateLimitAnalysis.count > 0 && rateLimitAnalysis.rate > 10) {
      console.log('✅ EXCELLENT - Rate limiting is working as expected');
      console.log('   Rate limit errors were triggered under stress');
    } else if (rateLimitAnalysis.count > 0) {
      console.log('⚠️  GOOD - Rate limiting is active but may be too permissive');
    } else {
      console.log('❌ FAILED - Rate limiting does not appear to be working');
      console.log('   No rate limit errors detected despite stress test');
    }
  } else {
    // For normal tests, minimize errors
    if (successRate >= 0.99 && p95ResponseTime < 200) {
      console.log('✅ EXCELLENT - A2A protocol performing well under load');
    } else if (successRate >= 0.95 && p95ResponseTime < 500) {
      console.log('⚠️  GOOD - A2A protocol stable with room for optimization');
    } else if (successRate >= 0.90 && p95ResponseTime < 1000) {
      console.log('⚠️  FAIR - A2A protocol needs optimization');
    } else {
      console.log('❌ POOR - A2A protocol has critical performance issues');
    }
  }

  // Generate recommendations
  const recommendations = generateA2ARecommendations(result);
  
  if (recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of recommendations) {
      console.log(rec);
    }
  }

  console.log('═══════════════════════════════════════\n');

  // Save results to file
  const resultsFile = `a2a-stress-test-${scenarioName}-${Date.now()}.json`;
  await Bun.write(resultsFile, JSON.stringify(result, null, 2));
  console.log(`Results saved to: ${resultsFile}\n`);
}

main();

