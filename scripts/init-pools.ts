/**
 * Initialize Pools for NPCs with hasPool=true
 * 
 * Creates pool records for all actors marked with hasPool in actors.json
 * and initializes their trading balances
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { CapitalAllocationService } from '../src/lib/services/capital-allocation-service';

interface Actor {
  id: string;
  name: string;
  description?: string;
  domain?: string[];
  personality?: string;
  tier?: string;
  affiliations?: string[];
  postStyle?: string;
  postExample?: string[];
  role?: string;
  initialLuck?: string;
  initialMood?: number;
  hasPool?: boolean;
}

interface ActorsData {
  actors: Actor[];
}

async function initPools() {
  try {
    console.log('🔄 Loading actors from actors.json...');
    
    // Load actors.json
    const actorsPath = path.join(process.cwd(), 'public', 'data', 'actors.json');
    const actorsData: ActorsData = JSON.parse(fs.readFileSync(actorsPath, 'utf-8'));
    
    // Filter actors with hasPool=true
    const poolActors = actorsData.actors.filter(a => a.hasPool === true);
    
    console.log(`📊 Found ${poolActors.length} actors with pools enabled`);
    
    for (const actor of poolActors) {
      console.log(`\n👤 Processing: ${actor.name} (${actor.id})`);
      
      // 1. Ensure actor exists in database
      let dbActor = await prisma.actor.findUnique({
        where: { id: actor.id },
      });
      
      // Calculate realistic starting capital based on tier, role, domain
      const capitalAllocation = CapitalAllocationService.calculateCapital(actor);
      console.log(`  💰 Capital allocation: $${capitalAllocation.tradingBalance.toLocaleString()}`);
      console.log(`     ${capitalAllocation.reasoning}`);
      
      if (!dbActor) {
        console.log('  ➕ Creating actor in database...');
        dbActor = await prisma.actor.create({
          data: {
            id: actor.id,
            name: actor.name,
            description: actor.description || '',
            domain: actor.domain || [],
            personality: actor.personality,
            tier: actor.tier,
            affiliations: actor.affiliations || [],
            postStyle: actor.postStyle,
            postExample: actor.postExample || [],
            role: actor.role,
            initialLuck: actor.initialLuck || 'medium',
            initialMood: actor.initialMood || 0,
            hasPool: true,
            tradingBalance: new Prisma.Decimal(capitalAllocation.tradingBalance),
            reputationPoints: capitalAllocation.reputationPoints,
          },
        });
      } else {
        // Update existing actor with hasPool and realistic trading balance
        console.log('  🔄 Updating actor...');
        dbActor = await prisma.actor.update({
          where: { id: actor.id },
          data: {
            hasPool: true,
            tradingBalance: new Prisma.Decimal(capitalAllocation.tradingBalance),
            reputationPoints: capitalAllocation.reputationPoints,
          },
        });
      }
      
      // 2. Check if pool already exists
      const existingPool = await prisma.pool.findFirst({
        where: {
          npcActorId: actor.id,
        },
      });
      
      if (existingPool) {
        // Update pool if it has 0 balance (needs initialization)
        if (existingPool.totalValue.toNumber() === 0 && existingPool.availableBalance.toNumber() === 0) {
          console.log(`  🔄 Updating pool with initial capital: ${existingPool.name}`);
          await prisma.pool.update({
            where: { id: existingPool.id },
            data: {
              totalValue: new Prisma.Decimal(capitalAllocation.initialPoolBalance),
              availableBalance: new Prisma.Decimal(capitalAllocation.initialPoolBalance),
            },
          });
          console.log(`  ✅ Pool updated with $${capitalAllocation.initialPoolBalance.toLocaleString()}`);
        } else {
          console.log(`  ✅ Pool already exists: ${existingPool.name} ($${existingPool.totalValue.toNumber().toLocaleString()})`);
        }
        continue;
      }
      
      // 3. Create pool
      const poolName = `${actor.name}'s ${getPoolStyle(actor.personality || 'trader')} Pool`;
      const poolDescription = generatePoolDescription(actor);
      
      console.log(`  🎯 Creating pool: ${poolName}`);
      
      // Pool starts with NPC's initial capital (already calculated above)
      await prisma.pool.create({
        data: {
          npcActorId: actor.id,
          name: poolName,
          description: poolDescription,
          totalValue: new Prisma.Decimal(capitalAllocation.initialPoolBalance),
          totalDeposits: new Prisma.Decimal(0), // No user deposits yet
          availableBalance: new Prisma.Decimal(capitalAllocation.initialPoolBalance),
          lifetimePnL: new Prisma.Decimal(0),
          performanceFeeRate: 0.05, // 5% performance fee (only on profits)
          totalFeesCollected: new Prisma.Decimal(0),
          isActive: true,
        },
      });
      
      console.log(`  ✅ Pool created successfully!`);
    }
    
    console.log(`\n✨ Pool initialization complete!`);
    console.log(`📈 ${poolActors.length} pools are now active`);
    
  } catch (error) {
    console.error('❌ Error initializing pools:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function getPoolStyle(personality: string): string {
  const styles: Record<string, string> = {
    'activist investor': 'Activist',
    'nft visionary': 'NFT',
    'chart wizard': 'TA',
    'memecoin cultist': 'Meme',
    'TA purist': 'Technical',
    'crypto native': 'Alpha',
    'nft degen': 'Degen',
    'solana maximalist': 'Solana',
    'evangelical investor': 'Innovation',
    'disaster profiteer': 'Inverse',
    'erratic visionary': 'Visionary',
    'bitcoin maximalist': 'Bitcoin',
    'yacht philosopher': 'Wisdom',
    'predatory investor': 'VC',
    'vampire capitalist': 'Contrarian',
  };
  
  return styles[personality.toLowerCase()] || 'Trading';
}

function generatePoolDescription(actor: Actor): string {
  const baseDesc = actor.description || '';
  const strategy = getStrategy(actor.personality || 'trader');
  
  return `${baseDesc.split('.')[0]}. ${strategy} Managed by ${actor.name}.`;
}

function getStrategy(personality: string): string {
  const strategies: Record<string, string> = {
    'activist investor': 'Focuses on event-driven trades and corporate activism',
    'nft visionary': 'Trades NFT and Web3 projects with high conviction',
    'chart wizard': 'Technical analysis-driven with 47-tweet explanations',
    'memecoin cultist': 'Cult dynamics and supercycle theory guide all trades',
    'TA purist': 'Fibonacci levels and textbook patterns only',
    'crypto native': 'Degen wisdom mixed with alpha, probably farming you',
    'nft degen': 'Flips pixels for profit, posts wins only',
    'solana maximalist': 'Solana shilling with 100x conviction',
    'evangelical investor': 'Faith-based innovation investing with 5-year horizons',
    'disaster profiteer': 'Inverse everything, always wrong but confident',
    'erratic visionary': 'Memes at 3am, genius moves eventually',
    'bitcoin maximalist': 'Only Bitcoin, measured in blocks and sats',
    'yacht philosopher': 'Fortune cookie wisdom from the Caymans',
    'predatory investor': 'Software eating everything, TAM obsessed',
    'vampire capitalist': 'Zero to one thinking, contrarian and dark',
  };
  
  return strategies[personality.toLowerCase()] || 'Strategic trading across markets';
}

// Run the script
initPools()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });

