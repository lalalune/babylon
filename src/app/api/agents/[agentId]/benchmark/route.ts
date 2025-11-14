/**
 * Agent Benchmark API
 * 
 * @route POST /api/agents/[agentId]/benchmark - Run agent through benchmark simulation
 * @access Authenticated (owner only)
 * 
 * @description
 * Runs a serverless Eliza agent through a standardized benchmark simulation to measure
 * performance. Uses the same AutonomousCoordinator that powers autonomous ticks but in
 * a controlled simulation environment with pre-recorded game data.
 * 
 * **How It Works:**
 * 1. Load benchmark snapshot (pre-recorded game data)
 * 2. Initialize agent's Eliza runtime
 * 3. Inject SimulationA2AInterface (replaces real A2A)
 * 4. Run agent through each tick using AutonomousCoordinator
 * 5. Calculate performance metrics
 * 6. Return results
 * 
 * **Features:**
 * - Fast-forward simulation (non-real-time)
 * - Deterministic replays for consistent testing
 * - Comprehensive performance metrics
 * - Compatible with all agent capabilities (trading, posting, etc.)
 * - Can run multiple benchmarks for statistical significance
 * 
 * @param {string} agentId - Agent user ID (path parameter)
 * @param {string} benchmarkPath - Path to benchmark JSON file (required)
 * @param {number} runs - Number of runs for statistical average (default: 1)
 * @param {string} outputDir - Directory to save results (optional)
 * 
 * @returns {object} Benchmark results
 * @property {boolean} success - Operation success
 * @property {object} results - Performance results
 * @property {number} results.totalPnl - Total profit/loss
 * @property {number} results.predictionAccuracy - Prediction accuracy (0-1)
 * @property {number} results.perpWinRate - Perp win rate (0-1)
 * @property {number} results.optimalityScore - How close to optimal (0-100)
 * @property {number} results.actionsExecuted - Total actions taken
 * @property {number} results.duration - Execution time (ms)
 * 
 * @throws {401} Unauthorized - Not authenticated or not agent owner
 * @throws {404} Agent not found
 * @throws {500} Benchmark execution failed
 * 
 * @example
 * ```typescript
 * // Run single benchmark
 * const response = await fetch(`/api/agents/${agentId}/benchmark`, {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     benchmarkPath: '/benchmarks/benchmark-123.json',
 *     outputDir: '/benchmark-results/agent-1'
 *   })
 * });
 * const { results } = await response.json();
 * 
 * // Run multiple for statistical significance
 * const multi = await fetch(`/api/agents/${agentId}/benchmark`, {
 *   method: 'POST',
 *   body: JSON.stringify({
 *     benchmarkPath: '/benchmarks/benchmark-123.json',
 *     runs: 5
 *   })
 * });
 * ```
 * 
 * @see {@link /scripts/run-eliza-benchmark.ts} CLI benchmark runner
 * @see {@link /src/lib/benchmark/SimulationEngine.ts} Simulation engine
 * @see {@link /src/lib/agents/autonomous/AutonomousCoordinator.ts} Autonomous coordinator
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/server-auth'
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager'
import { SimulationEngine, type SimulationConfig, type SimulationResult } from '@/lib/benchmark/SimulationEngine'
import { SimulationA2AInterface } from '@/lib/benchmark/SimulationA2AInterface'
import { AutonomousCoordinator } from '@/lib/agents/autonomous/AutonomousCoordinator'
import type { BenchmarkGameSnapshot } from '@/lib/benchmark/BenchmarkDataGenerator'
import { MetricsVisualizer } from '@/lib/benchmark/MetricsVisualizer'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'
import { promises as fs } from 'fs'
import * as path from 'path'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const startTime = Date.now()
  const { agentId } = await params
  
  logger.info('Agent benchmark endpoint hit', { agentId }, 'AgentBenchmark')
  
  // Authenticate
  const user = await authenticateUser(req)
  
  // Verify agent ownership
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      isAgent: true,
      username: true,
      autonomousTrading: true,
      autonomousPosting: true,
      autonomousCommenting: true,
      managedBy: true,
    }
  })
  
  if (!agent) {
    return NextResponse.json(
      { success: false, error: 'Agent not found' },
      { status: 404 }
    )
  }
  
  if (!agent.isAgent) {
    return NextResponse.json(
      { success: false, error: 'User is not an agent' },
      { status: 400 }
    )
  }
  
  if (agent.managedBy !== user.id) {
    return NextResponse.json(
      { success: false, error: 'Not authorized to benchmark this agent' },
      { status: 403 }
    )
  }
  
  // Parse request body
  const body = await req.json() as {
    benchmarkPath?: string
    benchmarkData?: unknown
    runs?: number
    outputDir?: string
  }
  
  const runs = body.runs || 1
  const outputDir = body.outputDir || `/tmp/benchmark-results/${agentId}/${Date.now()}`
  
  logger.info('Starting agent benchmark', {
    agentId,
    username: agent.username,
    runs,
    hasBenchmarkPath: !!body.benchmarkPath,
    hasBenchmarkData: !!body.benchmarkData
  }, 'AgentBenchmark')
  
  try {
    // Load benchmark snapshot
    let snapshot
    if (body.benchmarkData) {
      snapshot = body.benchmarkData
    } else if (body.benchmarkPath) {
      // Resolve path (support both absolute and relative)
      const fullPath = body.benchmarkPath.startsWith('/')
        ? body.benchmarkPath
        : path.join(process.cwd(), body.benchmarkPath)
      
      const data = await fs.readFile(fullPath, 'utf-8')
      snapshot = JSON.parse(data)
    } else {
      return NextResponse.json(
        { success: false, error: 'Either benchmarkPath or benchmarkData required' },
        { status: 400 }
      )
    }
    
    logger.info('Benchmark loaded', {
      id: snapshot.id,
      ticks: snapshot.ticks?.length || 0
    }, 'AgentBenchmark')
    
    // Run single or multiple benchmarks
    if (runs === 1) {
      const result = await runSingleBenchmark(agentId, snapshot, outputDir)
      
      return NextResponse.json({
        success: true,
        runs: 1,
        results: {
          totalPnl: result.metrics.totalPnl,
          predictionAccuracy: result.metrics.predictionMetrics.accuracy,
          perpWinRate: result.metrics.perpMetrics.winRate,
          optimalityScore: result.metrics.optimalityScore,
          actionsExecuted: result.actions.length,
          duration: Date.now() - startTime,
          outputDir
        }
      })
    } else {
      const results: SimulationResult[] = []
      
      for (let i = 0; i < runs; i++) {
        logger.info(`Running benchmark ${i + 1}/${runs}`, { agentId }, 'AgentBenchmark')
        const result = await runSingleBenchmark(
          agentId,
          snapshot,
          path.join(outputDir, `run-${i + 1}`)
        )
        results.push(result)
      }
      
      // Calculate aggregate statistics
      const avgPnl = results.reduce((sum, r) => sum + r.metrics.totalPnl, 0) / runs
      const avgAccuracy = results.reduce((sum, r) => sum + r.metrics.predictionMetrics.accuracy, 0) / runs
      const avgOptimality = results.reduce((sum, r) => sum + r.metrics.optimalityScore, 0) / runs
      const avgActions = results.reduce((sum, r) => sum + r.actions.length, 0) / runs
      
      // Generate comparison visualization
      await MetricsVisualizer.visualizeComparison(
        {
          runs: results,
          comparison: {
            avgPnl,
            avgAccuracy,
            avgOptimality,
            bestRun: results.reduce((best, curr) => 
              curr.metrics.totalPnl > best.metrics.totalPnl ? curr : best
            ).id,
            worstRun: results.reduce((worst, curr) =>
              curr.metrics.totalPnl < worst.metrics.totalPnl ? curr : worst
            ).id
          }
        },
        {
          outputDir,
          generateHtml: true,
          generateCsv: true,
          generateCharts: false
        }
      )
      
      return NextResponse.json({
        success: true,
        runs,
        results: {
          avgPnl,
          avgAccuracy,
          avgOptimality,
          avgActions,
          duration: Date.now() - startTime,
          outputDir
        }
      })
    }
  } catch (error) {
    logger.error('Benchmark execution failed', {
      agentId,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 'AgentBenchmark')
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Benchmark execution failed'
      },
      { status: 500 }
    )
  }
}

async function runSingleBenchmark(
  agentId: string,
  snapshot: unknown,
  outputDir: string
): Promise<SimulationResult> {
  logger.info('Starting single benchmark run', { agentId }, 'AgentBenchmark')
  
  // Get agent runtime (initializes if needed)
  const runtime = await agentRuntimeManager.getRuntime(agentId)
  
  // Type assertion for snapshot - cast to proper type
  const typedSnapshot = snapshot as BenchmarkGameSnapshot
  
  // Create simulation engine
  const simConfig: SimulationConfig = {
    snapshot: typedSnapshot,
    agentId,
    fastForward: true,
    responseTimeout: 30000
  }
  
  const engine = new SimulationEngine(simConfig);
  
  // Create A2A interface and inject into runtime
  const a2aInterface = new SimulationA2AInterface(engine, agentId);
  // Extend runtime with simulation A2A interface
  (runtime as { a2aClient?: unknown }).a2aClient = a2aInterface
  
  logger.info('Runtime and A2A interface initialized', { agentId }, 'AgentBenchmark')
  
  // Initialize simulation
  engine.initialize()
  
  // Create autonomous coordinator
  const coordinator = new AutonomousCoordinator()
  
  // Run simulation with autonomous ticks
  const totalTicks = typedSnapshot.ticks.length
  logger.info('Starting simulation loop', { agentId, totalTicks }, 'AgentBenchmark')
  
  while (!engine.isComplete()) {
    const currentTick = engine.getCurrentTickNumber()
    
    logger.debug(`Autonomous tick ${currentTick + 1}/${totalTicks}`, { agentId }, 'AgentBenchmark')
    
    // Execute autonomous tick (agent makes decisions via A2A)
    await coordinator.executeAutonomousTick(agentId, runtime)
      .then((tickResult) => {
        logger.debug('Tick result', {
          agentId,
          success: tickResult.success,
          actionsExecuted: tickResult.actionsExecuted,
          method: tickResult.method
        }, 'AgentBenchmark')
      })
      .catch((error: Error) => {
        logger.error('Tick execution error', {
          agentId,
          error: error.message,
          tick: currentTick
        }, 'AgentBenchmark')
        // Continue to next tick even if this one failed
      })
    
    // Advance simulation tick
    engine.advanceTick()
  }
  
  logger.info('Simulation loop complete', { agentId, totalTicks }, 'AgentBenchmark')
  
  // Calculate final results
  const result = await engine.run()
  
  // Save results to output directory
  await fs.mkdir(outputDir, { recursive: true })
  
  const resultPath = path.join(outputDir, 'result.json')
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2))
  
  const metricsPath = path.join(outputDir, 'metrics.json')
  await fs.writeFile(metricsPath, JSON.stringify(result.metrics, null, 2))
  
  // Generate HTML visualization
  await MetricsVisualizer.visualizeSingleRun(result, {
    outputDir,
    generateHtml: true,
    generateCsv: true,
    generateCharts: false
  })
  
  logger.info('Benchmark completed', {
    agentId,
    totalPnl: result.metrics.totalPnl,
    accuracy: result.metrics.predictionMetrics.accuracy,
    optimalityScore: result.metrics.optimalityScore
  }, 'AgentBenchmark')
  
  return result
}

