// @ts-nocheck - Test file

/**
 * Integration Tests: Moderation User Sorting
 * 
 * Tests the admin API for sorting users by moderation metrics
 * Uses real database with seeded test data
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/database-service';
import { nanoid } from 'nanoid';

// Test user data structure
interface TestUser {
  id: string;
  username: string;
  displayName: string;
  reportsReceived: number;
  blocksReceived: number;
  mutesReceived: number;
  followers: number;
}

const TEST_USERS_DATA = [
  {
    username: 'test-bad-user-001',
    displayName: 'Bad User Test',
    reportsToReceive: 25,
    blocksToReceive: 15,
    mutesToReceive: 10,
    followersToCreate: 5,
  },
  {
    username: 'test-spammer-002',
    displayName: 'Spam Bot Test',
    reportsToReceive: 50,
    blocksToReceive: 30,
    mutesToReceive: 20,
    followersToCreate: 2,
  },
  {
    username: 'test-controversial-003',
    displayName: 'Controversial User Test',
    reportsToReceive: 10,
    blocksToReceive: 8,
    mutesToReceive: 5,
    followersToCreate: 10, // Reduced from 50 to 10 to match available reporters
  },
  {
    username: 'test-clean-004',
    displayName: 'Clean User Test',
    reportsToReceive: 0,
    blocksToReceive: 0,
    mutesToReceive: 0,
    followersToCreate: 10, // Reduced from 100 to 10 to match available reporters
  },
];

let createdTestUsers: TestUser[] = [];
let reporterUsers: any[] = [];
let adminUser: any;

// Calculate bad user score
function calculateBadUserScore(reports: number, blocks: number, mutes: number, followers: number): number {
  const reportRatio = followers > 0 ? reports / followers : reports;
  const blockRatio = followers > 0 ? blocks / followers : blocks;
  const muteRatio = followers > 0 ? mutes / followers : mutes;
  return (reportRatio * 5) + (blockRatio * 3) + (muteRatio * 1);
}

beforeAll(async () => {
  console.log('🌱 Setting up moderation sorting test data...');

  // Create enough reporter users to avoid unique constraint issues
  // Need at least 50 for the spammer test case (50 reports)
  for (let i = 0; i < 60; i++) {
    const reporter = await prisma.user.upsert({
      where: { username: `test-reporter-${i}` },
      update: { updatedAt: new Date() },
      create: {
        id: nanoid(),
        username: `test-reporter-${i}`,
        displayName: `Test Reporter ${i}`,
        walletAddress: `0xREPORTER${i.toString().padStart(36, '0')}`,
        bio: 'Test reporter user',
        profileComplete: true,
        reputationPoints: 1000,
        referralCode: `TREPORTER${i}`,
        virtualBalance: 1000,
        totalDeposited: 1000,
        totalWithdrawn: 0,
        lifetimePnL: 0,
      updatedAt: new Date(),
      },
    });
    reporterUsers.push(reporter);
  }

  // Create admin user
  adminUser = await prisma.user.upsert({
    where: { username: 'test-admin-moderation' },
    update: { isAdmin: true, updatedAt: new Date() },
    create: {
      id: nanoid(),
      username: 'test-admin-moderation',
      displayName: 'Test Moderation Admin',
      walletAddress: '0xADMINMODERATION000000000000000000000000',
      bio: 'Admin for moderation tests',
      profileComplete: true,
      reputationPoints: 10000,
      referralCode: 'TESTADMINMOD',
      virtualBalance: 10000,
      totalDeposited: 10000,
      totalWithdrawn: 0,
      lifetimePnL: 0,
      updatedAt: new Date(),
      isAdmin: true,
    },
  });

  // Create test users
  for (const testUser of TEST_USERS_DATA) {
    const user = await prisma.user.upsert({
      where: { username: testUser.username },
      update: { updatedAt: new Date() },
      create: {
        id: nanoid(),
        username: testUser.username,
        displayName: testUser.displayName,
        walletAddress: `0x${testUser.username.toUpperCase().replace(/-/g, '').padEnd(40, '0')}`,
        bio: `Test user: ${testUser.displayName}`,
        profileComplete: true,
        reputationPoints: 1000,
        referralCode: testUser.username.toUpperCase().replace(/-/g, ''),
        virtualBalance: 1000,
        totalDeposited: 1000,
        totalWithdrawn: 0,
        lifetimePnL: 0,
      updatedAt: new Date(),
      },
    });

    // Clean existing data
    await prisma.report.deleteMany({ where: { reportedUserId: user.id } });
    await prisma.userBlock.deleteMany({ where: { blockedId: user.id } });
    await prisma.userMute.deleteMany({ where: { mutedId: user.id } });
    await prisma.follow.deleteMany({ where: { followingId: user.id } });

    // Create followers
    for (let i = 0; i < testUser.followersToCreate; i++) {
      const follower = reporterUsers[i % reporterUsers.length];
      try {
        await prisma.follow.create({
          data: {
            id: nanoid(),
            followerId: follower.id,
            followingId: user.id,
          },
        });
      } catch (error) {
        // Ignore duplicates
      }
    }

    // Create reports
    for (let i = 0; i < testUser.reportsToReceive; i++) {
      const reporter = reporterUsers[i % reporterUsers.length];
      await prisma.report.create({
        data: {
          id: nanoid(),
          reporterId: reporter.id,
          reportedUserId: user.id,
          reportType: 'user',
          category: 'spam',
          reason: `Test report ${i + 1}`,
          status: 'pending',
          priority: 'normal',
        },
      });
    }

    // Create blocks
    for (let i = 0; i < testUser.blocksToReceive; i++) {
      const blocker = reporterUsers[i % reporterUsers.length];
      try {
        await prisma.userBlock.create({
          data: {
            id: nanoid(),
            blockerId: blocker.id,
            blockedId: user.id,
            reason: `Test block ${i + 1}`,
          },
        });
      } catch (error) {
        // Ignore duplicates
      }
    }

    // Create mutes
    for (let i = 0; i < testUser.mutesToReceive; i++) {
      const muter = reporterUsers[i % reporterUsers.length];
      try {
        await prisma.userMute.create({
          data: {
            id: nanoid(),
            muterId: muter.id,
            mutedId: user.id,
            reason: `Test mute ${i + 1}`,
          },
        });
      } catch (error) {
        // Ignore duplicates
      }
    }

    createdTestUsers.push({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      reportsReceived: testUser.reportsToReceive,
      blocksReceived: testUser.blocksToReceive,
      mutesReceived: testUser.mutesToReceive,
      followers: testUser.followersToCreate,
    });
  }

  console.log(`✅ Created ${createdTestUsers.length} test users with moderation metrics`);
});

afterAll(async () => {
  console.log('🧹 Cleaning up moderation test data...');

  // Clean up test users and related data
  const userIds = createdTestUsers.map(u => u.id);
  const reporterIds = reporterUsers.map(r => r.id);
  const allIds = [...userIds, ...reporterIds, adminUser.id];

  await prisma.report.deleteMany({ where: { reporterId: { in: allIds } } });
  await prisma.report.deleteMany({ where: { reportedUserId: { in: userIds } } });
  await prisma.userBlock.deleteMany({ where: { blockedId: { in: userIds } } });
  await prisma.userBlock.deleteMany({ where: { blockerId: { in: allIds } } });
  await prisma.userMute.deleteMany({ where: { mutedId: { in: userIds } } });
  await prisma.userMute.deleteMany({ where: { muterId: { in: allIds } } });
  await prisma.follow.deleteMany({ where: { followingId: { in: userIds } } });
  await prisma.follow.deleteMany({ where: { followerId: { in: allIds } } });
  await prisma.user.deleteMany({ where: { id: { in: allIds } } });

  console.log('✅ Cleanup complete');
});

describe('Moderation User Sorting - Reports Received', () => {
  it('should sort users by reports received (descending)', async () => {
    const users = await prisma.user.findMany({
      where: {
        username: { in: createdTestUsers.map(u => u.username) },
      },
      select: {
        username: true,
        _count: {
          select: {
            Report_Report_reportedUserIdToUser: true,
          },
        },
      },
    });

    // Sort by reports received
    users.sort((a, b) => b._count.Report_Report_reportedUserIdToUser - a._count.Report_Report_reportedUserIdToUser);

    // Verify order
    expect(users[0].username).toBe('test-spammer-002'); // 50 reports
    expect(users[1].username).toBe('test-bad-user-001'); // 25 reports
    expect(users[2].username).toBe('test-controversial-003'); // 10 reports
    expect(users[3].username).toBe('test-clean-004'); // 0 reports

    console.log('✅ Users correctly sorted by reports received');
    users.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.username}: ${u._count.Report_Report_reportedUserIdToUser} reports`);
    });
  });
});

describe('Moderation User Sorting - Blocks Received', () => {
  it('should sort users by blocks received (descending)', async () => {
    const users = await prisma.user.findMany({
      where: {
        username: { in: createdTestUsers.map(u => u.username) },
      },
      select: {
        username: true,
        _count: {
          select: {
            UserBlock_UserBlock_blockedIdToUser: true,
          },
        },
      },
    });

    // Sort by blocks received
    users.sort((a, b) => b._count.UserBlock_UserBlock_blockedIdToUser - a._count.UserBlock_UserBlock_blockedIdToUser);

    // Verify order
    expect(users[0].username).toBe('test-spammer-002'); // 30 blocks
    expect(users[1].username).toBe('test-bad-user-001'); // 15 blocks
    expect(users[2].username).toBe('test-controversial-003'); // 8 blocks
    expect(users[3].username).toBe('test-clean-004'); // 0 blocks

    console.log('✅ Users correctly sorted by blocks received');
    users.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.username}: ${u._count.UserBlock_UserBlock_blockedIdToUser} blocks`);
    });
  });
});

describe('Moderation User Sorting - Mutes Received', () => {
  it('should sort users by mutes received (descending)', async () => {
    const users = await prisma.user.findMany({
      where: {
        username: { in: createdTestUsers.map(u => u.username) },
      },
      select: {
        username: true,
        _count: {
          select: {
            UserMute_UserMute_mutedIdToUser: true,
          },
        },
      },
    });

    // Sort by mutes received
    users.sort((a, b) => b._count.UserMute_UserMute_mutedIdToUser - a._count.UserMute_UserMute_mutedIdToUser);

    // Verify order
    expect(users[0].username).toBe('test-spammer-002'); // 20 mutes
    expect(users[1].username).toBe('test-bad-user-001'); // 10 mutes
    expect(users[2].username).toBe('test-controversial-003'); // 5 mutes
    expect(users[3].username).toBe('test-clean-004'); // 0 mutes

    console.log('✅ Users correctly sorted by mutes received');
    users.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.username}: ${u._count.UserMute_UserMute_mutedIdToUser} mutes`);
    });
  });
});

describe('Moderation User Sorting - Report Ratio', () => {
  it('should sort users by report ratio (reports/followers)', async () => {
    const users = await prisma.user.findMany({
      where: {
        username: { in: createdTestUsers.map(u => u.username) },
      },
      select: {
        username: true,
        _count: {
          select: {
            Report_Report_reportedUserIdToUser: true,
            Follow_Follow_followingIdToUser: true,
          },
        },
      },
    });

    // Calculate and sort by report ratio
    const usersWithRatio = users.map(u => {
      const followers = u._count.Follow_Follow_followingIdToUser;
      const reports = u._count.Report_Report_reportedUserIdToUser;
      const ratio = followers > 0 ? reports / followers : reports;
      return { ...u, ratio };
    });

    usersWithRatio.sort((a, b) => b.ratio - a.ratio);

    // Verify order (spammer has highest ratio: 50/2 = 25.0)
    expect(usersWithRatio[0].username).toBe('test-spammer-002'); // 50/2 = 25.0
    expect(usersWithRatio[1].username).toBe('test-bad-user-001'); // 25/5 = 5.0
    expect(usersWithRatio[2].username).toBe('test-controversial-003'); // 10/50 = 0.2
    expect(usersWithRatio[3].username).toBe('test-clean-004'); // 0/100 = 0

    console.log('✅ Users correctly sorted by report ratio');
    usersWithRatio.forEach((u, i) => {
      const followers = u._count.Follow_Follow_followingIdToUser;
      const reports = u._count.Report_Report_reportedUserIdToUser;
      console.log(`  ${i + 1}. ${u.username}: ${reports}/${followers} = ${u.ratio.toFixed(2)}`);
    });
  });
});

describe('Moderation User Sorting - Block Ratio', () => {
  it('should sort users by block ratio (blocks/followers)', async () => {
    const users = await prisma.user.findMany({
      where: {
        username: { in: createdTestUsers.map(u => u.username) },
      },
      select: {
        username: true,
        _count: {
          select: {
            UserBlock_UserBlock_blockedIdToUser: true,
            Follow_Follow_followingIdToUser: true,
          },
        },
      },
    });

    // Calculate and sort by block ratio
    const usersWithRatio = users.map(u => {
      const followers = u._count.Follow_Follow_followingIdToUser;
      const blocks = u._count.UserBlock_UserBlock_blockedIdToUser;
      const ratio = followers > 0 ? blocks / followers : blocks;
      return { ...u, ratio };
    });

    usersWithRatio.sort((a, b) => b.ratio - a.ratio);

    // Verify order (spammer has highest ratio: 30/2 = 15.0)
    expect(usersWithRatio[0].username).toBe('test-spammer-002'); // 30/2 = 15.0
    expect(usersWithRatio[1].username).toBe('test-bad-user-001'); // 15/5 = 3.0
    expect(usersWithRatio[2].username).toBe('test-controversial-003'); // 8/50 = 0.16
    expect(usersWithRatio[3].username).toBe('test-clean-004'); // 0/100 = 0

    console.log('✅ Users correctly sorted by block ratio');
    usersWithRatio.forEach((u, i) => {
      const followers = u._count.Follow_Follow_followingIdToUser;
      const blocks = u._count.UserBlock_UserBlock_blockedIdToUser;
      console.log(`  ${i + 1}. ${u.username}: ${blocks}/${followers} = ${u.ratio.toFixed(2)}`);
    });
  });
});

describe('Moderation User Sorting - Bad User Score', () => {
  it('should sort users by bad user score (combined likelihood)', async () => {
    const users = await prisma.user.findMany({
      where: {
        username: { in: createdTestUsers.map(u => u.username) },
      },
      select: {
        username: true,
        _count: {
          select: {
            Report_Report_reportedUserIdToUser: true,
            UserBlock_UserBlock_blockedIdToUser: true,
            UserMute_UserMute_mutedIdToUser: true,
            Follow_Follow_followingIdToUser: true,
          },
        },
      },
    });

    // Calculate and sort by bad user score
    const usersWithScore = users.map(u => {
      const followers = u._count.Follow_Follow_followingIdToUser;
      const reports = u._count.Report_Report_reportedUserIdToUser;
      const blocks = u._count.UserBlock_UserBlock_blockedIdToUser;
      const mutes = u._count.UserMute_UserMute_mutedIdToUser;
      
      const score = calculateBadUserScore(reports, blocks, mutes, followers);
      return { ...u, score, followers, reports, blocks, mutes };
    });

    usersWithScore.sort((a, b) => b.score - a.score);

    // Verify order (spammer should have highest score)
    expect(usersWithScore[0].username).toBe('test-spammer-002');
    expect(usersWithScore[1].username).toBe('test-bad-user-001');
    expect(usersWithScore[2].username).toBe('test-controversial-003');
    expect(usersWithScore[3].username).toBe('test-clean-004');

    console.log('✅ Users correctly sorted by bad user score');
    console.log('\n📊 Detailed scores:');
    usersWithScore.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.username}:`);
      console.log(`     - Reports: ${u.reports}, Blocks: ${u.blocks}, Mutes: ${u.mutes}, Followers: ${u.followers}`);
      console.log(`     - Bad User Score: ${u.score.toFixed(2)}`);
    });

    // Verify scores are calculated correctly
    const spammerScore = calculateBadUserScore(50, 30, 20, 2);
    expect(usersWithScore[0].score).toBeCloseTo(spammerScore, 1);

    const badUserScore = calculateBadUserScore(25, 15, 10, 5);
    expect(usersWithScore[1].score).toBeCloseTo(badUserScore, 1);
  });

  it('should handle users with zero followers correctly', async () => {
    // Create a user with no followers but some reports
    const noFollowerUser = await prisma.user.create({
      data: {
        id: nanoid(),
        username: 'test-no-followers',
        displayName: 'No Followers User',
        walletAddress: '0xNOFOLLOWERS000000000000000000000000000',
        bio: 'User with no followers',
        profileComplete: true,
        reputationPoints: 100,
        referralCode: 'NOFOLLOWERS',
        virtualBalance: 100,
        totalDeposited: 100,
        totalWithdrawn: 0,
        lifetimePnL: 0,
          isTest: true,
      updatedAt: new Date(),
      },
    });

    // Add some reports
    for (let i = 0; i < 10; i++) {
      await prisma.report.create({
        data: {
          id: nanoid(),
          reporterId: reporterUsers[0].id,
          reportedUserId: noFollowerUser.id,
          reportType: 'user',
          category: 'spam',
          reason: 'Test report',
          status: 'pending',
          priority: 'normal',
        },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: noFollowerUser.id },
      select: {
        username: true,
        _count: {
          select: {
            Report_Report_reportedUserIdToUser: true,
            UserBlock_UserBlock_blockedIdToUser: true,
            UserMute_UserMute_mutedIdToUser: true,
            Follow_Follow_followingIdToUser: true,
          },
        },
      },
    });

    expect(user).not.toBeNull();
    
    if (user) {
      const score = calculateBadUserScore(
        user._count.Report_Report_reportedUserIdToUser,
        user._count.UserBlock_UserBlock_blockedIdToUser,
        user._count.UserMute_UserMute_mutedIdToUser,
        user._count.Follow_Follow_followingIdToUser
      );

      // With 0 followers and 10 reports, score should be 10 * 5 = 50
      expect(score).toBe(50);
      
      console.log('✅ Zero followers case handled correctly');
      console.log(`   Score for 10 reports, 0 followers: ${score}`);
    }

    // Cleanup
    await prisma.report.deleteMany({ where: { reportedUserId: noFollowerUser.id } });
    await prisma.user.delete({ where: { id: noFollowerUser.id } });
  });
});

describe('Moderation Metrics - Accuracy', () => {
  it('should accurately count all moderation metrics', async () => {
    for (const testUser of createdTestUsers) {
      const user = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: {
          username: true,
          _count: {
            select: {
              Report_Report_reportedUserIdToUser: true,
              UserBlock_UserBlock_blockedIdToUser: true,
              UserMute_UserMute_mutedIdToUser: true,
              Follow_Follow_followingIdToUser: true,
            },
          },
        },
      });

      expect(user).not.toBeNull();
      
      if (user) {
        expect(user._count.Report_Report_reportedUserIdToUser).toBe(testUser.reportsReceived);
        expect(user._count.UserBlock_UserBlock_blockedIdToUser).toBe(testUser.blocksReceived);
        expect(user._count.UserMute_UserMute_mutedIdToUser).toBe(testUser.mutesReceived);
        expect(user._count.Follow_Follow_followingIdToUser).toBe(testUser.followers);

        console.log(`✅ ${user.username} metrics match expected values`);
        console.log(`   Reports: ${user._count.Report_Report_reportedUserIdToUser}/${testUser.reportsReceived}`);
        console.log(`   Blocks: ${user._count.UserBlock_UserBlock_blockedIdToUser}/${testUser.blocksReceived}`);
        console.log(`   Mutes: ${user._count.UserMute_UserMute_mutedIdToUser}/${testUser.mutesReceived}`);
        console.log(`   Followers: ${user._count.Follow_Follow_followingIdToUser}/${testUser.followers}`);
      }
    }
  });
});

console.log('\n🎉 All moderation sorting integration tests defined!');

