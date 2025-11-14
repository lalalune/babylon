/**
 * Seed script for moderation test users
 * Creates test users with specific moderation metrics for e2e testing
 */

import { prisma } from '../src/lib/database-service';
import { nanoid } from 'nanoid';

const TEST_USERS = [
  {
    username: 'baduser001',
    displayName: 'Bad User',
    walletAddress: '0xBAD0000000000000000000000000000000000001',
    reportsToReceive: 25,
    blocksToReceive: 15,
    mutesToReceive: 10,
    followersToCreate: 5,
  },
  {
    username: 'spammer002',
    displayName: 'Spam Bot',
    walletAddress: '0xSPAM000000000000000000000000000000000002',
    reportsToReceive: 50,
    blocksToReceive: 30,
    mutesToReceive: 20,
    followersToCreate: 2,
  },
  {
    username: 'controversial003',
    displayName: 'Controversial User',
    walletAddress: '0xCONT000000000000000000000000000000000003',
    reportsToReceive: 10,
    blocksToReceive: 8,
    mutesToReceive: 5,
    followersToCreate: 50, // Changed from 500 to keep test data reasonable
  },
  {
    username: 'cleanuser004',
    displayName: 'Clean User',
    walletAddress: '0xCLEAN00000000000000000000000000000000004',
    reportsToReceive: 0,
    blocksToReceive: 0,
    mutesToReceive: 0,
    followersToCreate: 100,
  },
  {
    username: 'banneduser005',
    displayName: 'Banned User',
    walletAddress: '0xBANNED0000000000000000000000000000000005',
    reportsToReceive: 30,
    blocksToReceive: 20,
    mutesToReceive: 15,
    followersToCreate: 10,
    isBanned: true,
    bannedReason: 'Repeated harassment',
  },
];

