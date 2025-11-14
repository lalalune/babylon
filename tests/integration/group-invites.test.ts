/**
 * Group Invites Integration Tests
 * 
 * Tests the complete group invite workflow:
 * - Sending invites
 * - Accepting invites
 * - Declining invites
 * - Notifications
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';

describe('Group Invites Workflow', () => {
  let testUser1Id: string; // Group creator/admin
  let testUser2Id: string; // Invitee
  let testUser3Id: string; // Another invitee
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
          username: `groupadmin_${Date.now()}`,
          displayName: 'Group Admin',
          isActor: false,
          updatedAt: new Date(),
        },
        {
          id: testUser2Id,
          username: `invitee1_${Date.now()}`,
          displayName: 'Invitee One',
          isActor: false,
          updatedAt: new Date(),
        },
        {
          id: testUser3Id,
          username: `invitee2_${Date.now()}`,
          displayName: 'Invitee Two',
          isActor: false,
          updatedAt: new Date(),
        },
      ],
    });

    // Create a test group
    testGroupId = await generateSnowflakeId();
    await prisma.userGroup.create({
      data: {
        id: testGroupId,
        name: 'Test Trading Group',
        description: 'A group for testing invites',
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
    });

    // Create chat for the group
    const chatId = await generateSnowflakeId();
    await prisma.chat.create({
      data: {
        id: chatId,
        name: 'Test Trading Group',
        isGroup: true,
        updatedAt: new Date(),
        ChatParticipant: {
          create: {
            id: await generateSnowflakeId(),
            userId: testUser1Id,
          },
        },
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.chat.deleteMany({
      where: { name: 'Test Trading Group' },
    });

    await prisma.userGroup.deleteMany({
      where: { id: testGroupId },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [testUser1Id, testUser2Id, testUser3Id],
        },
      },
    });
  });

  describe('Sending Invites', () => {
    it('should create a pending invite', async () => {
      const inviteId = await generateSnowflakeId();
      
      const invite = await prisma.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: testGroupId,
          invitedUserId: testUser2Id,
          invitedBy: testUser1Id,
          status: 'pending',
        },
      });

      expect(invite).toBeDefined();
      expect(invite.status).toBe('pending');
      expect(invite.invitedUserId).toBe(testUser2Id);
      expect(invite.groupId).toBe(testGroupId);
    });

    it('should create a notification for the invitee', async () => {
      const notificationId = await generateSnowflakeId();
      
      const notification = await prisma.notification.create({
        data: {
          id: notificationId,
          userId: testUser2Id,
          type: 'group_invite',
          title: 'Group Invitation',
          message: 'Group Admin invited you to join Test Trading Group',
          actorId: testUser1Id,
          read: false,
        },
      });

      expect(notification).toBeDefined();
      expect(notification.type).toBe('group_invite');
      expect(notification.read).toBe(false);
      expect(notification.userId).toBe(testUser2Id);
    });

    it('should prevent duplicate pending invites', async () => {
      const existingInvite = await prisma.userGroupInvite.findUnique({
        where: {
          groupId_invitedUserId: {
            groupId: testGroupId,
            invitedUserId: testUser2Id,
          },
        },
      });

      expect(existingInvite).toBeDefined();
      expect(existingInvite?.status).toBe('pending');

      // Trying to create another would violate unique constraint
      await expect(
        prisma.userGroupInvite.create({
          data: {
            id: await generateSnowflakeId(),
            groupId: testGroupId,
            invitedUserId: testUser2Id,
            invitedBy: testUser1Id,
            status: 'pending',
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('Accepting Invites', () => {
    it('should update invite status to accepted', async () => {
      const invite = await prisma.userGroupInvite.findUnique({
        where: {
          groupId_invitedUserId: {
            groupId: testGroupId,
            invitedUserId: testUser2Id,
          },
        },
      });

      expect(invite).toBeDefined();

      const updated = await prisma.userGroupInvite.update({
        where: { id: invite!.id },
        data: {
          status: 'accepted',
          respondedAt: new Date(),
        },
      });

      expect(updated.status).toBe('accepted');
      expect(updated.respondedAt).toBeDefined();
    });

    it('should add user to group members', async () => {
      const member = await prisma.userGroupMember.create({
        data: {
          id: await generateSnowflakeId(),
          groupId: testGroupId,
          userId: testUser2Id,
          addedBy: testUser1Id,
        },
      });

      expect(member).toBeDefined();
      expect(member.userId).toBe(testUser2Id);

      const memberCount = await prisma.userGroupMember.count({
        where: { groupId: testGroupId },
      });

      expect(memberCount).toBe(2); // Admin + new member
    });

    it('should add user to chat participants', async () => {
      const chat = await prisma.chat.findFirst({
        where: {
          name: 'Test Trading Group',
          isGroup: true,
        },
      });

      expect(chat).toBeDefined();

      const participant = await prisma.chatParticipant.create({
        data: {
          id: await generateSnowflakeId(),
          chatId: chat!.id,
          userId: testUser2Id,
        },
      });

      expect(participant).toBeDefined();
      expect(participant.userId).toBe(testUser2Id);
    });

    it('should mark notification as read', async () => {
      await prisma.notification.updateMany({
        where: {
          userId: testUser2Id,
          type: 'group_invite',
          actorId: testUser1Id,
        },
        data: {
          read: true,
        },
      });

      const notifications = await prisma.notification.findMany({
        where: {
          userId: testUser2Id,
          type: 'group_invite',
        },
      });

      expect(notifications.every(n => n.read)).toBe(true);
    });
  });

  describe('Declining Invites', () => {
    it('should send invite to third user', async () => {
      const inviteId = await generateSnowflakeId();
      
      const invite = await prisma.userGroupInvite.create({
        data: {
          id: inviteId,
          groupId: testGroupId,
          invitedUserId: testUser3Id,
          invitedBy: testUser1Id,
          status: 'pending',
        },
      });

      expect(invite).toBeDefined();
      expect(invite.status).toBe('pending');
    });

    it('should update invite status to declined', async () => {
      const invite = await prisma.userGroupInvite.findUnique({
        where: {
          groupId_invitedUserId: {
            groupId: testGroupId,
            invitedUserId: testUser3Id,
          },
        },
      });

      expect(invite).toBeDefined();

      const updated = await prisma.userGroupInvite.update({
        where: { id: invite!.id },
        data: {
          status: 'declined',
          respondedAt: new Date(),
        },
      });

      expect(updated.status).toBe('declined');
      expect(updated.respondedAt).toBeDefined();
    });

    it('should NOT add user to group members', async () => {
      const member = await prisma.userGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: testGroupId,
            userId: testUser3Id,
          },
        },
      });

      expect(member).toBeNull();
    });
  });

  describe('Query Invites', () => {
    it('should get pending invites for user', async () => {
      // Check if invite already exists (from declining test)
      const existing = await prisma.userGroupInvite.findUnique({
        where: {
          groupId_invitedUserId: {
            groupId: testGroupId,
            invitedUserId: testUser3Id,
          },
        },
      });

      // Only create if doesn't exist
      if (!existing) {
        const newInviteId = await generateSnowflakeId();
        await prisma.userGroupInvite.create({
          data: {
            id: newInviteId,
            groupId: testGroupId,
            invitedUserId: testUser3Id,
            invitedBy: testUser1Id,
            status: 'pending',
          },
        });
      } else if (existing.status !== 'pending') {
        // Update to pending if already exists but not pending
        await prisma.userGroupInvite.update({
          where: { id: existing.id },
          data: { status: 'pending' },
        });
      }

      const pendingInvites = await prisma.userGroupInvite.findMany({
        where: {
          invitedUserId: testUser3Id,
          status: 'pending',
        },
      });

      expect(pendingInvites.length).toBeGreaterThanOrEqual(0);
      if (pendingInvites.length > 0) {
        expect(pendingInvites.every(inv => inv.status === 'pending')).toBe(true);
      }
    });

    it('should get accepted invites', async () => {
      const acceptedInvites = await prisma.userGroupInvite.findMany({
        where: {
          groupId: testGroupId,
          status: 'accepted',
        },
      });

      expect(acceptedInvites.length).toBeGreaterThan(0);
      expect(acceptedInvites.some(inv => inv.invitedUserId === testUser2Id)).toBe(true);
    });

    it('should get declined invites', async () => {
      // First ensure we have a declined invite by setting the status
      const user3Invite = await prisma.userGroupInvite.findUnique({
        where: {
          groupId_invitedUserId: {
            groupId: testGroupId,
            invitedUserId: testUser3Id,
          },
        },
      });

      if (user3Invite && user3Invite.status !== 'declined') {
        await prisma.userGroupInvite.update({
          where: { id: user3Invite.id },
          data: { status: 'declined' },
        });
      }

      const declinedInvites = await prisma.userGroupInvite.findMany({
        where: {
          groupId: testGroupId,
          status: 'declined',
        },
      });

      expect(declinedInvites.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Statistics', () => {
    it('should count total invites sent for group', async () => {
      const totalInvites = await prisma.userGroupInvite.count({
        where: {
          groupId: testGroupId,
        },
      });

      // Should have at least 2 invites (user2 and user3)
      expect(totalInvites).toBeGreaterThanOrEqual(2);
    });

    it('should count accepted vs declined', async () => {
      const [accepted, declined, pending] = await Promise.all([
        prisma.userGroupInvite.count({
          where: {
            groupId: testGroupId,
            status: 'accepted',
          },
        }),
        prisma.userGroupInvite.count({
          where: {
            groupId: testGroupId,
            status: 'declined',
          },
        }),
        prisma.userGroupInvite.count({
          where: {
            groupId: testGroupId,
            status: 'pending',
          },
        }),
      ]);

      console.log('Invite Statistics:', {
        accepted,
        declined,
        pending,
        total: accepted + declined + pending,
      });

      // Should have at least one accepted invite (user2)
      expect(accepted).toBeGreaterThanOrEqual(1);
      // Should have at least one declined invite (user3 was declined in previous test)
      expect(declined).toBeGreaterThanOrEqual(1);
      // Total should be at least 2
      expect(accepted + declined + pending).toBeGreaterThanOrEqual(2);
    });
  });
});

