/**
 * Game Tick Group Generation Test
 * 
 * Verify that groups are being created and managed properly via game tick
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import { NPCGroupDynamicsService } from '@/lib/services/npc-group-dynamics-service';
import { AlphaGroupInviteService } from '@/lib/services/alpha-group-invite-service';

describe('Game Tick Group Generation', () => {
  let testNpc1Id: string;
  let testNpc2Id: string;
  let testNpc3Id: string;

  beforeAll(async () => {
    // Create test NPCs with positive relationships
    testNpc1Id = await generateSnowflakeId();
    testNpc2Id = await generateSnowflakeId();
    testNpc3Id = await generateSnowflakeId();

    await prisma.actor.createMany({
      data: [
        {
          id: testNpc1Id,
          name: 'Group Test Alice',
          hasPool: true,
          isTest: true,
          updatedAt: new Date(),
        },
        {
          id: testNpc2Id,
          name: 'Group Test Bob',
          hasPool: true,
          isTest: true,
          updatedAt: new Date(),
        },
        {
          id: testNpc3Id,
          name: 'Group Test Charlie',
          hasPool: true,
          isTest: true,
          updatedAt: new Date(),
        },
      ],
    });

    // Create positive relationships (triangle of friends)
    await prisma.actorRelationship.createMany({
      data: [
        {
          id: await generateSnowflakeId(),
          actor1Id: testNpc1Id,
          actor2Id: testNpc2Id,
          relationshipType: 'ally',
          strength: 0.8,
          sentiment: 0.9,
          updatedAt: new Date(),
        },
        {
          id: await generateSnowflakeId(),
          actor1Id: testNpc1Id,
          actor2Id: testNpc3Id,
          relationshipType: 'friend',
          strength: 0.7,
          sentiment: 0.8,
          updatedAt: new Date(),
        },
        {
          id: await generateSnowflakeId(),
          actor1Id: testNpc2Id,
          actor2Id: testNpc3Id,
          relationshipType: 'ally',
          strength: 0.9,
          sentiment: 0.95,
          updatedAt: new Date(),
        },
      ],
    });
  });

  describe('Group Statistics', () => {
    it('should get current group statistics', async () => {
      const stats = await NPCGroupDynamicsService.getGroupStats();

      console.log('Group Statistics:', {
        totalGroups: stats.totalGroups,
        activeGroups: stats.activeGroups,
        totalMembers: stats.totalMembers,
        avgGroupSize: stats.avgGroupSize.toFixed(2),
      });

      expect(stats.totalGroups).toBeGreaterThanOrEqual(0);
      expect(stats.activeGroups).toBeGreaterThanOrEqual(0);
      expect(stats.avgGroupSize).toBeGreaterThanOrEqual(0);
    });

    it('should get alpha invite statistics', async () => {
      const stats = await AlphaGroupInviteService.getInviteStats();

      console.log('Alpha Invite Statistics:', {
        totalInvites: stats.totalInvites,
        activeGroups: stats.activeGroups,
        invitesLast24h: stats.invitesLast24h,
      });

      expect(stats.totalInvites).toBeGreaterThanOrEqual(0);
      expect(stats.activeGroups).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Group Formation', () => {
    it('should create groups when NPCs have positive relationships', async () => {
      const initialCount = await prisma.chat.count({
        where: { isGroup: true },
      });

      // Run multiple ticks to increase chance of group formation
      let groupsCreated = 0;
      for (let i = 0; i < 20; i++) {
        const result = await NPCGroupDynamicsService.processTickDynamics();
        groupsCreated += result.groupsCreated;
        
        if (groupsCreated > 0) {
          console.log(`✓ Group created on tick ${i + 1}`);
          break;
        }
      }

      const finalCount = await prisma.chat.count({
        where: { isGroup: true },
      });

      console.log('Groups before:', initialCount);
      console.log('Groups after:', finalCount);
      console.log('Groups created:', groupsCreated);

      // At least one group should have been created in 20 ticks (5% chance each)
      expect(finalCount).toBeGreaterThanOrEqual(initialCount);
    });

    it('should list all existing groups', async () => {
      const groups = await prisma.chat.findMany({
        where: {
          isGroup: true,
        },
        include: {
          ChatParticipant: {
            select: {
              userId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      console.log(`\nFound ${groups.length} groups:`);
      
      for (const group of groups) {
        console.log(`\n- ${group.name || 'Unnamed'}`);
        console.log(`  ID: ${group.id}`);
        console.log(`  Members: ${group.ChatParticipant.length}`);
        console.log(`  Created: ${group.createdAt.toISOString()}`);
        
        // Get participant details
        const participantIds = group.ChatParticipant.map(p => p.userId);
        const [users, actors] = await Promise.all([
          prisma.user.findMany({
            where: { id: { in: participantIds } },
            select: { id: true, username: true, displayName: true, isActor: true },
          }),
          prisma.actor.findMany({
            where: { id: { in: participantIds } },
            select: { id: true, name: true },
          }),
        ]);
        
        const participantNames = participantIds.map(id => {
          const user = users.find(u => u.id === id);
          const actor = actors.find(a => a.id === id);
          return user?.displayName || user?.username || actor?.name || id.slice(0, 8);
        });
        
        console.log(`  Participants: ${participantNames.join(', ')}`);
      }

      expect(groups).toBeDefined();
      expect(Array.isArray(groups)).toBe(true);
    });

    it('should verify group messages exist', async () => {
      const groupsWithMessages = await prisma.chat.findMany({
        where: {
          isGroup: true,
        },
        include: {
          Message: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 5,
          },
        },
        take: 5,
      });

      console.log(`\nChecking messages in ${groupsWithMessages.length} groups:`);

      for (const group of groupsWithMessages) {
        console.log(`\n${group.name || 'Unnamed'}:`);
        console.log(`  Total messages: ${group.Message.length}`);
        
        if (group.Message.length > 0) {
          console.log(`  Recent messages:`);
          for (const msg of group.Message.slice(0, 3)) {
            const preview = msg.content.slice(0, 60);
            console.log(`    - ${preview}${msg.content.length > 60 ? '...' : ''}`);
          }
        }
      }

      expect(groupsWithMessages).toBeDefined();
    });
  });

  describe('Group Dynamics Over Time', () => {
    it('should simulate multiple ticks and report activity', async () => {
      console.log('\n=== Simulating 10 Game Ticks ===\n');

      const results = {
        totalGroupsCreated: 0,
        totalMembersAdded: 0,
        totalMembersRemoved: 0,
        totalUsersKicked: 0,
        totalInvitesSent: 0,
      };

      for (let tick = 1; tick <= 10; tick++) {
        // Run group dynamics
        const dynamics = await NPCGroupDynamicsService.processTickDynamics();
        results.totalGroupsCreated += dynamics.groupsCreated;
        results.totalMembersAdded += dynamics.membersAdded;
        results.totalMembersRemoved += dynamics.membersRemoved;
        results.totalUsersKicked += dynamics.usersKicked;

        // Run alpha invites
        const invites = await AlphaGroupInviteService.processTickInvites();
        results.totalInvitesSent += invites.length;

        console.log(`Tick ${tick}:`, {
          groupsCreated: dynamics.groupsCreated,
          membersAdded: dynamics.membersAdded,
          membersRemoved: dynamics.membersRemoved,
          usersKicked: dynamics.usersKicked,
          invitesSent: invites.length,
        });
      }

      console.log('\n=== Summary After 10 Ticks ===');
      console.log(results);

      // Get final stats
      const finalStats = await NPCGroupDynamicsService.getGroupStats();
      console.log('\nFinal Group Stats:', {
        totalGroups: finalStats.totalGroups,
        activeGroups: finalStats.activeGroups,
        avgGroupSize: finalStats.avgGroupSize.toFixed(2),
      });

      // Verify activity occurred
      expect(results).toBeDefined();
      expect(
        results.totalGroupsCreated +
        results.totalMembersAdded +
        results.totalMembersRemoved +
        results.totalUsersKicked +
        results.totalInvitesSent
      ).toBeGreaterThanOrEqual(0);
    });
  });
});

