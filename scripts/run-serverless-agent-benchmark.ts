/**
 * Run Serverless Agent Benchmark via API
 * 
 * Runs a serverless Eliza agent (built into the app) through a benchmark simulation
 * by calling the /api/agents/[agentId]/benchmark endpoint.
 * 
 * Usage:
 *   npx tsx scripts/run-serverless-agent-benchmark.ts \
 *     --agent-id=<agent-id> \
 *     --benchmark=benchmarks/benchmark-123.json \
 *     --runs=5 \
 *     --api-url=http://localhost:3000
 */

import { promises as fs } from 'fs'
import * as path from 'path'

interface BenchmarkResult {
  success: boolean
  runs: number
  results: {
    avgPnl?: number
    avgAccuracy?: number
    avgOptimality?: number
    avgActions?: number
    totalPnl?: number
    predictionAccuracy?: number
    perpWinRate?: number
    optimalityScore?: number
    actionsExecuted?: number
    duration: number
    outputDir: string
  }
  error?: string
}

async function main() {
  const args = process.argv.slice(2)
  
  // Parse arguments
  const agentId = args.find(a => a.startsWith('--agent-id='))?.split('=')[1]
  const benchmarkPath = args.find(a => a.startsWith('--benchmark='))?.split('=')[1]
  const runs = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1] || '1')
  const apiUrl = args.find(a => a.startsWith('--api-url='))?.split('=')[1] || 'http://localhost:3000'
  const authToken = args.find(a => a.startsWith('--token='))?.split('=')[1] || process.env.AUTH_TOKEN
  const outputDir = args.find(a => a.startsWith('--output='))?.split('=')[1]
  
  if (!agentId) {
    console.error('Error: --agent-id is required')
    console.log('\nUsage:')
    console.log('  npx tsx scripts/run-serverless-agent-benchmark.ts --agent-id=<id> [options]')
    console.log('\nOptions:')
    console.log('  --benchmark=path/to/benchmark.json  Benchmark file (required)')
    console.log('  --runs=5                            Number of runs (default: 1)')
    console.log('  --api-url=http://localhost:3000     API base URL (default: localhost:3000)')
    console.log('  --token=<jwt>                       Auth token (or set AUTH_TOKEN env var)')
    console.log('  --output=path/to/results            Output directory (optional)')
    process.exit(1)
  }
  
  if (!benchmarkPath) {
    console.error('Error: --benchmark is required')
    process.exit(1)
  }
  
  if (!authToken) {
    console.error('Error: Authentication token required (use --token or AUTH_TOKEN env var)')
    process.exit(1)
  }
  
  console.log('\n🎯 Starting Serverless Agent Benchmark\n')
  console.log(`Agent ID: ${agentId}`)
  console.log(`Benchmark: ${benchmarkPath}`)
  console.log(`Runs: ${runs}`)
  console.log(`API URL: ${apiUrl}`)
  console.log()
  
  try {
    // Load benchmark data
    console.log('📊 Loading benchmark data...')
    const fullPath = benchmarkPath.startsWith('/')
      ? benchmarkPath
      : path.join(process.cwd(), benchmarkPath)
    
    const benchmarkData = JSON.parse(await fs.readFile(fullPath, 'utf-8'))
    console.log(`  Loaded: ${benchmarkData.ticks?.length || 0} ticks`)
    
    // Call API endpoint
    console.log('🚀 Calling benchmark API...')
    const response = await fetch(`${apiUrl}/api/agents/${agentId}/benchmark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Cookie': `token=${authToken}` // Support cookie-based auth too
      },
      body: JSON.stringify({
        benchmarkData,
        runs,
        outputDir
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(`API error: ${error.error || response.statusText}`)
    }
    
    const result: BenchmarkResult = await response.json()
    
    if (!result.success) {
      throw new Error(`Benchmark failed: ${result.error}`)
    }
    
    // Display results
    console.log('\n✅ Benchmark Complete!\n')
    
    if (runs === 1) {
      console.log('Results:')
      console.log(`  Total P&L: $${result.results.totalPnl?.toFixed(2) || 0}`)
      console.log(`  Prediction Accuracy: ${((result.results.predictionAccuracy || 0) * 100).toFixed(1)}%`)
      console.log(`  Perp Win Rate: ${((result.results.perpWinRate || 0) * 100).toFixed(1)}%`)
      console.log(`  Optimality Score: ${(result.results.optimalityScore || 0).toFixed(1)}%`)
      console.log(`  Actions Executed: ${result.results.actionsExecuted || 0}`)
      console.log(`  Duration: ${(result.results.duration / 1000).toFixed(1)}s`)
    } else {
      console.log('Aggregate Results:')
      console.log(`  Runs: ${result.runs}`)
      console.log(`  Avg P&L: $${result.results.avgPnl?.toFixed(2) || 0}`)
      console.log(`  Avg Accuracy: ${((result.results.avgAccuracy || 0) * 100).toFixed(1)}%`)
      console.log(`  Avg Optimality: ${(result.results.avgOptimality || 0).toFixed(1)}%`)
      console.log(`  Avg Actions: ${result.results.avgActions?.toFixed(1) || 0}`)
      console.log(`  Total Duration: ${(result.results.duration / 1000).toFixed(1)}s`)
    }
    
    console.log(`\n📁 Results saved to: ${result.results.outputDir}`)
    console.log()
    
  } catch (error) {
    console.error('\n❌ Benchmark failed:')
    console.error(error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  }
}

main()



