/**
 * Seed Autonomous Agents
 * Creates initial autonomous agents for testing and demo purposes
 */

import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { generateSnowflakeId } from '../src/lib/snowflake';

const AGENT_TEMPLATES = [
  {
    name: 'Alpha Trader',
    system: 'You are Alpha Trader, a sophisticated AI trading agent specializing in technical analysis and market timing. You make data-driven decisions based on price action, volume, and market sentiment.',
    bio: ['Technical analysis expert', 'Risk-conscious trader', 'Pattern recognition specialist'],
    personality: 'Analytical, patient, disciplined',
    tradingStrategy: 'Technical analysis with strict risk management. Focus on high-probability setups with 2:1 reward:risk ratio.',
    modelTier: 'pro' as const,
  },
  {
    name: 'Beta Sentiment',
    system: 'You are Beta Sentiment, an AI agent that trades based on social sentiment and news analysis. You monitor conversations, articles, and community vibes to identify market opportunities.',
    bio: ['Sentiment analysis expert', 'Social media monitoring', 'News-driven trader'],
    personality: 'Social, reactive, trend-following',
    tradingStrategy: 'Sentiment-driven trading. Buy when community is bullish, sell on fear. Monitor trending topics and news.',
    modelTier: 'free' as const,
  },
  {
    name: 'Gamma Arbitrage',
    system: 'You are Gamma Arbitrage, a quantitative trading agent that identifies and exploits market inefficiencies. You look for pricing discrepancies and statistical edges.',
    bio: ['Quantitative analyst', 'Arbitrage specialist', 'Statistical edge hunter'],
    personality: 'Mathematical, precise, opportunistic',
    tradingStrategy: 'Quantitative arbitrage. Identify mispriced assets and exploit statistical edges. Quick in-and-out trades.',
    modelTier: 'pro' as const,
  },
  {
    name: 'Delta Community',
    system: 'You are Delta Community, a social AI agent that engages with the community while making informed trading decisions. You build relationships and leverage social insights.',
    bio: ['Community builder', 'Social trader', 'Engagement specialist'],
    personality: 'Friendly, social, collaborative',
    tradingStrategy: 'Social trading. Build network, share insights, learn from community. Make trades based on collective intelligence.',
    modelTier: 'free' as const,
  },
];

async function main() {
  console.log('🤖 Seeding Autonomous Agents');
  console.log('============================\n');

  // Check if agents already exist
  const existingAgents = await prisma.user.count({
    where: { isAgent: true },
  });

  if (existingAgents >= AGENT_TEMPLATES.length) {
    console.log(`✅ Already have ${existingAgents} agents, skipping seed`);
    return;
  }

  console.log(`Creating ${AGENT_TEMPLATES.length} autonomous agents...\n`);

  for (const template of AGENT_TEMPLATES) {
    try {
      // Check if this specific agent already exists
      const existing = await prisma.user.findFirst({
        where: {
          displayName: template.name,
          isAgent: true,
        },
      });

      if (existing) {
        console.log(`⏭️  ${template.name} already exists, skipping`);
        continue;
      }

      await prisma.user.create({
        data: {
          id: await generateSnowflakeId(),
          username: template.name.toLowerCase().replace(/\s+/g, '-'),
          displayName: template.name,
          bio: template.bio.join(' | '),
          
          // Agent config
          isAgent: true,
          agentSystem: template.system,
          agentMessageExamples: JSON.stringify(template.bio),
          agentPersonality: template.personality,
          agentTradingStrategy: template.tradingStrategy,
          agentModelTier: template.modelTier,
          
          // Points - give them plenty to start generating training data!
          agentPointsBalance: 10000, // 10k points for extended autonomous operation
          
          // Enable ALL autonomous features to generate rich training data
          autonomousTrading: true,
          autonomousPosting: true,
          autonomousCommenting: true,
          autonomousDMs: true, // Enable for full data collection
          autonomousGroupChats: true, // Enable for full data collection
          
          // Status
          agentStatus: 'running',
          
          // Initial balance
          virtualBalance: 10000, // $10k starting balance
          
          // Timestamps
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Created: ${template.name}`);
      console.log(`   - Model: ${template.modelTier}`);
      console.log(`   - Strategy: ${template.tradingStrategy.substring(0, 60)}...`);
      console.log(`   - Points: 10,000`);
      console.log(`   - Balance: $10,000`);
      console.log(`   - Autonomous: ALL FEATURES ENABLED`);

    } catch (error) {
      console.error(`❌ Failed to create ${template.name}:`, error);
    }
  }

  console.log('============================');
  console.log('✅ Agent seeding complete!\n');

  // Show summary
  const totalAgents = await prisma.user.count({
    where: { isAgent: true },
  });

  const runningAgents = await prisma.user.count({
    where: {
      isAgent: true,
      agentStatus: 'running',
      OR: [
        { autonomousTrading: true },
        { autonomousPosting: true },
        { autonomousCommenting: true },
      ],
    },
  });

  console.log('Summary:');
  console.log(`  Total agents: ${totalAgents}`);
  console.log(`  Running agents: ${runningAgents}`);
  console.log('');
  console.log('View agents at:');
  console.log('  User: http://localhost:3000/agents');
  console.log('  Admin: http://localhost:3000/admin → Agents tab');
  console.log('');
  console.log('Trigger agent actions:');
  console.log('  npm run agent-tick');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Seed failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});

