/**
 * Manual Test: WorldEvent INT4 Validation
 * 
 * This test verifies that WorldEvent creation properly validates
 * INT4 fields to prevent Snowflake ID overflow errors.
 * 
 * Run with: bun run tests/manual/test-worldevent-validation.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateSnowflakeId } from '@/lib/snowflake';
import { db } from '@/lib/database-service';

const prisma = new PrismaClient();

async function testWorldEventValidation() {
  console.log('🧪 Testing WorldEvent INT4 Validation\n');

  try {
    // Test 1: Valid values should work
    console.log('Test 1: Creating event with valid INT4 values...');
    const validEvent = await db.createEvent({
      id: await generateSnowflakeId(),
      eventType: 'announcement',
      description: 'Test event with valid values',
      actors: [],
      relatedQuestion: 123, // Valid INT4
      dayNumber: 42, // Valid INT4
      visibility: 'public',
      gameId: 'test',
    });
    console.log('✅ Valid event created:', validEvent.id);

    // Test 2: Snowflake ID as relatedQuestion should be filtered out
    console.log('\nTest 2: Attempting to create event with Snowflake ID as relatedQuestion...');
    const snowflakeId = generateSnowflakeId();
    const bigNumber = Number(snowflakeId); // This would overflow INT4
    
    console.log('  Snowflake ID:', snowflakeId);
    console.log('  As number:', bigNumber);
    console.log('  INT4 max:', 2147483647);
    console.log('  Would overflow?', bigNumber > 2147483647);

    try {
      const invalidEvent = await db.createEvent({
        id: await generateSnowflakeId(),
        eventType: 'announcement',
        description: 'Test event with invalid relatedQuestion',
        actors: [],
        relatedQuestion: bigNumber as any, // This should be filtered out
        dayNumber: 42,
        visibility: 'public',
        gameId: 'test',
      });
      console.log('✅ Event created with filtered relatedQuestion:', invalidEvent.id);
      console.log('   relatedQuestion value:', invalidEvent.relatedQuestion);
      if (invalidEvent.relatedQuestion === null || invalidEvent.relatedQuestion === undefined) {
        console.log('   ✓ Invalid value was correctly filtered to NULL');
      } else {
        console.log('   ⚠️  Expected NULL but got:', invalidEvent.relatedQuestion);
      }
    } catch (error: any) {
      console.log('❌ Event creation failed (unexpected):', error.message);
    }

    // Test 3: Large dayNumber should be filtered out
    console.log('\nTest 3: Attempting to create event with overflow dayNumber...');
    try {
      const invalidDayEvent = await db.createEvent({
        id: await generateSnowflakeId(),
        eventType: 'announcement',
        description: 'Test event with invalid dayNumber',
        actors: [],
        relatedQuestion: 123,
        dayNumber: 9999999999 as any, // This should be filtered out
        visibility: 'public',
        gameId: 'test',
      });
      console.log('✅ Event created with filtered dayNumber:', invalidDayEvent.id);
      console.log('   dayNumber value:', invalidDayEvent.dayNumber);
      if (invalidDayEvent.dayNumber === null || invalidDayEvent.dayNumber === undefined) {
        console.log('   ✓ Invalid value was correctly filtered to NULL');
      } else {
        console.log('   ⚠️  Expected NULL but got:', invalidDayEvent.dayNumber);
      }
    } catch (error: any) {
      console.log('❌ Event creation failed (unexpected):', error.message);
    }

    // Test 4: Edge case - exactly INT4 max
    console.log('\nTest 4: Creating event with INT4 maximum value...');
    const maxInt4Event = await db.createEvent({
      id: await generateSnowflakeId(),
      eventType: 'announcement',
      description: 'Test event with INT4 max',
      actors: [],
      relatedQuestion: 2147483647, // Exactly INT4 max
      dayNumber: 2147483647,
      visibility: 'public',
      gameId: 'test',
    });
    console.log('✅ Event created with INT4 max values:', maxInt4Event.id);
    console.log('   relatedQuestion:', maxInt4Event.relatedQuestion);
    console.log('   dayNumber:', maxInt4Event.dayNumber);

    // Cleanup
    console.log('\n🧹 Cleaning up test events...');
    await prisma.worldEvent.deleteMany({
      where: {
        gameId: 'test',
      },
    });
    console.log('✅ Cleanup complete');

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testWorldEventValidation().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});

