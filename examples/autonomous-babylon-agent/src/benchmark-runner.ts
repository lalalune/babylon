/**
 * Benchmark Runner for Autonomous Babylon Agent
 * 
 * Runs this agent through benchmark simulations to measure performance.
 * Uses the same decision-making logic but with a simulated A2A interface.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { AgentMemory } from './memory.js'
import { AgentDecisionMaker } from './decision.js'
import { executeAction } from './actions.js'
import fs from 'fs'
import path from 'path'

// Import from main Babylon system
const benchmarkPath = '../../src/lib/benchmark/BenchmarkDataGenerator.js'
const simulationPath = '../../src/lib/benchmark/SimulationEngine.js'
const a2aInterfacePath = '../../src/lib/benchmark/SimulationA2AInterface.js'
const visualizerPath = '../../src/lib/benchmark/MetricsVisualizer.js'

interface BenchmarkSnapshot {
  id: string
  ticks: any[]
  initialState: any
  [key: string]: any
}

interface SimulationResult {
  id: string
  metrics: {
    totalPnl: number
    predictionMetrics: {
      accuracy: number
      totalPositions: number
    }
    perpMetrics: {
      winRate: number
      totalTrades: number
    }
    optimalityScore: number
    timing: {
      totalDuration: number
    }
  }
  [key: string]: any
}

const LOG_DIR = './logs'
const LOG_FILE = path.join(LOG_DIR, 'benchmark.log')

function log(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`
  
  console.log(logLine.trim())
  
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
  }
  fs.appendFileSync(LOG_FILE, logLine)
}

async function loadBenchmark(benchmarkFile: string): Promise<BenchmarkSnapshot> {
  const data = fs.readFileSync(benchmarkFile, 'utf-8')
  return JSON.parse(data)
}

async function runBenchmark(
  benchmarkFile: string,
  outputDir: string
): Promise<SimulationResult> {
  log('🎯 Starting Autonomous Agent Benchmark')
  log(`Benchmark: ${benchmarkFile}`)
  log(`Output: ${outputDir}`)
  
  // 1. Load benchmark
  log('📊 Loading benchmark data...')
  const snapshot = await loadBenchmark(benchmarkFile)
  log(`  Loaded: ${snapshot.ticks.length} ticks`)
  
  // 2. Dynamic import of benchmark modules (to avoid compile-time dependency)
  log('🔧 Loading simulation modules...')
  
  // Try to load from compiled output
  const { SimulationEngine } = await import('../../../dist/src/lib/benchmark/SimulationEngine.js').catch((err: Error) => {
    log(`⚠️  Could not load from dist, using relative imports`, 'warn')
    // Fallback: expect them to be built
    throw new Error('Benchmark modules not found. Run: npm run build')
  })
  
  const { SimulationA2AInterface } = await import('../../../dist/src/lib/benchmark/SimulationA2AInterface.js')
  const { MetricsVisualizer } = await import('../../../dist/src/lib/benchmark/MetricsVisualizer.js')
  
  // 3. Create simulation engine
  log('🎮 Creating simulation engine...')
  const simConfig = {
    snapshot,
    agentId: 'autonomous-babylon-agent',
    fastForward: true,
    responseTimeout: 30000,
  }
  
  const engine = new SimulationEngine(simConfig)
  
  // 4. Create A2A interface
  log('🔌 Creating simulation A2A interface...')
  const a2aInterface = new SimulationA2AInterface(engine, 'autonomous-babylon-agent')
  
  // 5. Initialize agent components
  log('🧠 Initializing agent memory and decision maker...')
  const memory = new AgentMemory({ maxEntries: 20 })
  const decisionMaker = new AgentDecisionMaker({
    strategy: (process.env.AGENT_STRATEGY || 'balanced') as any,
    groqApiKey: process.env.GROQ_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY
  })
  
  log(`  Strategy: ${process.env.AGENT_STRATEGY || 'balanced'}`)
  log(`  LLM Provider: ${decisionMaker.getProvider()}`)
  
  // 6. Run simulation loop
  log('🚀 Starting simulation loop...')
  let tickCount = 0
  const totalTicks = snapshot.ticks.length
  
  while (engine.getGameState().tick < totalTicks) {
    tickCount++
    
    if (tickCount % 10 === 0 || tickCount === 1) {
      log(`  Tick ${tickCount}/${totalTicks} (${((tickCount/totalTicks)*100).toFixed(0)}%)`)
    }
    
    await (async () => {
      // Gather context via A2A interface
      const portfolio = await a2aInterface.sendRequest('a2a.getPortfolio') as { balance: number; positions: unknown[]; pnl: number }
      const predictions = await a2aInterface.sendRequest('a2a.getPredictions') as { predictions: unknown[] }
      const perpetuals = await a2aInterface.sendRequest('a2a.getPerpetuals') as { perpetuals: unknown[] }
      const feed = await a2aInterface.sendRequest('a2a.getFeed', { limit: 10 }) as { posts: unknown[] }
      
      const markets = {
        predictions: predictions.predictions || [],
        perps: perpetuals.perpetuals || []
      }
      
      const recentMemory = memory.getRecent(5)
      
      // Make decision
      const decision = await decisionMaker.decide({
        portfolio: portfolio || { balance: 10000, positions: [], pnl: 0 },
        markets,
        feed: feed || { posts: [] },
        memory: recentMemory
      })
      
      // Execute action (if not HOLD)
      if (decision.action !== 'HOLD') {
        const result = await executeAction(a2aInterface as never, decision)
        
        if (result.success) {
          memory.add({
            action: decision.action,
            params: decision.params,
            result: result.data,
            timestamp: Date.now()
          })
        }
      }
      
      // Advance tick
      engine.advanceTick()
      
    })().catch((error: Error) => {
      log(`  ⚠️  Error on tick ${tickCount}: ${error.message}`, 'warn')
      // Continue anyway
      engine.advanceTick()
    })
  }
  
  log(`✅ Simulation complete: ${tickCount} ticks processed`)
  
  // 7. Get final results
  log('📊 Collecting results...')
  const result = await engine.run()
  
  // 8. Save results
  log('💾 Saving results...')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'result.json'),
    JSON.stringify(result, null, 2)
  )
  
  fs.writeFileSync(
    path.join(outputDir, 'metrics.json'),
    JSON.stringify(result.metrics, null, 2)
  )
  
  // 9. Generate visualizations
  log('📈 Generating visualizations...')
  await MetricsVisualizer.visualizeSingleRun(result, {
    outputDir,
    generateHtml: true,
    generateCsv: true,
    generateCharts: false,
  })
  
  log('✅ Benchmark Complete!')
  log('')
  log('Results:')
  log(`  Total P&L: $${result.metrics.totalPnl.toFixed(2)}`)
  log(`  Prediction Accuracy: ${(result.metrics.predictionMetrics.accuracy * 100).toFixed(1)}%`)
  log(`  Perp Win Rate: ${(result.metrics.perpMetrics.winRate * 100).toFixed(1)}%`)
  log(`  Optimality Score: ${result.metrics.optimalityScore.toFixed(1)}%`)
  log(`  Duration: ${(result.metrics.timing.totalDuration / 1000).toFixed(1)}s`)
  log('')
  log(`View report: file://${path.join(outputDir, 'index.html')}`)
  
  return result
}

async function runMultiple(
  benchmarkFile: string,
  outputDir: string,
  runs: number
) {
  log(`🔄 Running ${runs} benchmark iterations`)
  
  const results: SimulationResult[] = []
  
  for (let i = 0; i < runs; i++) {
    log('')
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    log(`Run ${i + 1}/${runs}`)
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    
    const runDir = path.join(outputDir, `run-${i + 1}`)
    const result = await runBenchmark(benchmarkFile, runDir)
    results.push(result)
    
    // Delay between runs
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  // Calculate comparison
  const avgPnl = results.reduce((sum, r) => sum + r.metrics.totalPnl, 0) / runs
  const avgAccuracy = results.reduce((sum, r) => sum + r.metrics.predictionMetrics.accuracy, 0) / runs
  const avgOptimality = results.reduce((sum, r) => sum + r.metrics.optimalityScore, 0) / runs
  
  const comparison = {
    runs: results,
    comparison: {
      avgPnl,
      avgAccuracy,
      avgOptimality,
      bestRun: results.reduce((best, r) => r.metrics.totalPnl > best.metrics.totalPnl ? r : best).id,
      worstRun: results.reduce((worst, r) => r.metrics.totalPnl < worst.metrics.totalPnl ? r : worst).id,
    }
  }
  
  fs.writeFileSync(
    path.join(outputDir, 'comparison.json'),
    JSON.stringify(comparison, null, 2)
  )
  
  log('')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('🏆 ALL BENCHMARKS COMPLETE')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`  Runs: ${runs}`)
  log(`  Avg P&L: $${avgPnl.toFixed(2)}`)
  log(`  Avg Accuracy: ${(avgAccuracy * 100).toFixed(1)}%`)
  log(`  Avg Optimality: ${avgOptimality.toFixed(1)}%`)
  log('')
  log(`Results: ${outputDir}`)
}

// CLI
async function main() {
  const args = process.argv.slice(2)
  
  const benchmarkFile = args.find(a => a.startsWith('--benchmark='))?.split('=')[1]
  const outputDir = args.find(a => a.startsWith('--output='))?.split('=')[1] || 
    `./benchmark-results/${Date.now()}`
  const runs = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1] || '1')
  
  if (!benchmarkFile) {
    console.error('Error: --benchmark is required')
    console.log('\nUsage:')
    console.log('  bun run src/benchmark-runner.ts --benchmark=path/to/benchmark.json [options]')
    console.log('\nOptions:')
    console.log('  --output=path/to/results  Output directory')
    console.log('  --runs=5                  Number of runs (default: 1)')
    process.exit(1)
  }
  
  if (runs === 1) {
    await runBenchmark(benchmarkFile, outputDir)
  } else {
    await runMultiple(benchmarkFile, outputDir, runs)
  }
}

main()

