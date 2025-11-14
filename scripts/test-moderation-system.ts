/**
 * Moderation System Test Script
 * 
 * Comprehensive integration test for the moderation system
 */

import { prisma } from '@/lib/database-service';
import { generateSnowflakeId } from '@/lib/snowflake';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ test: name, passed: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ 
      test: name, 
      passed: false, 
      error: error instanceof Error ? error.message : String(error)
    });
    console.error(`❌ ${name}:`, error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('🧪 Testing Moderation System...\n');

  // Create test users
  const testUser1Id = await generateSnowflakeId();
  const testUser2Id = await generateSnowflakeId();
  const testPostId = await generateSnowflakeId();

  try {
    // Setup test users
    await runTest('Create test user 1', async () => {
      await prisma.user.create({
        data: {
          id: testUser1Id,
          displayName: 'Test User 1',
          username: `testuser1_${Date.now()}`,
          createdAt: new Date(),
          isTest: true,
          updatedAt: new Date(),
        },
      });
    });

    await runTest('Create test user 2', async () => {
      await prisma.user.create({
        data: {
          id: testUser2Id,
          displayName: 'Test User 2',
          username: `testuser2_${Date.now()}`,
          createdAt: new Date(),
          isTest: true,
          updatedAt: new Date(),
        },
      });
    });

    await runTest('Create test post', async () => {
      await prisma.post.create({
        data: {
          id: testPostId,
          content: 'This is a test post for moderation testing',
          authorId: testUser2Id,
          timestamp: new Date(),
          createdAt: new Date(),
        },
      });
    });

    // Test blocking
    await runTest('User 1 blocks User 2', async () => {
      const block = await prisma.userBlock.create({
        data: {
          id: await generateSnowflakeId(),
          blockerId: testUser1Id,
          blockedId: testUser2Id,
          reason: 'Test block',
        },
      });

      if (block.blockerId !== testUser1Id) {
        throw new Error('Block not created correctly');
      }
    });

    await runTest('Check block exists', async () => {
      const block = await prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: testUser1Id,
            blockedId: testUser2Id,
          },
        },
      });

      if (!block) {
        throw new Error('Block not found');
      }
    });

    await runTest('List User 1 blocks', async () => {
      const blocks = await prisma.userBlock.findMany({
        where: { blockerId: testUser1Id },
        include: { blocked: true },
      });

      if (blocks.length !== 1) {
        throw new Error(`Expected 1 block, got ${blocks.length}`);
      }
    });

    await runTest('Unblock User 2', async () => {
      const deleted = await prisma.userBlock.deleteMany({
        where: {
          blockerId: testUser1Id,
          blockedId: testUser2Id,
        },
      });

      if (deleted.count !== 1) {
        throw new Error('Block not deleted');
      }
    });

    // Test muting
    await runTest('User 1 mutes User 2', async () => {
      const mute = await prisma.userMute.create({
        data: {
          id: await generateSnowflakeId(),
          muterId: testUser1Id,
          mutedId: testUser2Id,
          reason: 'Test mute',
        },
      });

      if (mute.muterId !== testUser1Id) {
        throw new Error('Mute not created correctly');
      }
    });

    await runTest('Check mute exists', async () => {
      const mute = await prisma.userMute.findUnique({
        where: {
          muterId_mutedId: {
            muterId: testUser1Id,
            mutedId: testUser2Id,
          },
        },
      });

      if (!mute) {
        throw new Error('Mute not found');
      }
    });

    await runTest('Unmute User 2', async () => {
      const deleted = await prisma.userMute.deleteMany({
        where: {
          muterId: testUser1Id,
          mutedId: testUser2Id,
        },
      });

      if (deleted.count !== 1) {
        throw new Error('Mute not deleted');
      }
    });

    // Test reporting
    await runTest('User 1 reports User 2', async () => {
      const report = await prisma.report.create({
        data: {
          id: await generateSnowflakeId(),
          reporterId: testUser1Id,
          reportedUserId: testUser2Id,
          reportType: 'user',
          category: 'spam',
          reason: 'Test report: This user is posting spam content',
          priority: 'low',
          status: 'pending',
        },
      });

      if (report.reporterId !== testUser1Id) {
        throw new Error('Report not created correctly');
      }
    });

    await runTest('User 1 reports test post', async () => {
      const report = await prisma.report.create({
        data: {
          id: await generateSnowflakeId(),
          reporterId: testUser1Id,
          reportedPostId: testPostId,
          reportType: 'post',
          category: 'inappropriate',
          reason: 'Test report: This post contains inappropriate content',
          priority: 'normal',
          status: 'pending',
        },
      });

      if (report.reportedPostId !== testPostId) {
        throw new Error('Post report not created correctly');
      }
    });

    await runTest('List reports for User 1', async () => {
      const reports = await prisma.report.findMany({
        where: { reporterId: testUser1Id },
        include: {
          reportedUser: true,
          reporter: true,
        },
      });

      if (reports.length !== 2) {
        throw new Error(`Expected 2 reports, got ${reports.length}`);
      }
    });

    await runTest('List reports about User 2', async () => {
      const reports = await prisma.report.findMany({
        where: { reportedUserId: testUser2Id },
      });

      if (reports.length !== 1) {
        throw new Error(`Expected 1 report, got ${reports.length}`);
      }
    });

    await runTest('List reports by category', async () => {
      const reports = await prisma.report.findMany({
        where: { category: 'spam' },
      });

      if (reports.length < 1) {
        throw new Error('No spam reports found');
      }
    });

    await runTest('List reports by status', async () => {
      const reports = await prisma.report.findMany({
        where: { status: 'pending' },
      });

      if (reports.length < 2) {
        throw new Error('Expected at least 2 pending reports');
      }
    });

    await runTest('Update report status', async () => {
      const report = await prisma.report.findFirst({
        where: {
          reporterId: testUser1Id,
          reportedUserId: testUser2Id,
        },
      });

      if (!report) throw new Error('Report not found');

      const updated = await prisma.report.update({
        where: { id: report.id },
        data: {
          status: 'resolved',
          resolution: 'Test resolution',
          resolvedAt: new Date(),
        },
      });

      if (updated.status !== 'resolved') {
        throw new Error('Report status not updated');
      }
    });

    await runTest('Count reports by category', async () => {
      const grouped = await prisma.report.groupBy({
        by: ['category'],
        _count: true,
      });

      if (grouped.length === 0) {
        throw new Error('No grouped results');
      }
    });

    await runTest('Count reports by priority', async () => {
      const grouped = await prisma.report.groupBy({
        by: ['priority'],
        _count: true,
      });

      if (grouped.length === 0) {
        throw new Error('No grouped results');
      }
    });

    await runTest('Get statistics', async () => {
      const [total, pending, resolved] = await Promise.all([
        prisma.report.count(),
        prisma.report.count({ where: { status: 'pending' } }),
        prisma.report.count({ where: { status: 'resolved' } }),
      ]);

      if (total === 0) {
        throw new Error('No reports found');
      }

      console.log(`    Total: ${total}, Pending: ${pending}, Resolved: ${resolved}`);
    });

  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    
    await prisma.report.deleteMany({
      where: {
        OR: [
          { reporterId: testUser1Id },
          { reportedUserId: testUser2Id },
          { reportedPostId: testPostId },
        ],
      },
    });

    await prisma.userBlock.deleteMany({
      where: {
        OR: [
          { blockerId: testUser1Id },
          { blockedId: testUser2Id },
        ],
      },
    });

    await prisma.userMute.deleteMany({
      where: {
        OR: [
          { muterId: testUser1Id },
          { mutedId: testUser2Id },
        ],
      },
    });

    await prisma.post.deleteMany({
      where: { id: testPostId },
    });

    await prisma.user.deleteMany({
      where: {
        id: { in: [testUser1Id, testUser2Id] },
      },
    });
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.error}`);
    });
  }
  
  console.log('='.repeat(60));
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Moderation system is working correctly.\n');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.\n');
    process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });

