/**
 * NPC Groups Integration Tests
 * 
 * Tests NPC group dynamics:
 * - Group formation
 * - NPCs joining groups
 * - NPCs leaving groups
 * - Kicking inactive users
 * - Alpha invite system
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';
import { NPCGroupDynamicsService } from '@/lib/services/npc-group-dynamics-service';
import { NPCInteractionTracker } from '@/lib/services/npc-interaction-tracker';
import { AlphaGroupInviteService } from '@/lib/services/alpha-group-invite-service';

describe('NPC Groups', () => {
  let testNpc1Id: string;
  let testNpc2Id: string;
  let testUserId: string;
  let testPostId: string;

  beforeAll(async () => {
    // Create test NPCs
    testNpc1Id = await generateSnowflakeId();
    testNpc2Id = await generateSnowflakeId();

    await prisma.actor.createMany({
      data: [
        {
          id: testNpc1Id,
          name: 'Test Trader Alice',
          hasPool: true,
          isTest: true,
          updatedAt: new Date(),
        },
        {
          id: testNpc2Id,
          name: 'Test Analyst Bob',
          hasPool: true,
          isTest: true,
          updatedAt: new Date(),
        },
      ],
    });

    // Create positive relationship
    await prisma.actorRelationship.create({
      data: {
        id: await generateSnowflakeId(),
        actor1Id: testNpc1Id,
        actor2Id: testNpc2Id,
        relationshipType: 'ally',
        strength: 0.8,
        sentiment: 0.9,
        updatedAt: new Date(),
      },
    });

    // Create test user
    testUserId = await generateSnowflakeId();
    await prisma.user.create({
      data: {
        id: testUserId,
        username: `testuser_${Date.now()}`,
        displayName: 'Test User',
        isActor: false,
        isTest: true,
        updatedAt: new Date(),
      },
    });

    // Create test post by NPC
    testPostId = await generateSnowflakeId();
    await prisma.post.create({
      data: {
        id: testPostId,
        content: 'Test post by NPC',
        authorId: testNpc1Id,
        timestamp: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.chat.deleteMany({
      where: {
        name: {
          contains: 'Test',
        },
      },
    });

    await prisma.post.deleteMany({
      where: { id: testPostId },
    });

    await prisma.user.deleteMany({
      where: { id: testUserId },
    });

    await prisma.actorRelationship.deleteMany({
      where: {
        OR: [
          { actor1Id: testNpc1Id },
          { actor2Id: testNpc1Id },
        ],
      },
    });

    await prisma.actor.deleteMany({
      where: {
        id: {
          in: [testNpc1Id, testNpc2Id],
        },
      },
    });
  });

  describe('Group Dynamics', () => {
    it('should get group statistics', async () => {
      const stats = await NPCGroupDynamicsService.getGroupStats();

      expect(stats).toBeDefined();
      expect(stats.totalGroups).toBeGreaterThanOrEqual(0);
      expect(stats.activeGroups).toBeGreaterThanOrEqual(0);
      expect(stats.avgGroupSize).toBeGreaterThanOrEqual(0);
    });

    it('should process group dynamics tick', async () => {
      const result = await NPCGroupDynamicsService.processTickDynamics();

      expect(result).toBeDefined();
      expect(result.groupsCreated).toBeGreaterThanOrEqual(0);
      expect(result.membersAdded).toBeGreaterThanOrEqual(0);
      expect(result.membersRemoved).toBeGreaterThanOrEqual(0);
      expect(result.usersKicked).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Interaction Tracking', () => {
    it('should track user likes on NPC posts', async () => {
      // Create a like
      await prisma.reaction.create({
        data: {
          id: await generateSnowflakeId(),
          userId: testUserId,
          postId: testPostId,
          type: 'like',
        },
      });

      // Track the interaction
      await NPCInteractionTracker.trackLike(testUserId, testPostId);

      // Calculate engagement score
      const score = await NPCInteractionTracker.calculateEngagementScore(
        testUserId,
        testNpc1Id
      );

      expect(score).toBeDefined();
      expect(score.likeCount).toBeGreaterThan(0);
    });

    it('should track user shares on NPC posts', async () => {
      // Create a share
      await prisma.share.create({
        data: {
          id: await generateSnowflakeId(),
          userId: testUserId,
          postId: testPostId,
        },
      });

      // Track the interaction
      await NPCInteractionTracker.trackShare(testUserId, testPostId);

      // Calculate engagement score
      const score = await NPCInteractionTracker.calculateEngagementScore(
        testUserId,
        testNpc1Id
      );

      expect(score).toBeDefined();
      expect(score.shareCount).toBeGreaterThan(0);
    });

    it('should calculate engagement scores correctly', async () => {
      // Create multiple interactions
      const commentId = await generateSnowflakeId();
      await prisma.userInteraction.create({
        data: {
          id: await generateSnowflakeId(),
          userId: testUserId,
          npcId: testNpc1Id,
          postId: testPostId,
          commentId,
          qualityScore: 0.9,
        },
      });

      const score = await NPCInteractionTracker.calculateEngagementScore(
        testUserId,
        testNpc1Id
      );

      expect(score).toBeDefined();
      expect(score.userId).toBe(testUserId);
      expect(score.npcId).toBe(testNpc1Id);
      expect(score.engagementScore).toBeGreaterThan(0);
      expect(score.avgQualityScore).toBeGreaterThan(0);
    });

    it('should get top engaged users', async () => {
      const topUsers = await NPCInteractionTracker.getTopEngagedUsers(testNpc1Id, 10);

      expect(topUsers).toBeDefined();
      expect(Array.isArray(topUsers)).toBe(true);
    });
  });

  describe('Alpha Invites', () => {
    it('should get invite statistics', async () => {
      const stats = await AlphaGroupInviteService.getInviteStats();

      expect(stats).toBeDefined();
      expect(stats.totalInvites).toBeGreaterThanOrEqual(0);
      expect(stats.activeGroups).toBeGreaterThanOrEqual(0);
      expect(stats.invitesLast24h).toBeGreaterThanOrEqual(0);
    });

    it('should process alpha invites (may send 0 invites due to randomness)', async () => {
      const invites = await AlphaGroupInviteService.processTickInvites();

      expect(invites).toBeDefined();
      expect(Array.isArray(invites)).toBe(true);
      // Note: invites may be empty due to low probability
    });
  });
});

