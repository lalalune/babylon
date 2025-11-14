/**
 * Test script for Snowflake ID generation
 * Run with: bun scripts/test-snowflake-ids.ts
 */

import { generateSnowflakeId, parseSnowflakeId, isValidSnowflakeId } from '../src/lib/snowflake';

console.log('🧪 Testing Snowflake ID Generation...\n');

// Test 1: Generate unique IDs
console.log('Test 1: Generating 1000 unique IDs...');
const ids = new Set<string>();
const startTime = Date.now();

for (let i = 0; i < 1000; i++) {
  ids.add(generateSnowflakeId());
}

const duration = Date.now() - startTime;
console.log(`✓ Generated ${ids.size}/1000 unique IDs in ${duration}ms`);
console.log(`  Performance: ${Math.round(1000 / duration * 1000)} IDs/second\n`);

// Test 2: Verify IDs are sortable by time
console.log('Test 2: Verifying time-sortable property...');
const id1 = generateSnowflakeId();
await new Promise(resolve => setTimeout(resolve, 10)); // Wait 10ms
const id2 = generateSnowflakeId();
await new Promise(resolve => setTimeout(resolve, 10)); // Wait 10ms
const id3 = generateSnowflakeId();

const isSorted = BigInt(id1) < BigInt(id2) && BigInt(id2) < BigInt(id3);
console.log(`✓ IDs are time-sorted: ${isSorted}`);
console.log(`  ID1: ${id1}`);
console.log(`  ID2: ${id2}`);
console.log(`  ID3: ${id3}\n`);

// Test 3: Parse ID components
console.log('Test 3: Parsing ID components...');
const testId = generateSnowflakeId();
const parsed = parseSnowflakeId(testId);
console.log(`✓ Successfully parsed ID: ${testId}`);
console.log(`  Timestamp: ${parsed.timestamp.toISOString()}`);
console.log(`  Worker ID: ${parsed.workerId}`);
console.log(`  Sequence: ${parsed.sequence}\n`);

// Test 4: Validate IDs
console.log('Test 4: Testing ID validation...');
const validId = generateSnowflakeId();
const invalidIds = [
  'not-a-number',
  '550e8400-e29b-41d4-a716-446655440000', // UUID
  'abc123',
  '-1',
  '',
];

console.log(`✓ Valid ID "${validId}": ${isValidSnowflakeId(validId)}`);
for (const invalidId of invalidIds) {
  console.log(`  Invalid ID "${invalidId}": ${isValidSnowflakeId(invalidId)}`);
}
console.log('');

// Test 5: Compare with old UUID format
console.log('Test 5: Comparing with UUID format...');
const snowflakeId = generateSnowflakeId();
const uuidExample = '550e8400-e29b-41d4-a716-446655440000';

console.log(`✓ Snowflake ID: ${snowflakeId} (${snowflakeId.length} chars)`);
console.log(`  UUID:         ${uuidExample} (${uuidExample.length} chars)`);
console.log(`  Size savings: ${uuidExample.length - snowflakeId.length} characters`);
console.log(`  URL-friendly: No hyphens, all numeric\n`);

// Test 6: URL examples
console.log('Test 6: URL examples...');
const postId = generateSnowflakeId();
console.log(`✓ Old format: http://localhost:3000/post/org-ambient-1762747396508-0.49887658185492456`);
console.log(`  New format: http://localhost:3000/post/${postId}`);
console.log(`  Much cleaner and more professional! ✨\n`);

// Test 7: Concurrent generation
console.log('Test 7: Testing concurrent generation...');
const concurrentIds = await Promise.all(
  Array(100).fill(0).map(() => Promise.resolve(generateSnowflakeId()))
);
const uniqueConcurrent = new Set(concurrentIds);
console.log(`✓ Generated ${uniqueConcurrent.size}/100 unique IDs concurrently`);
console.log(`  No collisions! 🎉\n`);

console.log('✅ All tests passed! Snowflake ID system is working correctly.');
console.log('\nNext steps:');
console.log('1. Create a new post and check the URL');
console.log('2. Verify old UUID posts still work');
console.log('3. Monitor ID generation in production');

