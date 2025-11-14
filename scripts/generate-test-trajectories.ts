/**
 * Generate Test Trajectories
 * 
 * Creates 20 realistic test trajectories to validate the complete system.
 * Tests recording, storage, export, and ART format conversion.
 */

import { prisma } from '../src/lib/prisma';
import { trajectoryRecorder } from '../src/lib/training/TrajectoryRecorder';
import { generateSnowflakeId } from '../src/lib/snowflake';

async function main() {
  console.log('\n🧪 GENERATING TEST TRAJECTORIES\n');
  console.log('='.repeat(60) + '\n');

  // Step 1: Ensure test agent exists
  console.log('📊 Step 1: Creating test agent...\n');
  
  let testAgent = await prisma.user.findFirst({
    where: { username: 'rl-test-agent' }
  });

  if (!testAgent) {
    testAgent = await prisma.user.create({
      data: {
        id: await generateSnowflakeId(),
        username: 'rl-test-agent',
        displayName: 'RL Test Agent',
        isAgent: true,
        isTest: true,
        agentSystem: 'You are a sophisticated trading agent with a momentum-based strategy. You analyze prediction markets carefully and make data-driven decisions while managing risk.',
        agentModelTier: 'pro',
        virtualBalance: 10000,
        reputationPoints: 1000,
        autonomousTrading: true,
        autonomousPosting: true,
        autonomousCommenting: true,
        updatedAt: new Date(),
      }
    });
    console.log(`  ✅ Created test agent: ${testAgent.id}\n`);
  } else {
    console.log(`  ✅ Using existing agent: ${testAgent.id}\n`);
  }

  // Step 2: Generate 20 diverse trajectories
  console.log('📊 Step 2: Generating 20 test trajectories...\n');

  const scenarios = [
    'trading-bullish-market',
    'trading-bearish-market',
    'social-engagement',
    'risk-management',
    'position-taking'
  ];

  const createdTrajectories = [];

  for (let i = 0; i < 20; i++) {
    const scenarioId = scenarios[i % scenarios.length]!;
    const windowId = `2025-01-15T${String(10 + Math.floor(i / 4)).padStart(2, '0')}:00`;
    
    console.log(`  ${i + 1}/20: Creating trajectory for ${scenarioId}...`);

    const trajId = await trajectoryRecorder.startTrajectory({
      agentId: testAgent.id,
      scenarioId,
      windowId,
      metadata: {
        test: true,
        batchGenerated: true,
        index: i
      }
    });

    // Generate 1-3 steps per trajectory
    const numSteps = 1 + Math.floor(Math.random() * 3);

    for (let step = 0; step < numSteps; step++) {
      const balance = 1000 - (i * 50) - (step * 20);
      const pnl = 50 + (i * 2) - (step * 5);

      trajectoryRecorder.startStep(trajId, {
        agentBalance: balance,
        agentPnL: pnl,
        openPositions: Math.floor(Math.random() * 5),
        activeMarkets: 20 + Math.floor(Math.random() * 10),
        timestamp: Date.now() + step * 5000
      });

      // Provider accesses
      if (scenarioId.includes('trading')) {
        trajectoryRecorder.logProviderAccess(trajId, {
          providerName: 'BABYLON_MARKETS',
          data: {
            markets: [{
              id: `btc-test-${i}`,
              question: `Test prediction ${i}`,
              yesShares: 300 + Math.random() * 400,
              noShares: 700 - Math.random() * 400,
              liquidity: 1000
            }]
          },
          purpose: 'Get current market prices for trading decision'
        });

        trajectoryRecorder.logProviderAccess(trajId, {
          providerName: 'BABYLON_PORTFOLIO',
          data: {
            balance,
            positions: [],
            pnl
          },
          purpose: 'Check portfolio before trading'
        });
      } else if (scenarioId.includes('social')) {
        trajectoryRecorder.logProviderAccess(trajId, {
          providerName: 'SOCIAL_FEED',
          data: {
            recentPosts: [
              { content: 'Market analysis post', engagement: 45 }
            ]
          },
          purpose: 'Get feed context'
        });
      }

      // LLM call
      const actionTypes = ['BUY_SHARES', 'SELL_SHARES', 'CREATE_POST', 'COMMENT'];
      const actionType = actionTypes[Math.floor(Math.random() * actionTypes.length)]!;

      trajectoryRecorder.logLLMCall(trajId, {
        model: 'llama-3.1-8b',
        systemPrompt: testAgent.agentSystem || 'You are a trading agent.',
        userPrompt: `Current state: Balance $${balance}, P&L $${pnl}, ${Math.floor(Math.random() * 5)} positions. ${scenarioId}. What should you do?`,
        response: `I will ${actionType.toLowerCase().replace('_', ' ')} because ${['momentum is strong', 'risk management', 'opportunity detected', 'taking profits'][Math.floor(Math.random() * 4)]}.`,
        reasoning: `Market analysis shows ${['bullish signals', 'bearish trend', 'consolidation', 'volatility'][Math.floor(Math.random() * 4)]}`,
        temperature: 0.8,
        maxTokens: 200,
        latencyMs: 200 + Math.random() * 200,
        purpose: 'action',
        actionType
      });

      // Action
      const success = Math.random() > 0.1; // 90% success rate
      const reward = success ? (Math.random() * 2) : -(Math.random() * 0.5);

      trajectoryRecorder.completeStep(trajId, {
        actionType,
        parameters: {
          marketId: `test-${i}`,
          amount: 100 + Math.random() * 200
        },
        success,
        result: success ? {
          shares: 90 + Math.random() * 10,
          avgPrice: 1 + Math.random() * 0.1
        } : undefined,
        error: success ? undefined : 'Insufficient balance',
        reasoning: 'Expected value positive'
      }, reward);
    }

    // End trajectory with varied outcomes
    const finalBalance = 1000 - (i * 50);
    const finalPnL = 50 + (i * 3) - (Math.random() * 20);

    await trajectoryRecorder.endTrajectory(trajId, {
      finalBalance,
      finalPnL,
      windowId,
      gameKnowledge: {
        trueProbabilities: {
          [`test-${i}`]: 0.5 + (Math.random() * 0.4) - 0.2
        },
        actualOutcomes: {
          [`test-${i}`]: Math.random() > 0.5 ? 'YES' : 'NO'
        }
      }
    });

    createdTrajectories.push(trajId);
  }

  console.log(`\n  ✅ Created ${createdTrajectories.length} trajectories\n`);

  // Step 3: Validate created data
  console.log('='.repeat(60));
  console.log('📊 Step 3: Validating generated data...\n');

  const prismaExt = prisma as any;
  const count = await prismaExt.trajectory.count({
    where: {
      agentId: testAgent.id
    }
  });

  console.log(`  Total trajectories for test agent: ${count}`);

  const stats = await prismaExt.trajectory.aggregate({
    where: { agentId: testAgent.id },
    _avg: {
      episodeLength: true,
      totalReward: true,
      durationMs: true
    }
  });

  console.log(`  Average steps: ${stats._avg.episodeLength?.toFixed(1)}`);
  console.log(`  Average reward: ${stats._avg.totalReward?.toFixed(2)}`);
  console.log(`  Average duration: ${(stats._avg.durationMs / 1000).toFixed(1)}s`);

  const llmCount = await prisma.llmCallLog.count({
    where: {
      trajectoryId: { in: createdTrajectories }
    }
  });

  console.log(`  LLM calls logged: ${llmCount}\n`);

  // Step 4: Show sample
  console.log('='.repeat(60));
  console.log('📊 Step 4: Sample trajectory...\n');

  const sample = await prismaExt.trajectory.findFirst({
    where: { trajectoryId: createdTrajectories[0] }
  });

  if (sample) {
    const steps = JSON.parse(sample.stepsJson);
    console.log(`  Trajectory: ${sample.trajectoryId.substring(0, 12)}...`);
    console.log(`  Steps: ${steps.length}`);
    console.log(`  LLM calls: ${steps.reduce((s: number, st: any) => s + st.llmCalls.length, 0)}`);
    console.log(`  Provider accesses: ${steps.reduce((s: number, st: any) => s + st.providerAccesses.length, 0)}`);
    console.log(`  Actions: ${steps.map((s: any) => s.action.actionType).join(', ')}`);
    console.log(`  Reward: ${sample.totalReward}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ TEST DATA GENERATION COMPLETE!');
  console.log('='.repeat(60) + '\n');

  console.log('Next steps:');
  console.log('  1. Run: npx tsx scripts/validate-system-simple.ts');
  console.log('  2. Test export: npm run test:export');
  console.log('  3. Integrate with agents');
  console.log('');

  await prisma.$disconnect();
}

main().catch(error => {
  console.error('\n❌ ERROR:', error);
  process.exit(1);
});



