/**
 * Monitor Market Activity
 */

import { prisma } from '../src/lib/prisma';

async function monitor() {
  console.log('\n📊 MONITORING MARKET ACTIVITY\n');
  console.log('='.repeat(70));
  
  // Check recent trades
  console.log('\n🔍 NPC Trades (Last 5 Minutes):');
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const recentTrades = await prisma.nPCTrade.findMany({
    where: { executedAt: { gte: fiveMinAgo } },
    orderBy: { executedAt: 'desc' },
  });
  
  console.log(`Found: ${recentTrades.length} trades\n`);
  
  if (recentTrades.length > 0) {
    recentTrades.forEach(t => {
      console.log(`✅ ${t.npcActorId}: $${t.amount} ${t.action} ${t.ticker || t.marketId}`);
      console.log(`   @ ${t.executedAt.toISOString()}`);
    });
  } else {
    console.log('No trades in last 5 minutes');
    console.log('→ Daemon may be initializing (wait 60s for first tick)');
  }
  
  // Check price movements
  console.log('\n📈 Price Movements (Last 5 Minutes):');
  const priceUpdates = await prisma.stockPrice.findMany({
    where: { timestamp: { gte: fiveMinAgo } },
    orderBy: { timestamp: 'desc' },
    take: 20,
  });
  
  console.log(`Found: ${priceUpdates.length} price updates\n`);
  
  if (priceUpdates.length > 0) {
    priceUpdates.forEach(p => {
      const sign = p.changePercent > 0 ? '+' : '';
      console.log(`✅ ${p.organizationId}: ${sign}${p.changePercent.toFixed(2)}% @ ${p.timestamp.toISOString().slice(11, 19)}`);
    });
  } else {
    console.log('No price movements in last 5 minutes');
  }
  
  // Check game status
  console.log('\n🎮 Game Status:');
  const game = await prisma.game.findFirst({ where: { isContinuous: true } });
  
  if (game?.lastTickAt) {
    const minutesAgo = Math.floor((Date.now() - game.lastTickAt.getTime()) / 60000);
    console.log(`Last tick: ${game.lastTickAt.toISOString()} (${minutesAgo} min ago)`);
    
    if (minutesAgo < 2) {
      console.log('✅ Game is running!');
    } else {
      console.log('⚠️  Game may have stopped');
    }
  } else {
    console.log('No tick data yet');
  }
  
  console.log('\n' + '='.repeat(70));
  
  await prisma.$disconnect();
}

monitor().catch(console.error);


