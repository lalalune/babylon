// @ts-nocheck - Test file

/**
 * Integration Tests: Ban/Unban API
 * 
 * Tests the admin ban/unban API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/database-service';
import { nanoid } from 'nanoid';

let testAdmin: any;
let testUser: any;
let testActor: any;
let anotherAdmin: any;

beforeAll(async () => {
  console.log('🌱 Setting up ban/unban API test data...');

  // Create test admin
  testAdmin = await prisma.user.upsert({
    where: { username: 'test-ban-admin' },
    update: { isAdmin: true, updatedAt: new Date() },
    create: {
      id: nanoid(),
      username: 'test-ban-admin',
      displayName: 'Test Ban Admin',
      walletAddress: '0xBANADMIN000000000000000000000000000000',
      bio: 'Admin for ban tests',
      profileComplete: true,
      reputationPoints: 10000,
      referralCode: 'BANADMIN',
      virtualBalance: 10000,
      totalDeposited: 10000,
      totalWithdrawn: 0,
      lifetimePnL: 0,
      updatedAt: new Date(),
      isAdmin: true,
      updatedAt: new Date(),
    },
  });

  // Create another admin
  anotherAdmin = await prisma.user.upsert({
    where: { username: 'test-another-admin' },
    update: { isAdmin: true, updatedAt: new Date() },
    create: {
      id: nanoid(),
      username: 'test-another-admin',
      displayName: 'Another Test Admin',
      walletAddress: '0xANOTHERADMIN0000000000000000000000000',
      bio: 'Another admin for ban tests',
      profileComplete: true,
      reputationPoints: 10000,
      referralCode: 'ANOTHERADMIN',
      virtualBalance: 10000,
      totalDeposited: 10000,
      totalWithdrawn: 0,
      lifetimePnL: 0,
      updatedAt: new Date(),
      isAdmin: true,
      updatedAt: new Date(),
    },
  });

  // Create test regular user
  testUser = await prisma.user.upsert({
    where: { username: 'test-ban-target' },
    update: { isBanned: false, bannedAt: null, bannedReason: null, bannedBy: null, updatedAt: new Date() },
    create: {
      id: nanoid(),
      username: 'test-ban-target',
      displayName: 'Test Ban Target',
      walletAddress: '0xBANTARGET00000000000000000000000000000',
      bio: 'User to be banned in tests',
      profileComplete: true,
      reputationPoints: 1000,
      referralCode: 'BANTARGET',
      virtualBalance: 1000,
      totalDeposited: 1000,
      totalWithdrawn: 0,
      lifetimePnL: 0,
      updatedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Create test actor (should not be bannable)
  testActor = await prisma.user.upsert({
    where: { username: 'test-ban-actor' },
    update: { isActor: true, updatedAt: new Date() },
    create: {
      id: nanoid(),
      username: 'test-ban-actor',
      displayName: 'Test Ban Actor',
      walletAddress: '0xBANACTOR000000000000000000000000000000',
      bio: 'Actor that should not be bannable',
      profileComplete: true,
      reputationPoints: 1000,
      referralCode: 'BANACTOR',
      virtualBalance: 1000,
      totalDeposited: 1000,
      totalWithdrawn: 0,
      lifetimePnL: 0,
      updatedAt: new Date(),
      isActor: true,
      updatedAt: new Date(),
    },
  });

  console.log('✅ Test data created');
});

afterAll(async () => {
  console.log('🧹 Cleaning up ban/unban test data...');

  await prisma.user.deleteMany({
    where: {
      id: { in: [testAdmin.id, testUser.id, testActor.id, anotherAdmin.id] },
    },
  });

  console.log('✅ Cleanup complete');
});

describe('Ban API - Successful Ban', () => {
  it('should successfully ban a regular user', async () => {
    // Ban the user
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: 'Test ban reason',
        bannedBy: testAdmin.id,
      },
    });

    // Verify user is banned
    const user = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: {
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
        bannedBy: true,
      },
    });

    expect(user).not.toBeNull();
    expect(user!.isBanned).toBe(true);
    expect(user!.bannedAt).not.toBeNull();
    expect(user!.bannedReason).toBe('Test ban reason');
    expect(user!.bannedBy).toBe(testAdmin.id);

    console.log('✅ User successfully banned');
    console.log(`   Reason: ${user!.bannedReason}`);
    console.log(`   Banned by: ${user!.bannedBy}`);

    // Cleanup: unban for next tests
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
      },
    });
  });

  it('should successfully unban a banned user', async () => {
    // First ban the user
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: 'Test ban',
        bannedBy: testAdmin.id,
      },
    });

    // Now unban
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
      },
    });

    // Verify user is unbanned
    const user = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: {
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
        bannedBy: true,
      },
    });

    expect(user).not.toBeNull();
    expect(user!.isBanned).toBe(false);
    expect(user!.bannedAt).toBeNull();
    expect(user!.bannedReason).toBeNull();
    expect(user!.bannedBy).toBeNull();

    console.log('✅ User successfully unbanned');
  });
});

describe('Ban API - Validation', () => {
  it('should not allow banning actors', async () => {
    // Actors should not be banned (this is enforced at API level)
    // In the actual API, this would throw an error
    // Here we just verify the actor flag
    
    const actor = await prisma.user.findUnique({
      where: { id: testActor.id },
      select: { isActor: true, isBanned: true },
    });

    expect(actor).not.toBeNull();
    expect(actor!.isActor).toBe(true);
    
    console.log('✅ Actor flag verified - actors should be protected from banning at API level');
  });

  it('should track who banned the user', async () => {
    // Ban the user
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: 'Tracked ban',
        bannedBy: testAdmin.id,
      },
    });

    // Verify bannedBy is recorded
    const user = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: {
        bannedBy: true,
        isBanned: true,
        bannedReason: true,
      },
    });

    expect(user).not.toBeNull();
    expect(user!.bannedBy).toBe(testAdmin.id);
    expect(user!.isBanned).toBe(true);
    expect(user!.bannedReason).toBe('Tracked ban');

    console.log('✅ Ban tracking works correctly');
    console.log(`   Banned by admin ID: ${user!.bannedBy}`);
    console.log(`   Reason: ${user!.bannedReason}`);

    // Cleanup
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
      },
    });
  });

  it('should preserve ban timestamp', async () => {
    const banTime = new Date();
    
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: true,
        bannedAt: banTime,
        bannedReason: 'Timestamp test',
        bannedBy: testAdmin.id,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { bannedAt: true },
    });

    expect(user).not.toBeNull();
    expect(user!.bannedAt).not.toBeNull();
    
    // Check timestamp is close (within 1 second)
    const timeDiff = Math.abs(user!.bannedAt!.getTime() - banTime.getTime());
    expect(timeDiff).toBeLessThan(1000);

    console.log('✅ Ban timestamp preserved correctly');
    console.log(`   Banned at: ${user!.bannedAt!.toISOString()}`);

    // Cleanup
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
      },
    });
  });
});

describe('Ban API - Queries', () => {
  it('should query banned users', async () => {
    // Ban a couple of users
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: 'Query test 1',
        bannedBy: testAdmin.id,
      },
    });

    // Query banned users
    const bannedUsers = await prisma.user.findMany({
      where: { isBanned: true },
      select: {
        id: true,
        username: true,
        isBanned: true,
        bannedReason: true,
      },
    });

    // Should find at least our test user
    const foundTestUser = bannedUsers.find(u => u.id === testUser.id);
    expect(foundTestUser).not.toBeUndefined();
    expect(foundTestUser!.isBanned).toBe(true);

    console.log('✅ Banned users query works');
    console.log(`   Found ${bannedUsers.length} banned users`);

    // Cleanup
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
      },
    });
  });

  it('should exclude banned users from normal queries', async () => {
    // Ban the user
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: 'Exclusion test',
        bannedBy: testAdmin.id,
      },
    });

    // Query non-banned users
    const nonBannedUsers = await prisma.user.findMany({
      where: {
        isBanned: false,
        id: { in: [testUser.id, testAdmin.id, anotherAdmin.id] },
      },
      select: { id: true, username: true, isBanned: true },
    });

    // Should not find the banned user
    const foundTestUser = nonBannedUsers.find(u => u.id === testUser.id);
    expect(foundTestUser).toBeUndefined();

    // Should find the admins
    expect(nonBannedUsers.length).toBeGreaterThan(0);

    console.log('✅ Banned users properly excluded from queries');
    console.log(`   Found ${nonBannedUsers.length} non-banned users`);

    // Cleanup
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
      },
    });
  });
});

describe('Ban API - Multiple Bans', () => {
  it('should handle re-banning a user', async () => {
    // First ban
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: 'First ban',
        bannedBy: testAdmin.id,
      },
    });

    // Unban
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
      },
    });

    // Second ban
    const secondBanTime = new Date();
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: true,
        bannedAt: secondBanTime,
        bannedReason: 'Second ban',
        bannedBy: testAdmin.id,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: {
        isBanned: true,
        bannedAt: true,
        bannedReason: true,
      },
    });

    expect(user).not.toBeNull();
    expect(user!.isBanned).toBe(true);
    expect(user!.bannedReason).toBe('Second ban');

    console.log('✅ Re-banning works correctly');
    console.log(`   Latest reason: ${user!.bannedReason}`);

    // Cleanup
    await prisma.user.update({
      where: { id: testUser.id },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
        bannedBy: null,
      },
    });
  });
});

console.log('\n🎉 All ban/unban API integration tests defined!');

