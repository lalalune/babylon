#!/usr/bin/env tsx
/**
 * RL Harness
 * ==========
 * Seeds deterministic benchmark runs for a cohort of test agents,
 * ensures trajectories are recorded, and optionally triggers the
 * AutomationPipeline to export + train on the collected data.
 *
 * Usage:
 *   bun run rl:harness --agents=5 --ticks=5 --runs=1 --train --force
 */

import path from 'node:path'
import fs from 'node:fs/promises'

import { BenchmarkDataGenerator, type BenchmarkConfig } from '@/lib/benchmark/BenchmarkDataGenerator'
import { BenchmarkRunner } from '@/lib/benchmark/BenchmarkRunner'
import type { SimulationResult } from '@/lib/benchmark/SimulationEngine'
import { agentRuntimeManager } from '@/lib/agents/runtime/AgentRuntimeManager'
import { agentWalletService } from '@/lib/agents/identity/AgentWalletService'
import { automationPipeline } from '@/lib/training/AutomationPipeline'
import { getLatestRLModel } from '@/lib/training/WandbModelFetcher'
import { prisma } from '@/lib/prisma'

type HarnessOptions = {
  agentCount: number
  ticks: number
  runsPerAgent: number
  saveTrajectories: boolean
  triggerTraining: boolean
  forceTraining: boolean
}

const DEFAULT_OPTIONS: HarnessOptions = {
  agentCount: 5,
  ticks: 5,
  runsPerAgent: 1,
  saveTrajectories: true,
  triggerTraining: false,
  forceTraining: false
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function parseArgs(): HarnessOptions {
  const args = process.argv.slice(2)
  const opts: Partial<HarnessOptions> = {}

  for (const arg of args) {
    if (arg.startsWith('--agents=')) {
      opts.agentCount = parseInt(arg.split('=')[1]!, 10)
    } else if (arg.startsWith('--ticks=')) {
      opts.ticks = parseInt(arg.split('=')[1]!, 10)
    } else if (arg.startsWith('--runs=')) {
      opts.runsPerAgent = parseInt(arg.split('=')[1]!, 10)
    } else if (arg === '--no-save') {
      opts.saveTrajectories = false
    } else if (arg === '--train') {
      opts.triggerTraining = true
    } else if (arg === '--force') {
      opts.forceTraining = true
    }
  }

  return {
    ...DEFAULT_OPTIONS,
    ...opts
  }
}

async function ensureHarnessManager(): Promise<string> {
  const managerId = 'rl-harness-manager'
  await prisma.user.upsert({
    where: { id: managerId },
    update: {},
    create: {
      id: managerId,
      username: 'rl_harness_manager',
      displayName: 'RL Harness Manager',
      isAgent: false,
      reputationPoints: 0,
      profileComplete: true,
      updatedAt: new Date()
    }
  })
  return managerId
}

async function ensureHarnessAgents(count: number, managerId: string): Promise<string[]> {
  const agentIds: string[] = []
  for (let i = 0; i < count; i++) {
    const agentId = `rl-harness-agent-${i}`
    agentIds.push(agentId)

    await prisma.user.upsert({
      where: { id: agentId },
      update: {
        managedBy: managerId,
        isAgent: true,
        agentPointsBalance: { increment: 5 }
      },
      create: {
        id: agentId,
        username: `rl_harness_agent_${i}`,
        displayName: `RL Harness Agent ${i}`,
        isAgent: true,
        managedBy: managerId,
        agentSystem: 'You are a disciplined Babylon trading agent focused on benchmark evaluation.',
        agentModelTier: 'standard',
        agentPointsBalance: 5,
        profileComplete: true,
        updatedAt: new Date()
      }
    })

    const agentRecord = await prisma.user.findUnique({
      where: { id: agentId },
      select: { walletAddress: true }
    })

    if (!agentRecord?.walletAddress && process.env.AUTO_CREATE_AGENT_WALLETS !== 'false') {
      try {
        await agentWalletService.createAgentEmbeddedWallet(agentId)
      } catch (error) {
        console.warn(`⚠️  Failed to auto-provision wallet for ${agentId}:`, error)
      }
    }
  }
  return agentIds
}

async function generateSnapshot(ticks: number): Promise<{ snapshotPath: string; scenarioId: string }> {
  const generatorConfig: BenchmarkConfig = {
    durationMinutes: Math.max(1, Math.ceil((ticks * 10) / 60)),
    tickInterval: 10,
    numPredictionMarkets: 5,
    numPerpetualMarkets: 2,
    numAgents: 5,
    seed: Date.now()
  }

  const generator = new BenchmarkDataGenerator(generatorConfig)
  const snapshot = await generator.generate()

  const benchmarkDir = path.resolve(process.cwd(), 'benchmarks')
  await fs.mkdir(benchmarkDir, { recursive: true })
  const snapshotPath = path.join(benchmarkDir, `rl-harness-${snapshot.id}.json`)
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2))

  return { snapshotPath, scenarioId: `benchmark-${snapshot.id}` }
}

