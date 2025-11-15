/**
 * Ensure Test Agents Exist
 * 
 * Creates test agents with trading personalities if they don't exist.
 * These agents are used for benchmarking autonomous trading performance.
 */

import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import { ethers } from 'ethers';

interface TestAgentConfig {
  username: string;
  displayName: string;
  agentSystem: string;
  autonomousTrading: boolean;
  autonomousPosting: boolean;
  autonomousCommenting: boolean;
}

const TEST_AGENT_CONFIGS: TestAgentConfig[] = [
  {
    username: 'trader-aggressive',
    displayName: 'Aggressive Trader',
    agentSystem: `You are an aggressive trader on Babylon prediction markets. You love taking risks, making bold predictions, and executing trades frequently. You analyze market sentiment, price movements, and news to make quick trading decisions. You're confident in your abilities and enjoy the thrill of trading. You actively participate in perpetual markets and prediction markets, always looking for opportunities to profit.`,
    autonomousTrading: true,
    autonomousPosting: true,
    autonomousCommenting: true,
  },
  {
    username: 'trader-conservative',
    displayName: 'Conservative Trader',
    agentSystem: `You are a conservative trader on Babylon prediction markets. You prefer careful analysis and only trade when you have high confidence. You study market trends, analyze sentiment data, and consider all factors before making a trade. You're patient and methodical, focusing on consistent gains rather than high-risk bets. You participate in both prediction and perpetual markets with a balanced approach.`,
    autonomousTrading: true,
    autonomousPosting: true,
    autonomousCommenting: false,
  },
  {
    username: 'trader-social',
    displayName: 'Social Trader',
    agentSystem: `You are a social trader on Babylon prediction markets. You love chatting with other traders, sharing insights, and learning from the community. You make trading decisions based on both your own analysis and community sentiment. You're active in posting your thoughts, commenting on others' predictions, and participating in market discussions. You enjoy the social aspect of trading as much as the financial gains.`,
    autonomousTrading: true,
    autonomousPosting: true,
    autonomousCommenting: true,
  },
];

async function ensureTestAgent(config: TestAgentConfig, index: number, total: number): Promise<string> {
  console.log(`\n[${index + 1}/${total}] Checking ${config.displayName}...`);
  
  // Check if agent already exists
  let agent = await prisma.user.findFirst({
    where: {
      isAgent: true,
      username: config.username,
    },
  });

  if (agent) {
    console.log(`     ✅ Already exists (ID: ${agent.id.substring(0, 12)}...)`);
    
    // Update configuration if changed
    console.log(`     🔄 Updating configuration...`);
    await prisma.user.update({
      where: { id: agent.id },
      data: {
        displayName: config.displayName,
        agentSystem: config.agentSystem,
        autonomousTrading: config.autonomousTrading,
        autonomousPosting: config.autonomousPosting,
        autonomousCommenting: config.autonomousCommenting,
        virtualBalance: 10000,
        agentPointsBalance: 10000,
        updatedAt: new Date(),
      },
    });
    console.log(`     ✅ Configuration updated`);
    
    return agent.id;
  }

  // Create new agent
  console.log(`     🆕 Creating new agent...`);
  const agentId = await generateSnowflakeId();
  const wallet = ethers.Wallet.createRandom();
  
  agent = await prisma.user.create({
    data: {
      id: agentId,
      privyId: `did:privy:test-${agentId}`,
      username: config.username,
      displayName: config.displayName,
      walletAddress: wallet.address,
      isAgent: true,
      autonomousTrading: config.autonomousTrading,
      autonomousPosting: config.autonomousPosting,
      autonomousCommenting: config.autonomousCommenting,
      agentSystem: config.agentSystem,
      agentModelTier: 'lite',
      virtualBalance: 10000, // Starting capital
      reputationPoints: 1000,
      agentPointsBalance: 10000, // Enough for many ticks
      isTest: true,
      updatedAt: new Date(),
    },
  });

  console.log(`     ✅ Created (ID: ${agent.id.substring(0, 12)}...)`);
  console.log(`     💰 Balance: $${agent.virtualBalance}`);
  console.log(`     ⚡ Points: ${agent.agentPointsBalance}`);
  
  return agent.id;
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 TEST AGENT SETUP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Setting up ${TEST_AGENT_CONFIGS.length} test agents for benchmarking...`);

  const startTime = Date.now();
  const agentIds: string[] = [];

  for (let i = 0; i < TEST_AGENT_CONFIGS.length; i++) {
    const config = TEST_AGENT_CONFIGS[i]!;
    const agentId = await ensureTestAgent(config, i, TEST_AGENT_CONFIGS.length);
    agentIds.push(agentId);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ COMPLETE (${duration}s)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('📋 Test Agents Ready:\n');
  agentIds.forEach((id, i) => {
    const config = TEST_AGENT_CONFIGS[i]!;
    console.log(`   ${i + 1}. ${config.displayName.padEnd(20)} ${id}`);
  });
  
  console.log('\n💡 Next Steps:');
  console.log('   Run baseline benchmarks with:');
  console.log(`   bun run scripts/run-baseline-benchmarks.ts --benchmark=benchmarks/benchmark-week-10080-60-10-5-8-12345.json\n`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ ERROR:', error.message);
  console.error(error);
  process.exit(1);
});

