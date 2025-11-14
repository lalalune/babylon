/**
 * Trajectory Data Verification Script
 * 
 * Run this to verify you're collecting all required data for RL training.
 * 
 * Usage:
 *   npx tsx scripts/verify-trajectory-data.ts
 *   npx tsx scripts/verify-trajectory-data.ts --trajectory-id abc-123
 */

import { prisma } from '@/lib/prisma';

interface VerificationResult {
  overall: 'PASS' | 'FAIL' | 'WARN';
  checks: {
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
    details?: any;
  }[];
}

async function verifyDataCollection(trajectoryId?: string): Promise<VerificationResult> {
  const result: VerificationResult = {
    overall: 'PASS',
    checks: []
  };

  // Get trajectories
  const trajectories = trajectoryId
    ? [await prisma.trajectory.findUnique({ where: { trajectoryId } })]
    : await prisma.trajectory.findMany({
        where: {
          startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        orderBy: { startTime: 'desc' },
        take: 10
      });

    if (!trajectories || trajectories.length === 0 || !trajectories[0]) {
      result.checks.push({
        name: 'Trajectory Existence',
        status: 'FAIL',
        message: '❌ No trajectories found! Agent may not be recording.'
      });
      result.overall = 'FAIL';
      return result;
    }

    result.checks.push({
      name: 'Trajectory Existence',
      status: 'PASS',
      message: `✅ Found ${trajectories.length} trajectories`,
      details: { count: trajectories.length }
    });

    // Check each trajectory
    for (const traj of trajectories) {
      if (!traj) continue;
      
      const steps = JSON.parse(traj.stepsJson);
      const checkPrefix = `[${traj.trajectoryId.substring(0, 8)}]`;

      // Check 1: Has steps
      if (steps.length === 0) {
        result.checks.push({
          name: `${checkPrefix} Steps`,
          status: 'FAIL',
          message: '❌ No steps recorded!'
        });
        result.overall = 'FAIL';
        continue;
      }

      result.checks.push({
        name: `${checkPrefix} Steps`,
        status: 'PASS',
        message: `✅ ${steps.length} steps`
      });

      // Check 2: LLM calls
      const llmCallsTotal = steps.reduce((sum: number, s: any) => sum + (s.llmCalls?.length || 0), 0);
      if (llmCallsTotal === 0) {
        result.checks.push({
          name: `${checkPrefix} LLM Calls`,
          status: 'FAIL',
          message: '❌ No LLM calls recorded! Agent decisions not captured.'
        });
        result.overall = 'FAIL';
      } else {
        result.checks.push({
          name: `${checkPrefix} LLM Calls`,
          status: 'PASS',
          message: `✅ ${llmCallsTotal} LLM calls (avg ${(llmCallsTotal / steps.length).toFixed(1)} per step)`
        });

        // Check LLM call completeness
        const firstLLM = steps[0]?.llmCalls?.[0];
        if (firstLLM) {
          const llmIssues = [];
          if (!firstLLM.systemPrompt) llmIssues.push('systemPrompt');
          if (!firstLLM.userPrompt) llmIssues.push('userPrompt');
          if (!firstLLM.response) llmIssues.push('response');
          if (firstLLM.temperature === undefined) llmIssues.push('temperature');

          if (llmIssues.length > 0) {
            result.checks.push({
              name: `${checkPrefix} LLM Data Quality`,
              status: 'FAIL',
              message: `❌ LLM calls missing: ${llmIssues.join(', ')}`
            });
            result.overall = 'FAIL';
          } else {
            result.checks.push({
              name: `${checkPrefix} LLM Data Quality`,
              status: 'PASS',
              message: '✅ LLM calls complete'
            });
          }
        }
      }

      // Check 3: Provider accesses
      const providerTotal = steps.reduce((sum: number, s: any) => sum + (s.providerAccesses?.length || 0), 0);
      if (providerTotal === 0) {
        result.checks.push({
          name: `${checkPrefix} Provider Access`,
          status: 'WARN',
          message: '⚠️  No provider accesses - agent may be operating without context'
        });
        if (result.overall === 'PASS') result.overall = 'WARN';
      } else {
        result.checks.push({
          name: `${checkPrefix} Provider Access`,
          status: 'PASS',
          message: `✅ ${providerTotal} provider accesses (avg ${(providerTotal / steps.length).toFixed(1)} per step)`
        });
      }

      // Check 4: Actions
      const actionsWithResults = steps.filter((s: any) => s.action?.result || s.action?.error).length;
      if (actionsWithResults < steps.length) {
        result.checks.push({
          name: `${checkPrefix} Action Results`,
          status: 'WARN',
          message: `⚠️  ${steps.length - actionsWithResults} actions missing results`
        });
        if (result.overall === 'PASS') result.overall = 'WARN';
      } else {
        result.checks.push({
          name: `${checkPrefix} Action Results`,
          status: 'PASS',
          message: '✅ All actions have results'
        });
      }

      // Check 5: Environment state
      const stepsWithEnv = steps.filter((s: any) => s.environmentState).length;
      if (stepsWithEnv < steps.length) {
        result.checks.push({
          name: `${checkPrefix} Environment State`,
          status: 'FAIL',
          message: `❌ ${steps.length - stepsWithEnv} steps missing environment state`
        });
        result.overall = 'FAIL';
      } else {
        result.checks.push({
          name: `${checkPrefix} Environment State`,
          status: 'PASS',
          message: '✅ All steps have environment state'
        });
      }

      // Check 6: Rewards
      if (traj.aiJudgeReward === null) {
        result.checks.push({
          name: `${checkPrefix} Rewards`,
          status: 'WARN',
          message: '⚠️  No reward computed yet (run reward computation!)'
        });
      } else {
        result.checks.push({
          name: `${checkPrefix} Rewards`,
          status: 'PASS',
          message: `✅ Reward: ${traj.aiJudgeReward.toFixed(2)}`
        });
      }
    }

    return result;
}

async function generateReport() {
  console.log('========================================');
  console.log('Trajectory Data Verification Report');
  console.log('========================================\n');

  const trajectoryId = process.argv[2]?.replace('--trajectory-id=', '');
  const result = await verifyDataCollection(trajectoryId);

  for (const check of result.checks) {
    const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️ ' : '❌';
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (check.details) {
      console.log(`   Details: ${JSON.stringify(check.details)}`);
    }
  }

  console.log('\n========================================');
  console.log(`Overall Status: ${result.overall}`);
  console.log('========================================\n');

  if (result.overall === 'PASS') {
    console.log('🎉 Data collection looks good! Ready for training.\n');
  } else if (result.overall === 'WARN') {
    console.log('⚠️  Data collection has minor issues. Review warnings.\n');
  } else {
    console.log('❌ Data collection has critical issues! Fix before training.\n');
  }

  // Additional stats
  console.log('Additional Statistics:');
  
  const stats = await prisma.trajectory.aggregate({
    where: {
      startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    _count: true,
    _avg: {
      episodeLength: true,
      totalReward: true,
      durationMs: true
    }
  });

  console.log(`  Trajectories (24h): ${stats._count}`);
  console.log(`  Avg steps: ${stats._avg.episodeLength?.toFixed(1) || 0}`);
  console.log(`  Avg reward: ${stats._avg.totalReward?.toFixed(2) || 0}`);
  console.log(`  Avg duration: ${(stats._avg.durationMs || 0) / 1000}s`);

  const llmStats = await prisma.llmCallLog.aggregate({
    where: {
      timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    },
    _count: true,
    _avg: {
      latencyMs: true,
      promptTokens: true,
      completionTokens: true
    }
  });

  console.log(`\nLLM Call Statistics:`);
  console.log(`  Total calls: ${llmStats._count}`);
  console.log(`  Avg latency: ${llmStats._avg.latencyMs?.toFixed(0) || 0}ms`);
  console.log(`  Avg prompt tokens: ${llmStats._avg.promptTokens?.toFixed(0) || 0}`);
  console.log(`  Avg completion tokens: ${llmStats._avg.completionTokens?.toFixed(0) || 0}`);

  process.exit(result.overall === 'PASS' ? 0 : 1);
}

generateReport();