async function runBenchmark(agentId: string, snapshotPath: string, runIndex: number, saveTrajectory: boolean): Promise<SimulationResult> {
  const runtime = await agentRuntimeManager.getRuntime(agentId)
  const outputDir = path.join(process.cwd(), 'benchmark-results', 'harness', agentId, `run-${runIndex}`)

  return BenchmarkRunner.runSingle({
    benchmarkPath: snapshotPath,
    agentRuntime: runtime,
    agentUserId: agentId,
    saveTrajectory,
    outputDir
  })
}

async function summarizeTrajectories(agentIds: string[], scenarioId: string, runStartedAt: Date) {
  const trajectories = await prisma.trajectory.findMany({
    where: {
      agentId: { in: agentIds },
      scenarioId,
      createdAt: { gte: runStartedAt }
    },
    orderBy: { createdAt: 'desc' }
  })

  console.log(`\n📦 Stored ${trajectories.length} trajectories for scenario ${scenarioId}`)
  return trajectories.length
}

async function maybeTriggerTraining(force: boolean) {
  console.log('\n🚀 Triggering AutomationPipeline training job...')
  const result = await automationPipeline.triggerTraining({ force })
  if (!result.success || !result.jobId) {
    console.log(`⚠️  Training not started: ${result.error || 'Unknown reason'}`)
    return
  }

  console.log(`🧵 Training job queued (batch: ${result.jobId})`)

  for (let i = 0; i < 12; i++) {
    await sleep(5000)
    const status = await automationPipeline.monitorTraining(result.jobId)
    console.log(`   • Status: ${status.status}${status.progress ? ` (${Math.round(status.progress * 100)}%)` : ''}`)

    if (status.status === 'completed' || status.status === 'failed' || status.status === 'not_found') {
      break
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is required to run the RL harness.')
    process.exit(1)
  }

  const options = parseArgs()
  const runStartedAt = new Date()

  console.log('╔════════════════════════════════════════════════════════╗')
  console.log('║           RL BENCHMARK HARNESS (SERVERLESS)            ║')
  console.log('╚════════════════════════════════════════════════════════╝\n')
  console.log(`Agents: ${options.agentCount}`)
  console.log(`Ticks per run: ${options.ticks}`)
  console.log(`Runs per agent: ${options.runsPerAgent}`)
  console.log(`Save trajectories: ${options.saveTrajectories}`)
  console.log(`Trigger training: ${options.triggerTraining} (force=${options.forceTraining})\n`)

  const managerId = await ensureHarnessManager()
  const agentIds = await ensureHarnessAgents(options.agentCount, managerId)
  const { snapshotPath, scenarioId } = await generateSnapshot(options.ticks)

  const readinessBefore = await automationPipeline.checkTrainingReadiness()
  console.log('📊 Readiness before harness:', readinessBefore)

  for (const agentId of agentIds) {
    console.log(`\n🎯 Running benchmarks for ${agentId}`)
    for (let run = 1; run <= options.runsPerAgent; run++) {
      try {
        const result = await runBenchmark(agentId, snapshotPath, run, options.saveTrajectories)
        console.log(`   Run ${run}: PnL=${result.metrics.totalPnl.toFixed(2)} | accuracy=${(result.metrics.predictionMetrics.accuracy * 100).toFixed(1)}% | optimality=${result.metrics.optimalityScore.toFixed(1)}`)
      } catch (error) {
        console.error(`   ❌ Run ${run} failed`, error)
      }
    }
  }

  const storedCount = await summarizeTrajectories(agentIds, scenarioId, runStartedAt)

  if (options.saveTrajectories && storedCount === 0) {
    console.warn('⚠️  No trajectories were stored; check database connectivity and schema.')
  }

  if (options.triggerTraining) {
    await maybeTriggerTraining(options.forceTraining)
  }

  const readinessAfter = await automationPipeline.checkTrainingReadiness()
  console.log('\n📊 Readiness after harness:', readinessAfter)

  const latestModel = await getLatestRLModel()
  if (latestModel) {
    console.log(`\n🏁 Latest RL model: ${latestModel.version} (avgReward=${latestModel.metadata.avgReward ?? 'n/a'})`)
  } else {
    console.log('\nℹ️  No RL models have been registered yet.')
  }

  await prisma.$disconnect()
  console.log('\n✅ Harness run complete')
}

main().catch(async (error) => {
  console.error('\n❌ Harness failed:', error)
  await prisma.$disconnect()
  process.exit(1)
})

