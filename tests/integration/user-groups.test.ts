/**
 * User Groups Integration Tests
 * 
 * Tests user group management:
 * - Creating groups
 * - Adding/removing members
 * - Admin management
 * - Group deletion
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';

describe('User Groups', () => {
  let testUser1Id: string;
  let testUser2Id: string;
  let testUser3Id: string;
  let testGroupId: string;

  beforeAll(async () => {
    // Create test users
    testUser1Id = await generateSnowflakeId();
    testUser2Id = await generateSnowflakeId();
    testUser3Id = await generateSnowflakeId();

    await prisma.user.createMany({
      data: [
        {
          id: testUser1Id,
          username: `testuser1_${Date.now()}`,
          displayName: 'Test User 1',
          isActor: false,
          updatedAt: new Date(),
        },
        {
          id: testUser2Id,
          username: `testuser2_${Date.now()}`,
          displayName: 'Test User 2',
          isActor: false,
          updatedAt: new Date(),
        },
        {
          id: testUser3Id,
          username: `testuser3_${Date.now()}`,
          displayName: 'Test User 3',
          isActor: false,
          updatedAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.userGroup.deleteMany({
      where: {
        id: testGroupId,
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testUser1Id, testUser2Id, testUser3Id],
        },
      },
    });
  });

  it('should create a user group', async () => {
    testGroupId = await generateSnowflakeId();

    const group = await prisma.userGroup.create({
      data: {
        id: testGroupId,
        name: 'Test Trading Group',
        description: 'A group for testing',
        createdById: testUser1Id,
        updatedAt: new Date(),
        UserGroupMember: {
          create: {
            id: await generateSnowflakeId(),
            userId: testUser1Id,
            addedBy: testUser1Id,
          },
        },
        UserGroupAdmin: {
          create: {
            id: await generateSnowflakeId(),
            userId: testUser1Id,
            grantedBy: testUser1Id,
          },
        },
      },
      include: {
        UserGroupMember: true,
        UserGroupAdmin: true,
      },
    });

    expect(group).toBeDefined();
    expect(group.name).toBe('Test Trading Group');
    expect(group.UserGroupMember).toHaveLength(1);
    expect(group.UserGroupAdmin).toHaveLength(1);
  });

  it('should add members to group', async () => {
    // Add user 2
    await prisma.userGroupMember.create({
      data: {
        id: await generateSnowflakeId(),
        groupId: testGroupId,
        userId: testUser2Id,
        addedBy: testUser1Id,
      },
    });

    // Add user 3
    await prisma.userGroupMember.create({
      data: {
        id: await generateSnowflakeId(),
        groupId: testGroupId,
        userId: testUser3Id,
        addedBy: testUser1Id,
      },
    });

    const members = await prisma.userGroupMember.findMany({
      where: { groupId: testGroupId },
    });

    expect(members).toHaveLength(3);
  });

  it('should grant admin privileges', async () => {
    await prisma.userGroupAdmin.create({
      data: {
        id: await generateSnowflakeId(),
        groupId: testGroupId,
        userId: testUser2Id,
        grantedBy: testUser1Id,
      },
    });

    const admins = await prisma.userGroupAdmin.findMany({
      where: { groupId: testGroupId },
    });

    expect(admins).toHaveLength(2);
    expect(admins.some(a => a.userId === testUser2Id)).toBe(true);
  });

  it('should revoke admin privileges', async () => {
    await prisma.userGroupAdmin.delete({
      where: {
        groupId_userId: {
          groupId: testGroupId,
          userId: testUser2Id,
        },
      },
    });

    const admins = await prisma.userGroupAdmin.findMany({
      where: { groupId: testGroupId },
    });

    expect(admins).toHaveLength(1);
    expect(admins[0]?.userId).toBe(testUser1Id);
  });

  it('should remove member from group', async () => {
    await prisma.userGroupMember.delete({
      where: {
        groupId_userId: {
          groupId: testGroupId,
          userId: testUser3Id,
        },
      },
    });

    const members = await prisma.userGroupMember.findMany({
      where: { groupId: testGroupId },
    });

    expect(members).toHaveLength(2);
    expect(members.some(m => m.userId === testUser3Id)).toBe(false);
  });

  it('should prevent duplicate members', async () => {
    await expect(
      prisma.userGroupMember.create({
        data: {
          id: await generateSnowflakeId(),
          groupId: testGroupId,
          userId: testUser2Id, // Already a member
          addedBy: testUser1Id,
        },
      })
    ).rejects.toThrow();
  });

  it('should find groups for a user', async () => {
    const groups = await prisma.userGroup.findMany({
      where: {
        UserGroupMember: {
          some: {
            userId: testUser1Id,
          },
        },
      },
      include: {
        UserGroupMember: true,
      },
    });

    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]?.id).toBe(testGroupId);
  });
});

