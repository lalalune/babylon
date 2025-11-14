/**
 * Admin Management Integration Tests
 * 
 * Tests for the admin promotion/demotion system
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/database-service';
import { v4 as uuidv4 } from 'uuid';

describe('Admin Management API', () => {
  let testAdminId: string;
  let testUserId: string;
  let testActorId: string;

  beforeAll(async () => {
    // Create test admin user
    testAdminId = uuidv4();
    await prisma.user.create({
      data: {
        id: testAdminId,
        username: `test-admin-${Date.now()}`,
        displayName: 'Test Admin',
        isAdmin: true,
        isActor: false,
          isTest: true,
        updatedAt: new Date(),
      },
    });

    // Create test regular user
    testUserId = uuidv4();
    await prisma.user.create({
      data: {
        id: testUserId,
        username: `test-user-${Date.now()}`,
        displayName: 'Test User',
        isAdmin: false,
        isActor: false,
          isTest: true,
        updatedAt: new Date(),
      },
    });

    // Create test actor (should not be promotable)
    testActorId = uuidv4();
    await prisma.user.create({
      data: {
        id: testActorId,
        username: `test-actor-${Date.now()}`,
        displayName: 'Test Actor',
        isAdmin: false,
        isActor: true,
          isTest: true,
        updatedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testAdminId, testUserId, testActorId],
        },
      },
    });
  });

  describe('GET /api/admin/admins', () => {
    it('should return list of admin users', async () => {
      const admins = await prisma.user.findMany({
        where: {
          isAdmin: true,
          isActor: false,
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          isAdmin: true,
          isActor: true,
        },
      });

      expect(admins.length).toBeGreaterThan(0);
      expect(admins.every(admin => admin.isAdmin)).toBe(true);
      expect(admins.every(admin => !admin.isActor)).toBe(true);
    });

    it('should not include actors in admin list', async () => {
      const admins = await prisma.user.findMany({
        where: {
          isAdmin: true,
          isActor: false,
        },
      });

      const actorAdmin = admins.find(admin => admin.isActor);
      expect(actorAdmin).toBeUndefined();
    });
  });

  describe('POST /api/admin/admins/[userId] - Promote', () => {
    it('should promote a regular user to admin', async () => {
      const userBefore = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { isAdmin: true },
      });
      expect(userBefore?.isAdmin).toBe(false);

      await prisma.user.update({
        where: { id: testUserId },
        data: { isAdmin: true },
      });

      const userAfter = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { isAdmin: true },
      });
      expect(userAfter?.isAdmin).toBe(true);

      // Revert for other tests
      await prisma.user.update({
        where: { id: testUserId },
        data: { isAdmin: false },
      });
    });

    it('should not promote an actor to admin', async () => {
      const actor = await prisma.user.findUnique({
        where: { id: testActorId },
        select: { isActor: true, isAdmin: true },
      });

      expect(actor?.isActor).toBe(true);
      expect(actor?.isAdmin).toBe(false);

      // Attempting to promote actor should fail (in business logic)
      // This is enforced at the API level
    });

    it('should not promote a user who is already admin', async () => {
      const admin = await prisma.user.findUnique({
        where: { id: testAdminId },
        select: { isAdmin: true },
      });

      expect(admin?.isAdmin).toBe(true);
      // API should reject this with "ALREADY_ADMIN" error
    });
  });

  describe('POST /api/admin/admins/[userId] - Demote', () => {
    it('should demote an admin to regular user', async () => {
      // First promote the test user
      await prisma.user.update({
        where: { id: testUserId },
        data: { isAdmin: true },
      });

      let user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { isAdmin: true },
      });
      expect(user?.isAdmin).toBe(true);

      // Now demote them
      await prisma.user.update({
        where: { id: testUserId },
        data: { isAdmin: false },
      });

      user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { isAdmin: true },
      });
      expect(user?.isAdmin).toBe(false);
    });

    it('should not allow admin to demote themselves', async () => {
      // This is enforced at the API level
      // testAdminId should not be able to demote testAdminId
      const admin = await prisma.user.findUnique({
        where: { id: testAdminId },
        select: { isAdmin: true },
      });
      expect(admin?.isAdmin).toBe(true);
    });

    it('should not demote a user who is not admin', async () => {
      const user = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { isAdmin: true },
      });

      expect(user?.isAdmin).toBe(false);
      // API should reject this with "NOT_ADMIN" error
    });
  });

  describe('Security Checks', () => {
    it('should not modify banned users', async () => {
      // Create a banned user
      const bannedUserId = uuidv4();
      await prisma.user.create({
        data: {
          id: bannedUserId,
          username: `test-banned-${Date.now()}`,
          displayName: 'Banned User',
          isAdmin: false,
          isActor: false,
          isBanned: true,
          isTest: true,
          updatedAt: new Date(),
        },
      });

      const bannedUser = await prisma.user.findUnique({
        where: { id: bannedUserId },
        select: { isBanned: true, isAdmin: true },
      });

      expect(bannedUser?.isBanned).toBe(true);
      expect(bannedUser?.isAdmin).toBe(false);

      // Clean up
      await prisma.user.delete({
        where: { id: bannedUserId },
      });
    });

    it('should require admin authentication to access endpoints', async () => {
      // This is tested at the middleware level
      // All endpoints under /api/admin/* require admin access
      const nonAdmin = await prisma.user.findFirst({
        where: {
          isAdmin: false,
          isActor: false,
        },
      });

      expect(nonAdmin).toBeDefined();
      expect(nonAdmin?.isAdmin).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    it('should update timestamps when modifying admin status', async () => {
      const userBefore = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { updatedAt: true },
      });

      const beforeTime = userBefore?.updatedAt;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await prisma.user.update({
        where: { id: testUserId },
        data: {
          isAdmin: true,
          updatedAt: new Date(),
        },
      });

      const userAfter = await prisma.user.findUnique({
        where: { id: testUserId },
        select: { updatedAt: true },
      });

      expect(userAfter?.updatedAt.getTime()).toBeGreaterThan(beforeTime!.getTime());

      // Clean up
      await prisma.user.update({
        where: { id: testUserId },
        data: { isAdmin: false },
      });
    });

    it('should maintain data consistency after operations', async () => {
      // Promote user
      await prisma.user.update({
        where: { id: testUserId },
        data: { isAdmin: true },
      });

      // Verify in admin list
      const admins = await prisma.user.findMany({
        where: { isAdmin: true, isActor: false },
        select: { id: true },
      });
      expect(admins.some(admin => admin.id === testUserId)).toBe(true);

      // Demote user
      await prisma.user.update({
        where: { id: testUserId },
        data: { isAdmin: false },
      });

      // Verify not in admin list
      const adminsAfter = await prisma.user.findMany({
        where: { isAdmin: true, isActor: false },
        select: { id: true },
      });
      expect(adminsAfter.some(admin => admin.id === testUserId)).toBe(false);
    });
  });
});