async function seedModerationTestUsers() {
  console.log('🌱 Seeding moderation test users...');

  // Create or find reporter users (need them to create reports, blocks, mutes)
  const reporterUsers = [];
  for (let i = 0; i < 10; i++) {
    const reporter = await prisma.user.upsert({
      where: { username: `reporter${i}` },
      update: { updatedAt: new Date() },
      create: {
        id: nanoid(),
        username: `reporter${i}`,
        displayName: `Reporter ${i}`,
        walletAddress: `0xREPORTER${i.toString().padStart(36, '0')}`,
        bio: 'Test reporter user',
        profileComplete: true,
        reputationPoints: 1000,
        referralCode: `REPORTER${i}`,
        virtualBalance: 1000,
        totalDeposited: 1000,
        totalWithdrawn: 0,
        lifetimePnL: 0,
      updatedAt: new Date(),
      },
    });
    reporterUsers.push(reporter);
    console.log(`  ✓ Created/found reporter: ${reporter.username}`);
  }

  // Create or find admin user for banning
  const adminUser = await prisma.user.upsert({
    where: { username: 'testadmin' },
    update: { isAdmin: true, updatedAt: new Date() },
    create: {
      id: nanoid(),
      username: 'testadmin',
      displayName: 'Test Admin',
      walletAddress: '0xADMIN00000000000000000000000000000000000',
      bio: 'Admin user for testing',
      profileComplete: true,
      reputationPoints: 10000,
      referralCode: 'ADMIN123',
      virtualBalance: 10000,
      totalDeposited: 10000,
      totalWithdrawn: 0,
      lifetimePnL: 0,
      updatedAt: new Date(),
      isAdmin: true,
    },
  });
  console.log(`  ✓ Created/found admin: ${adminUser.username}`);

  // Create test users with moderation metrics
  for (const testUser of TEST_USERS) {
    console.log(`\n📝 Processing user: ${testUser.username}`);

    // Create or find the user
    const user = await prisma.user.upsert({
      where: { username: testUser.username },
      update: {
        isBanned: testUser.isBanned || false,
        bannedAt: testUser.isBanned ? new Date() : null,
        bannedReason: testUser.bannedReason || null,
        bannedBy: testUser.isBanned ? adminUser.id : null,
      },
      create: {
        id: nanoid(),
        username: testUser.username,
        displayName: testUser.displayName,
        walletAddress: testUser.walletAddress,
        bio: `Test user: ${testUser.displayName}`,
        profileComplete: true,
        reputationPoints: 1000,
        referralCode: `${testUser.username.toUpperCase()}`,
        virtualBalance: 1000,
        totalDeposited: 1000,
        totalWithdrawn: 0,
        lifetimePnL: 0,
      updatedAt: new Date(),
        isBanned: testUser.isBanned || false,
        bannedAt: testUser.isBanned ? new Date() : null,
        bannedReason: testUser.bannedReason || null,
        bannedBy: testUser.isBanned ? adminUser.id : null,
      },
    });
    console.log(`  ✓ Created/updated user: ${user.username}`);

    // Delete existing moderation data for this user to start fresh
    await prisma.report.deleteMany({ where: { reportedUserId: user.id } });
    await prisma.userBlock.deleteMany({ where: { blockedId: user.id } });
    await prisma.userMute.deleteMany({ where: { mutedId: user.id } });
    await prisma.follow.deleteMany({ where: { followingId: user.id } });
    console.log(`  ✓ Cleaned up existing moderation data`);

    // Create followers
    for (let i = 0; i < testUser.followersToCreate; i++) {
      const follower = reporterUsers[i % reporterUsers.length];
      
      if (!follower) continue;
      
      try {
        await prisma.follow.create({
          data: {
            id: nanoid(),
            followerId: follower.id,
            followingId: user.id,
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
          },
        });
      } catch (error) {
        // Ignore duplicate follows
      }
    }
    console.log(`  ✓ Created ${testUser.followersToCreate} followers`);

    // Create reports received
    for (let i = 0; i < testUser.reportsToReceive; i++) {
      const reporter = reporterUsers[i % reporterUsers.length];
      
      if (!reporter) continue;
      
      const categories = ['spam', 'harassment', 'hate_speech', 'inappropriate', 'misinformation', 'violence', 'impersonation', 'copyright', 'other'];
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      if (!category) continue;
      
      await prisma.report.create({
        data: {
          id: nanoid(),
          reporterId: reporter.id,
          reportedUserId: user.id,
          reportType: 'user',
          category,
          reason: `Test report ${i + 1} for ${testUser.username}`,
          status: i % 3 === 0 ? 'resolved' : i % 3 === 1 ? 'pending' : 'reviewing',
          priority: i % 4 === 0 ? 'critical' : i % 4 === 1 ? 'high' : i % 4 === 2 ? 'normal' : 'low',
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    console.log(`  ✓ Created ${testUser.reportsToReceive} reports received`);

    // Create blocks received
    for (let i = 0; i < testUser.blocksToReceive; i++) {
      const blocker = reporterUsers[i % reporterUsers.length];
      
      if (!blocker) continue;
      
      try {
        await prisma.userBlock.create({
          data: {
            id: nanoid(),
            blockerId: blocker.id,
            blockedId: user.id,
            reason: `Test block ${i + 1} for ${testUser.username}`,
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          },
        });
      } catch (error) {
        // Ignore duplicates
      }
    }
    console.log(`  ✓ Created ${testUser.blocksToReceive} blocks received`);

    // Create mutes received
    for (let i = 0; i < testUser.mutesToReceive; i++) {
      const muter = reporterUsers[i % reporterUsers.length];
      
      if (!muter) continue;
      
      try {
        await prisma.userMute.create({
          data: {
            id: nanoid(),
            muterId: muter.id,
            mutedId: user.id,
            reason: `Test mute ${i + 1} for ${testUser.username}`,
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          },
        });
      } catch (error) {
        // Ignore duplicates
      }
    }
    console.log(`  ✓ Created ${testUser.mutesToReceive} mutes received`);

    // Calculate and display bad user score
    const followers = testUser.followersToCreate;
    const reportRatio = followers > 0 ? testUser.reportsToReceive / followers : testUser.reportsToReceive;
    const blockRatio = followers > 0 ? testUser.blocksToReceive / followers : testUser.blocksToReceive;
    const muteRatio = followers > 0 ? testUser.mutesToReceive / followers : testUser.mutesToReceive;
    const badUserScore = (reportRatio * 5) + (blockRatio * 3) + (muteRatio * 1);

    console.log(`  📊 Metrics for ${testUser.username}:`);
    console.log(`     - Reports: ${testUser.reportsToReceive}, Blocks: ${testUser.blocksToReceive}, Mutes: ${testUser.mutesToReceive}`);
    console.log(`     - Followers: ${followers}`);
    console.log(`     - Report Ratio: ${reportRatio.toFixed(2)}, Block Ratio: ${blockRatio.toFixed(2)}`);
    console.log(`     - Bad User Score: ${badUserScore.toFixed(2)}`);
  }

  console.log('\n✅ Moderation test users seeded successfully!');
  console.log('\n📊 Expected ranking by bad user score (highest to lowest):');
  
  // Calculate and display expected rankings
  const rankings = TEST_USERS
    .filter(u => !u.isBanned)
    .map(u => {
      const followers = u.followersToCreate;
      const reportRatio = followers > 0 ? u.reportsToReceive / followers : u.reportsToReceive;
      const blockRatio = followers > 0 ? u.blocksToReceive / followers : u.blocksToReceive;
      const muteRatio = followers > 0 ? u.mutesToReceive / followers : u.mutesToReceive;
      const badUserScore = (reportRatio * 5) + (blockRatio * 3) + (muteRatio * 1);
      return { username: u.username, score: badUserScore };
    })
    .sort((a, b) => b.score - a.score);

  rankings.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.username} - Score: ${r.score.toFixed(2)}`);
  });
}

// Run if called directly
if (require.main === module) {
  seedModerationTestUsers()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error seeding moderation test users:', error);
      process.exit(1);
    });
}

export { seedModerationTestUsers };

