/**
 * Clear pools cache and verify API response
 */

import { cachedDb } from '../src/lib/cached-database-service';

console.log('🗑️  Clearing pools cache...');
await cachedDb.invalidatePoolsCache();
console.log('✅ Pools cache cleared');

console.log('\n📡 Testing API endpoint...');
const response = await fetch('http://localhost:3000/api/pools');
const data = await response.json();

if (data.pools && data.pools.length > 0) {
  console.log(`✅ API returning ${data.pools.length} pools\n`);
  console.log('Sample pool data:');
  const sample = data.pools[0];
  console.log(JSON.stringify({
    name: sample.name,
    totalValue: sample.totalValue,
    availableBalance: sample.availableBalance,
    totalDeposits: sample.totalDeposits,
    activeInvestors: sample.activeInvestors
  }, null, 2));
} else {
  console.log('❌ API returned no pools or error:', data);
}

process.exit(0);


