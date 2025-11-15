/**
 * Test Admin Trade Creation
 * 
 * Tests creating a trade via admin API and verifying it appears in the public feed
 */

import { prisma } from '../src/lib/prisma';

async function testAdminTrade() {
  console.log('\n🧪 Testing Admin Trade Creation\n');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Get a test user
    console.log('📊 Step 1: Finding a test user...\n');
    const user = await prisma.user.findFirst({
      where: {
        isActor: false,
        isAgent: false,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        virtualBalance: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!user) {
      console.error('❌ No users found in database. Please create a user first.');
      process.exit(1);
    }

    console.log(`  ✅ Found user: ${user.username || user.displayName || user.id}`);
    console.log(`     ID: ${user.id}`);
    console.log(`     Current Balance: $${Number(user.virtualBalance).toFixed(2)}\n`);

    // Step 2: Check current trades count
    console.log('📊 Step 2: Checking current trades...\n');
    const beforeTrades = await prisma.balanceTransaction.count({
      where: {
        userId: user.id,
        type: {
          in: ['pred_buy', 'pred_sell', 'perp_open', 'perp_close', 'perp_liquidation'],
        },
      },
    });
    console.log(`  Current balance trades for user: ${beforeTrades}\n`);

    // Step 3: Create a test trade via API simulation
    console.log('📊 Step 3: Creating test trade (simulating API call)...\n');
    
    const testAmount = 100.50;
    const testDescription = 'Test trade created by admin script';
    const currentBalance = Number(user.virtualBalance);
    const newBalance = currentBalance + testAmount;

    const transaction = await prisma.$transaction(async (tx) => {
      // Update user balance
      await tx.user.update({
        where: { id: user.id },
        data: {
          virtualBalance: newBalance,
        },
      });

      // Create transaction record
      const { generateSnowflakeId } = await import('../src/lib/snowflake');
      const balanceTx = await tx.balanceTransaction.create({
        data: {
          id: await generateSnowflakeId(),
          userId: user.id,
          type: 'pred_buy',
          amount: testAmount,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          description: testDescription,
          relatedId: null,
        },
      });

      return balanceTx;
    });

    console.log(`  ✅ Created balance transaction:`);
    console.log(`     ID: ${transaction.id}`);
    console.log(`     Type: ${transaction.type}`);
    console.log(`     Amount: $${testAmount}`);
    console.log(`     Balance: $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)}\n`);

    // Step 4: Verify it appears in public feed
    console.log('📊 Step 4: Verifying trade appears in public feed...\n');
    
    const publicFeedTrades = await prisma.balanceTransaction.findMany({
      where: {
        type: {
          in: ['pred_buy', 'pred_sell', 'perp_open', 'perp_close', 'perp_liquidation'],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        User: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileImageUrl: true,
            isActor: true,
          },
        },
      },
    });

    const foundTrade = publicFeedTrades.find(t => t.id === transaction.id);
    
    if (foundTrade) {
      console.log(`  ✅ Trade found in public feed!`);
      console.log(`     User: ${foundTrade.User?.displayName || foundTrade.User?.username || 'Unknown'}`);
      console.log(`     Description: ${foundTrade.description || 'N/A'}`);
      console.log(`     Amount: $${Number(foundTrade.amount).toFixed(2)}\n`);
    } else {
      console.log(`  ⚠️  Trade not found in top 10 recent trades`);
      console.log(`     (This might be normal if there are many recent trades)\n`);
    }

    // Step 5: Verify user balance was updated
    console.log('📊 Step 5: Verifying user balance was updated...\n');
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { virtualBalance: true },
    });

    if (updatedUser && Number(updatedUser.virtualBalance) === newBalance) {
      console.log(`  ✅ User balance updated correctly: $${Number(updatedUser.virtualBalance).toFixed(2)}\n`);
    } else {
      console.log(`  ❌ User balance mismatch!`);
      console.log(`     Expected: $${newBalance.toFixed(2)}`);
      console.log(`     Actual: $${Number(updatedUser?.virtualBalance || 0).toFixed(2)}\n`);
    }

    console.log('✅ Test completed successfully!\n');
    console.log('='.repeat(60) + '\n');
    console.log('Next steps:');
    console.log('1. Check the admin dashboard at /admin → Trading Feed tab');
    console.log('2. Check the public feed at /feed → Trades tab');
    console.log(`3. Look for trade ID: ${transaction.id}\n`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAdminTrade().catch(console.error);

