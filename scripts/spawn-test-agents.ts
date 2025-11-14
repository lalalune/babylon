/**
 * Spawn Test Agents for RL Training
 * 
 * Creates 5+ simultaneous agents running in the same time window.
 * This generates training data for GRPO comparison.
 * 
 * Usage:
 *   npx tsx scripts/spawn-test-agents.ts
 *   npx tsx scripts/spawn-test-agents.ts --agents=8 --duration=10
 */

import { trajectoryRecorder } from '@/lib/training/TrajectoryRecorder';
import { prisma } from '@/lib/prisma';

interface AgentStrategy {
  name: string;
  riskTolerance: number;  // 0-1
  tradeFrequency: number; // actions per window
  preferredAssets: string[];
}

const STRATEGIES: AgentStrategy[] = [
  {
    name: 'conservative',
    riskTolerance: 0.2,
    tradeFrequency: 5,
    preferredAssets: ['$BTC', '$ETH']
  },
  {
    name: 'balanced',
    riskTolerance: 0.5,
    tradeFrequency: 10,
    preferredAssets: ['$BTC', '$ETH', '$SOL']
  },
  {
    name: 'aggressive',
    riskTolerance: 0.8,
    tradeFrequency: 15,
    preferredAssets: ['$BTC', '$ETH', '$SOL', '$DOGE']
  },
  {
    name: 'momentum',
    riskTolerance: 0.7,
    tradeFrequency: 12,
    preferredAssets: ['$TRUMP', '$PEPE', '$WIF']
  },
  {
    name: 'contrarian',
    riskTolerance: 0.4,
    tradeFrequency: 8,
    preferredAssets: ['$BTC', '$SOL']
  }
];

/**
 * Create or get a test user
 */
async function ensureTestUser(agentNum: number): Promise<string> {
  const userId = `test-agent-${agentNum}`;
  
  // Check if user exists
  const existing = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (existing) {
    return userId;
  }
  
  // Create test user
  await prisma.user.create({
    data: {
      id: userId,
      username: `test_agent_${agentNum}`,
      displayName: `Test Agent ${agentNum}`,
      isAgent: true,
      isActor: false,
      profileComplete: true,
      isTest: true,
      updatedAt: new Date()
    }
  });
  
  return userId;
}

/**
 * Simulate one agent's behavior for a time window
 */
async function simulateAgent(
  agentNum: number,
  strategy: AgentStrategy,
  windowId: string,
  durationMinutes: number = 60
): Promise<{
  trajectoryId: string;
  agentId: string;
  finalPnL: number;
  tradesExecuted: number;
}> {
  // Ensure user exists in database
  const agentId = await ensureTestUser(agentNum);
  
  console.log(`Starting agent ${agentNum} (${strategy.name}) for window ${windowId}`);
  
  // Start trajectory
  const trajectoryId = await trajectoryRecorder.startTrajectory({
    agentId,
    windowId,
    scenarioId: windowId
  });

  let balance = 10000;
  let pnl = 0;
  let tradesExecuted = 0;
  const startTime = Date.now();

  // Simulate trading for the window duration
  while ((Date.now() - startTime) / (1000 * 60) < durationMinutes) {
    // Start new step
    trajectoryRecorder.startStep(trajectoryId, {
      agentBalance: balance,
      agentPnL: pnl,
      openPositions: Math.floor(Math.random() * 5),
      activeMarkets: 10 + Math.floor(Math.random() * 20)
    });

    // Simulate market data access
    const ticker = strategy.preferredAssets[Math.floor(Math.random() * strategy.preferredAssets.length)]!;
    const currentPrice = 100 + Math.random() * 50;
    
    trajectoryRecorder.logProviderAccess(trajectoryId, {
      providerName: 'market_data',
      data: {
        ticker,
        price: currentPrice,
        volume: 100000 + Math.random() * 900000,
        sentiment: Math.random() > 0.5 ? 'BULLISH' : 'BEARISH'
      },
      purpose: 'get_market_data'
    });

    // Simulate LLM decision
    const shouldTrade = Math.random() < (strategy.tradeFrequency / 60); // Normalized to per-minute
    const action = shouldTrade
      ? (Math.random() > 0.5 ? 'BUY_SHARES' : 'SELL_SHARES')
      : 'HOLD';

    trajectoryRecorder.logLLMCall(trajectoryId, {
      model: 'gpt-4o-mini',
      systemPrompt: `You are a ${strategy.name} trading agent with risk tolerance ${strategy.riskTolerance}`,
      userPrompt: `Current price: ${ticker} at $${currentPrice.toFixed(2)}. Should you trade?`,
      response: action,
      reasoning: `Market sentiment and my ${strategy.name} strategy suggests: ${action}`,
      temperature: 0.7,
      maxTokens: 150,
      purpose: 'action',
      actionType: action
    });

    // Execute action
    if (shouldTrade) {
      const shares = 10 + Math.floor(Math.random() * 40);
      const tradePnL = (-50 + Math.random() * 150) * strategy.riskTolerance;
      
      pnl += tradePnL;
      balance += tradePnL;
      tradesExecuted++;

      trajectoryRecorder.completeStep(trajectoryId, {
        actionType: action,
        parameters: { ticker, shares, price: currentPrice },
        success: true,
        result: { executed: true, pnl: tradePnL },
        reasoning: `Executed ${action} based on ${strategy.name} strategy`
      }, tradePnL / 100); // Normalized reward
    } else {
      trajectoryRecorder.completeStep(trajectoryId, {
        actionType: 'HOLD',
        parameters: {},
        success: true,
        result: { held: true }
      }, 0);
    }

    // Wait a bit before next action
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
  }

  // End trajectory
  await trajectoryRecorder.endTrajectory(trajectoryId, {
    finalPnL: pnl,
    finalBalance: balance,
    windowId
  });

  console.log(`Agent ${agentNum} completed: P&L=$${pnl.toFixed(2)}, trades=${tradesExecuted}`);

  return {
    trajectoryId,
    agentId,
    finalPnL: pnl,
    tradesExecuted
  };
}

