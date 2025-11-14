/**
 * Comprehensive Pool Verification and Setup
 * Checks all pools and ensures they're properly initialized
 */

import { prisma } from '../src/lib/prisma';
import { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface Actor {
  id: string;
  name: string;
  hasPool?: boolean;
  tier?: string;
  role?: string;
  domain?: string[];
  personality?: string;
}

interface ActorsData {
  actors: Actor[];
}

async function verifyAndFixPools() {
  console.log('🔍 Starting Pool Verification and Setup\n');
  console.log('=' .repeat(60));

  // 1. Load actors.json
  const actorsPath = path.join(process.cwd(), 'public', 'data', 'actors.json');
  const actorsData: ActorsData = JSON.parse(fs.readFileSync(actorsPath, 'utf-8'));
  const poolActors = actorsData.actors.filter(a => a.hasPool === true);

  console.log(`\n📋 Found ${poolActors.length} actors configured with pools:`);
  poolActors.forEach(a => console.log(`   - ${a.name} (${a.id}) - Tier: ${a.tier}`));

  // 2. Check database actors
  console.log('\n🗄️  Checking Database Actors...');
  const dbActors = await prisma.actor.findMany({
    where: {
      id: { in: poolActors.map(a => a.id) }
    },
    select: {
      id: true,
      name: true,
      hasPool: true,
      tradingBalance: true,
      reputationPoints: true
    }
  });

  console.log(`   Found ${dbActors.length}/${poolActors.length} actors in database`);
  
  // 3. Check pools
  console.log('\n💰 Checking Pools...');
  const pools = await prisma.pool.findMany({
    include: {
      npcActor: {
        select: { id: true, name: true, tier: true }
      }
    }
  });

  console.log(`   Found ${pools.length} pools in database\n`);

  // 4. Detailed pool status
  console.log('📊 Pool Status:');
  console.log('─'.repeat(80));
  console.log('Pool Name'.padEnd(35) + 'Total Value'.padEnd(15) + 'Available'.padEnd(15) + 'Status');
  console.log('─'.repeat(80));

  const issues: string[] = [];

  for (const pool of pools) {
    const totalValue = pool.totalValue.toNumber();
    const availableBalance = pool.availableBalance.toNumber();
    const status = totalValue > 0 && availableBalance > 0 ? '✅ OK' : '❌ NEEDS FIX';

    console.log(
      pool.name.padEnd(35) +
      `$${totalValue.toLocaleString()}`.padEnd(15) +
      `$${availableBalance.toLocaleString()}`.padEnd(15) +
      status
    );

    if (totalValue === 0 || availableBalance === 0) {
      issues.push(pool.id);
    }
  }

  // 5. Check for missing pools
  console.log('\n🔍 Checking for Missing Pools...');
  const poolActorIds = new Set(pools.map(p => p.npcActorId));
  const missingPools = poolActors.filter(a => !poolActorIds.has(a.id));

  if (missingPools.length > 0) {
    console.log(`   ⚠️  Found ${missingPools.length} actors without pools:`);
    missingPools.forEach(a => console.log(`      - ${a.name} (${a.id})`));
  } else {
    console.log('   ✅ All pool actors have pools');
  }

  // 6. Fix issues if any
  if (issues.length > 0 || missingPools.length > 0) {
    console.log('\n🔧 Fixing Issues...\n');
    console.log('This will run the init-pools script to fix any issues.');
    console.log('Please run: bun run pools:init');
  } else {
    console.log('\n✅ All pools are properly configured!');
  }

  // 7. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 SUMMARY:');
  console.log(`   Total Pools: ${pools.length}`);
  console.log(`   Healthy Pools: ${pools.length - issues.length}`);
  console.log(`   Pools Needing Fix: ${issues.length}`);
  console.log(`   Missing Pools: ${missingPools.length}`);
  
  const totalCapital = pools.reduce((sum, p) => sum + p.totalValue.toNumber(), 0);
  console.log(`   Total Pool Capital: $${totalCapital.toLocaleString()}`);
  console.log('='.repeat(60));

  await prisma.$disconnect();
  
  return issues.length === 0 && missingPools.length === 0;
}

verifyAndFixPools().then(success => {
  if (!success) {
    console.log('\n⚠️  Please run: bun run pools:init');
    process.exit(1);
  }
  process.exit(0);
}).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


