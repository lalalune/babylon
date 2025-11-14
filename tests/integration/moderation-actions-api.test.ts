/**
 * Integration Tests: Block, Mute, Report APIs
 * 
 * Tests the user-level moderation actions
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/database-service';
import { nanoid } from 'nanoid';

let testUser1: any;
let testUser2: any;
let testUser3: any;

beforeAll(async () => {
  console.log('🌱 Setting up moderation actions test data...');

  // Create test users
  testUser1 = await prisma.user.upsert({
    where: { username: 'test-mod-user1' },
    update: { updatedAt: new Date() },
    create: {
      id: nanoid(),
      username: 'test-mod-user1',
      displayName: 'Test Mod User 1',
      walletAddress: '0xMODUSER10000000000000000000000000000',
      bio: 'Test user for moderation actions',
      profileComplete: true,
      reputationPoints: 1000,
      referralCode: 'MODUSER1',
      virtualBalance: 1000,
      totalDeposited: 1000,
      totalWithdrawn: 0,
      lifetimePnL: 0,
      updatedAt: new Date(),
    },
  });

  testUser2 = await prisma.user.upsert({
    where: { username: 'test-mod-user2' },
    update: { updatedAt: new Date() },
    create: {
      id: nanoid(),
      username: 'test-mod-user2',
      displayName: 'Test Mod User 2',
      walletAddress: '0xMODUSER20000000000000000000000000000',
      bio: 'Test user for moderation actions',
      profileComplete: true,
      reputationPoints: 1000,
      referralCode: 'MODUSER2',
      virtualBalance: 1000,
      totalDeposited: 1000,
      totalWithdrawn: 0,
      lifetimePnL: 0,
      updatedAt: new Date(),
    },
  });

  testUser3 = await prisma.user.upsert({
    where: { username: 'test-mod-user3' },
    update: { updatedAt: new Date() },
    create: {
      id: nanoid(),
      username: 'test-mod-user3',
      displayName: 'Test Mod User 3',
      walletAddress: '0xMODUSER30000000000000000000000000000',
      bio: 'Test user for moderation actions',
      profileComplete: true,
      reputationPoints: 1000,
      referralCode: 'MODUSER3',
      virtualBalance: 1000,
      totalDeposited: 1000,
      totalWithdrawn: 0,
      lifetimePnL: 0,
      updatedAt: new Date(),
    },
  });

  console.log('✅ Test users created');
});

afterAll(async () => {
  console.log('🧹 Cleaning up moderation actions test data...');

  const userIds = [testUser1.id, testUser2.id, testUser3.id];

  // Clean up all moderation actions
  await prisma.report.deleteMany({ where: { reporterId: { in: userIds } } });
  await prisma.report.deleteMany({ where: { reportedUserId: { in: userIds } } });
  await prisma.userBlock.deleteMany({ where: { blockerId: { in: userIds } } });
  await prisma.userBlock.deleteMany({ where: { blockedId: { in: userIds } } });
  await prisma.userMute.deleteMany({ where: { muterId: { in: userIds } } });
  await prisma.userMute.deleteMany({ where: { mutedId: { in: userIds } } });

  // Delete users
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log('✅ Cleanup complete');
});

describe('Block User - CRUD Operations', () => {
  it('should successfully block a user', async () => {
    const block = await prisma.userBlock.create({
      data: {
        id: nanoid(),
        blockerId: testUser1.id,
        blockedId: testUser2.id,
        reason: 'Test block',
      },
    });

    expect(block).not.toBeNull();
    expect(block.blockerId).toBe(testUser1.id);
    expect(block.blockedId).toBe(testUser2.id);
    expect(block.reason).toBe('Test block');

    console.log('✅ User blocked successfully');
    console.log(`   ${testUser1.username} blocked ${testUser2.username}`);
  });

  it('should retrieve block relationship', async () => {
    const block = await prisma.userBlock.findFirst({
      where: {
        blockerId: testUser1.id,
        blockedId: testUser2.id,
      },
      include: {
        blocker: { select: { username: true } },
        blocked: { select: { username: true } },
      },
    });

    expect(block).not.toBeNull();
    expect(block!.blocker.username).toBe(testUser1.username);
    expect(block!.blocked.username).toBe(testUser2.username);

    console.log('✅ Block relationship retrieved');
  });

  it('should count blocks received by a user', async () => {
    const blocksCount = await prisma.userBlock.count({
      where: { blockedId: testUser2.id },
    });

    expect(blocksCount).toBeGreaterThanOrEqual(1);

    console.log('✅ Blocks count works');
    console.log(`   ${testUser2.username} has ${blocksCount} blocks`);
  });

  it('should unblock a user', async () => {
    await prisma.userBlock.deleteMany({
      where: {
        blockerId: testUser1.id,
        blockedId: testUser2.id,
      },
    });

    const block = await prisma.userBlock.findFirst({
      where: {
        blockerId: testUser1.id,
        blockedId: testUser2.id,
      },
    });

    expect(block).toBeNull();

    console.log('✅ User unblocked successfully');
  });

  it('should prevent duplicate blocks', async () => {
    // Create first block
    await prisma.userBlock.create({
      data: {
        id: nanoid(),
        blockerId: testUser1.id,
        blockedId: testUser3.id,
        reason: 'First block',
      },
    });

    // Try to create duplicate
    try {
      await prisma.userBlock.create({
        data: {
          id: nanoid(),
          blockerId: testUser1.id,
          blockedId: testUser3.id,
          reason: 'Duplicate block',
        },
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Should throw unique constraint error
      expect(error.code).toBe('P2002');
      console.log('✅ Duplicate blocks prevented by unique constraint');
    }

    // Cleanup
    await prisma.userBlock.deleteMany({
      where: {
        blockerId: testUser1.id,
        blockedId: testUser3.id,
      },
    });
  });
});

describe('Mute User - CRUD Operations', () => {
  it('should successfully mute a user', async () => {
    const mute = await prisma.userMute.create({
      data: {
        id: nanoid(),
        muterId: testUser1.id,
        mutedId: testUser2.id,
        reason: 'Test mute',
      },
    });

    expect(mute).not.toBeNull();
    expect(mute.muterId).toBe(testUser1.id);
    expect(mute.mutedId).toBe(testUser2.id);
    expect(mute.reason).toBe('Test mute');

    console.log('✅ User muted successfully');
    console.log(`   ${testUser1.username} muted ${testUser2.username}`);
  });

  it('should retrieve mute relationship', async () => {
    const mute = await prisma.userMute.findFirst({
      where: {
        muterId: testUser1.id,
        mutedId: testUser2.id,
      },
      include: {
        muter: { select: { username: true } },
        muted: { select: { username: true } },
      },
    });

    expect(mute).not.toBeNull();
    expect(mute!.muter.username).toBe(testUser1.username);
    expect(mute!.muted.username).toBe(testUser2.username);

    console.log('✅ Mute relationship retrieved');
  });

  it('should count mutes received by a user', async () => {
    const mutesCount = await prisma.userMute.count({
      where: { mutedId: testUser2.id },
    });

    expect(mutesCount).toBeGreaterThanOrEqual(1);

    console.log('✅ Mutes count works');
    console.log(`   ${testUser2.username} has ${mutesCount} mutes`);
  });

  it('should unmute a user', async () => {
    await prisma.userMute.deleteMany({
      where: {
        muterId: testUser1.id,
        mutedId: testUser2.id,
      },
    });

    const mute = await prisma.userMute.findFirst({
      where: {
        muterId: testUser1.id,
        mutedId: testUser2.id,
      },
    });

    expect(mute).toBeNull();

    console.log('✅ User unmuted successfully');
  });

  it('should prevent duplicate mutes', async () => {
    // Create first mute
    await prisma.userMute.create({
      data: {
        id: nanoid(),
        muterId: testUser1.id,
        mutedId: testUser3.id,
        reason: 'First mute',
      },
    });

    // Try to create duplicate
    try {
      await prisma.userMute.create({
        data: {
          id: nanoid(),
          muterId: testUser1.id,
          mutedId: testUser3.id,
          reason: 'Duplicate mute',
        },
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Should throw unique constraint error
      expect(error.code).toBe('P2002');
      console.log('✅ Duplicate mutes prevented by unique constraint');
    }

    // Cleanup
    await prisma.userMute.deleteMany({
      where: {
        muterId: testUser1.id,
        mutedId: testUser3.id,
      },
    });
  });
});

describe('Report User - CRUD Operations', () => {
  it('should successfully create a user report', async () => {
    const report = await prisma.report.create({
      data: {
        id: nanoid(),
        reporterId: testUser1.id,
        reportedUserId: testUser2.id,
        reportType: 'user',
        category: 'spam',
        reason: 'Posting spam content',
        status: 'pending',
        priority: 'normal',
      },
    });

    expect(report).not.toBeNull();
    expect(report.reporterId).toBe(testUser1.id);
    expect(report.reportedUserId).toBe(testUser2.id);
    expect(report.reportType).toBe('user');
    expect(report.category).toBe('spam');
    expect(report.status).toBe('pending');

    console.log('✅ User report created successfully');
    console.log(`   Reporter: ${testUser1.username}`);
    console.log(`   Reported: ${testUser2.username}`);
    console.log(`   Category: ${report.category}`);
  });

  it('should retrieve report with relationships', async () => {
    const report = await prisma.report.findFirst({
      where: {
        reporterId: testUser1.id,
        reportedUserId: testUser2.id,
      },
      include: {
        reporter: { select: { username: true, displayName: true } },
        reportedUser: { select: { username: true, displayName: true } },
      },
    });

    expect(report).not.toBeNull();
    expect(report!.reporter.username).toBe(testUser1.username);
    expect(report!.reportedUser!.username).toBe(testUser2.username);

    console.log('✅ Report relationships retrieved');
    console.log(`   Reporter: ${report!.reporter.displayName}`);
    console.log(`   Reported: ${report!.reportedUser!.displayName}`);
  });

  it('should count reports received by a user', async () => {
    const reportsCount = await prisma.report.count({
      where: { reportedUserId: testUser2.id },
    });

    expect(reportsCount).toBeGreaterThanOrEqual(1);

    console.log('✅ Reports count works');
    console.log(`   ${testUser2.username} has ${reportsCount} reports`);
  });

  it('should update report status', async () => {
    const report = await prisma.report.findFirst({
      where: {
        reporterId: testUser1.id,
        reportedUserId: testUser2.id,
      },
    });

    expect(report).not.toBeNull();

    const updated = await prisma.report.update({
      where: { id: report!.id },
      data: {
        status: 'resolved',
        resolution: 'User warned',
        resolvedAt: new Date(),
      },
    });

    expect(updated.status).toBe('resolved');
    expect(updated.resolution).toBe('User warned');
    expect(updated.resolvedAt).not.toBeNull();

    console.log('✅ Report status updated');
    console.log(`   Status: ${updated.status}`);
    console.log(`   Resolution: ${updated.resolution}`);
  });

  it('should filter reports by status', async () => {
    // Create a few more reports with different statuses
    await prisma.report.create({
      data: {
        id: nanoid(),
        reporterId: testUser1.id,
        reportedUserId: testUser3.id,
        reportType: 'user',
        category: 'harassment',
        reason: 'Harassment test',
        status: 'pending',
        priority: 'high',
      },
    });

    await prisma.report.create({
      data: {
        id: nanoid(),
        reporterId: testUser2.id,
        reportedUserId: testUser3.id,
        reportType: 'user',
        category: 'inappropriate',
        reason: 'Inappropriate content',
        status: 'reviewing',
        priority: 'normal',
      },
    });

    // Query by status
    const pendingReports = await prisma.report.findMany({
      where: { status: 'pending' },
    });

    const reviewingReports = await prisma.report.findMany({
      where: { status: 'reviewing' },
    });

    expect(pendingReports.length).toBeGreaterThanOrEqual(1);
    expect(reviewingReports.length).toBeGreaterThanOrEqual(1);

    console.log('✅ Report filtering by status works');
    console.log(`   Pending: ${pendingReports.length}`);
    console.log(`   Reviewing: ${reviewingReports.length}`);
  });

  it('should filter reports by priority', async () => {
    const highPriorityReports = await prisma.report.findMany({
      where: { priority: 'high' },
    });

    expect(highPriorityReports.length).toBeGreaterThanOrEqual(1);

    console.log('✅ Report filtering by priority works');
    console.log(`   High priority reports: ${highPriorityReports.length}`);
  });

  it('should filter reports by category', async () => {
    const spamReports = await prisma.report.findMany({
      where: { category: 'spam' },
    });

    const harassmentReports = await prisma.report.findMany({
      where: { category: 'harassment' },
    });

    expect(spamReports.length).toBeGreaterThanOrEqual(1);
    expect(harassmentReports.length).toBeGreaterThanOrEqual(1);

    console.log('✅ Report filtering by category works');
    console.log(`   Spam: ${spamReports.length}`);
    console.log(`   Harassment: ${harassmentReports.length}`);
  });
});

describe('Combined Moderation Metrics', () => {
  it('should query all moderation actions for a user', async () => {
    // Get all moderation metrics for testUser2 (who has been blocked, muted, and reported)
    const user = await prisma.user.findUnique({
      where: { id: testUser2.id },
      select: {
        username: true,
        _count: {
          select: {
            UserBlock_UserBlock_blockedIdToUser: true,
            UserMute_UserMute_mutedIdToUser: true,
            Report_Report_reportedUserIdToUser: true,
          },
        },
      },
    });

    expect(user).not.toBeNull();
    expect(user!._count.UserBlock_UserBlock_blockedIdToUser).toBeGreaterThanOrEqual(0);
    expect(user!._count.UserMute_UserMute_mutedIdToUser).toBeGreaterThanOrEqual(0);
    expect(user!._count.Report_Report_reportedUserIdToUser).toBeGreaterThanOrEqual(1);

    console.log('✅ Combined moderation metrics retrieved');
    console.log(`   User: ${user!.username}`);
    console.log(`   Blocks: ${user!._count.UserBlock_UserBlock_blockedIdToUser}`);
    console.log(`   Mutes: ${user!._count.UserMute_UserMute_mutedIdToUser}`);
    console.log(`   Reports: ${user!._count.Report_Report_reportedUserIdToUser}`);
  });

  it('should query users with most reports', async () => {
    const users = await prisma.user.findMany({
      where: {
        id: { in: [testUser1.id, testUser2.id, testUser3.id] },
      },
      select: {
        username: true,
        _count: {
          select: {
            Report_Report_reportedUserIdToUser: true,
          },
        },
      },
      orderBy: {
        Report_Report_reportedUserIdToUser: {
          _count: 'desc',
        },
      },
    });

    expect(users.length).toBe(3);
    
    // testUser2 and testUser3 have reports, testUser1 has none
    console.log('✅ Users sorted by reports received');
    users.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.username}: ${u._count.Report_Report_reportedUserIdToUser} reports`);
    });
  });
});

console.log('\n🎉 All moderation actions API integration tests defined!');