/**
 * Spawn simultaneous test agents
 */
async function spawnTestAgents(
  count: number = 5,
  durationMinutes: number = 5
): Promise<void> {
  const windowId = new Date().toISOString().slice(0, 13) + ":00";
  
  console.log('='.repeat(80));
  console.log('SPAWNING TEST AGENTS FOR RL TRAINING');
  console.log('='.repeat(80));
  console.log(`Window: ${windowId}`);
  console.log(`Agents: ${count}`);
  console.log(`Duration: ${durationMinutes} minutes`);
  console.log('='.repeat(80));
  console.log();

  const agents = Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    strategy: STRATEGIES[i % STRATEGIES.length]!
  }));

  console.log('Spawning agents:');
  agents.forEach(a => {
    console.log(`  Agent ${a.num}: ${a.strategy.name} (risk: ${a.strategy.riskTolerance})`);
  });
  console.log();

  const startTime = Date.now();
  
  const results = await Promise.all(
    agents.map(a => simulateAgent(a.num, a.strategy, windowId, durationMinutes))
  );

  const elapsedMinutes = (Date.now() - startTime) / (1000 * 60);

  console.log('\n' + '='.repeat(80));
  console.log('TEST AGENTS COMPLETED');
  console.log('='.repeat(80));
  console.log(`Time elapsed: ${elapsedMinutes.toFixed(1)} minutes\n`);

  console.log('Results:');
  const sorted = results.sort((a, b) => b.finalPnL - a.finalPnL);
  sorted.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.agentId}: P&L = $${r.finalPnL.toFixed(2)}, Trades = ${r.tradesExecuted}`);
  });

  console.log(`\nBest: ${sorted[0]!.agentId} (+$${sorted[0]!.finalPnL.toFixed(2)})`);
  console.log(`Worst: ${sorted[sorted.length - 1]!.agentId} ($${sorted[sorted.length - 1]!.finalPnL.toFixed(2)})`);

  console.log('\nNext steps:');
  console.log('  1. Run this script 2-3 more times');
  console.log('  2. Run: python scripts/check_windows.py');
  console.log('  3. Run: python scripts/train_mmo.py --min-agents 5');
  console.log();
}

/**
 * Main: Parse args and run
 */
async function main() {
  const args = process.argv.slice(2);
  const numAgents = parseInt(args.find(a => a.startsWith('--agents='))?.split('=')[1] || '5');
  const durationMinutes = parseInt(args.find(a => a.startsWith('--duration='))?.split('=')[1] || '5');
  
  await spawnTestAgents(numAgents, durationMinutes);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { spawnTestAgents, simulateAgent };

