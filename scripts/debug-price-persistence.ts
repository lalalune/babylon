/**
 * Debug Price Persistence
 */

import { prisma } from '../src/lib/prisma';
import { TradeExecutionService } from '../src/lib/services/trade-execution-service';

async function debug() {
  console.log('\n🐛 DEBUGGING PRICE PERSISTENCE\n');
  console.log('='.repeat(70));
  
  // Get recent trades
  const trades = await prisma.nPCTrade.findMany({
    where: {
      executedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
    },
    orderBy: { executedAt: 'desc' },
  });
  
  console.log(`\n1️⃣ Recent NPC Trades: ${trades.length}\n`);
  
  // Get corresponding positions to build ExecutedTrade objects
  const positions = await prisma.poolPosition.findMany({
    where: {
      openedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }
    },
    orderBy: { openedAt: 'desc' },
  });
  
  console.log(`2️⃣ Recent Positions: ${positions.length}\n`);
  
  // Build executed trades from positions
  const executedTrades = positions.map(pos => ({
    npcId: 'test',
    npcName: 'Test',
    poolId: pos.poolId,
    marketType: pos.marketType as 'perp' | 'prediction',
    ticker: pos.ticker || undefined,
    marketId: pos.marketId ? parseInt(pos.marketId) : undefined,
    action: pos.side === 'long' || pos.side === 'YES' ? 'open_long' : 'open_short' as const,
    side: pos.side,
    amount: 0,
    size: pos.size,
    shares: pos.shares || undefined,
    executionPrice: pos.entryPrice,
    confidence: 0.8,
    reasoning: 'Test',
    positionId: pos.id,
    timestamp: pos.openedAt.toISOString(),
  }));
  
  console.log(`3️⃣ Calculating Trade Impacts...\n`);
  
  const service = new TradeExecutionService();
  const impacts = await service.getTradeImpacts(executedTrades);
  
  console.log(`Found impacts for ${impacts.size} tickers:\n`);
  
  for (const [key, impact] of impacts) {
    const totalVol = impact.longVolume + impact.shortVolume;
    console.log(`${key}:`);
    console.log(`  Long: $${impact.longVolume.toFixed(0)} | Short: $${impact.shortVolume.toFixed(0)}`);
    console.log(`  Total: $${totalVol.toFixed(0)} | Sentiment: ${impact.netSentiment.toFixed(2)}`);
    
    // Calculate expected price change
    const volumeImpact = Math.min(totalVol / 10000, 0.05);
    const priceChange = impact.netSentiment * volumeImpact;
    console.log(`  Expected price change: ${(priceChange * 100).toFixed(2)}%`);
    
    // Check if this ticker exists in organizations
    const org = await prisma.organization.findFirst({
      where: {
        id: { contains: key.toLowerCase() }
      }
    });
    
    if (org) {
      console.log(`  ✅ Organization found: ${org.id} (${org.name})`);
      console.log(`  Current price: $${org.currentPrice}`);
    } else {
      console.log(`  ❌ NO ORGANIZATION FOUND for ticker: ${key}`);
      console.log(`     This is why prices aren't updating!`);
    }
    console.log('');
  }
  
  console.log('='.repeat(70));
  console.log('\n💡 DIAGNOSIS:\n');
  
  const allFound = [];
  for (const [key] of impacts) {
    const org = await prisma.organization.findFirst({
      where: { id: { contains: key.toLowerCase() } }
    });
    if (org) allFound.push(key);
  }
  
  if (allFound.length === impacts.size) {
    console.log('✅ All tickers have matching organizations');
    console.log('   Price persistence should work');
    console.log('   → Check GameEngine logs for errors');
  } else {
    console.log(`❌ ${impacts.size - allFound.length}/${impacts.size} tickers have NO organization`);
    console.log('   → Ticker/OrganizationID mismatch!');
    console.log('   → updatePricesFromTrades cant find the company!');
  }
  
  await prisma.$disconnect();
}

debug().catch(console.error);


