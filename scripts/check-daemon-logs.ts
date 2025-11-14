/**
 * Check Daemon Logs from Database
 */

import { prisma } from '../src/lib/prisma';

async function check() {
  console.log('\n🔍 CHECKING RECENT ACTIVITY\n');
  
  // Check recent game ticks
  const game = await prisma.game.findFirst({
    where: { isContinuous: true }
  });
  
  console.log('Game Status:');
  if (game) {
    const minAgo = game.lastTickAt ? Math.floor((Date.now() - game.lastTickAt.getTime()) / 60000) : 999;
    console.log(`  Last tick: ${game.lastTickAt?.toISOString() || 'Never'} (${minAgo} min ago)`);
    console.log(`  Status: ${minAgo < 2 ? '✅ RUNNING' : '❌ STOPPED'}`);
  }
  
  // Check trades in last 2 minutes
  const trades = await prisma.nPCTrade.findMany({
    where: {
      executedAt: { gte: new Date(Date.now() - 2 * 60 * 1000) }
    }
  });
  
  console.log(`\nNPC Trades (Last 2 min): ${trades.length}`);
  console.log(`  Status: ${trades.length > 0 ? '✅ TRADING' : '⚠️  NO TRADES'}`);
  
  // Check price updates
  const prices = await prisma.stockPrice.findMany({
    where: {
      timestamp: { gte: new Date(Date.now() - 2 * 60 * 1000) }
    }
  });
  
  console.log(`\nPrice Updates (Last 2 min): ${prices.length}`);
  console.log(`  Status: ${prices.length > 0 ? '✅ MOVING' : '❌ STATIC'}`);
  
  // Check pools
  const pools = await prisma.pool.findMany({
    where: { isActive: true },
    include: {
      positions: { where: { closedAt: null } }
    }
  });
  
  console.log(`\nActive Pools: ${pools.length}`);
  const totalPositions = pools.reduce((sum, p) => sum + p.positions.length, 0);
  const totalSize = pools.reduce((sum, p) => 
    sum + p.positions.reduce((s, pos) => s + pos.size, 0), 0
  );
  console.log(`  Open positions: ${totalPositions}`);
  console.log(`  Total deployed: $${totalSize.toFixed(0)}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('\n🎯 VERDICT:\n');
  
  if (minAgo < 2 && trades.length > 0) {
    if (prices.length > 0) {
      console.log('✅ SYSTEM FULLY OPERATIONAL');
      console.log('   - Daemon running');
      console.log('   - NPCs trading');
      console.log('   - Prices moving');
    } else {
      console.log('⚠️  PARTIAL: Trading works, prices not persisting');
      console.log('   → Check GameEngine logs for price update errors');
    }
  } else {
    console.log('❌ SYSTEM NOT RUNNING');
    console.log('   → Restart: npm run dev');
  }
  
  await prisma.$disconnect();
}

check().catch(console.error);


