// @ts-nocheck - Test file

/**
 * A2A Moderation Integration Tests
 * 
 * Tests for A2A protocol moderation features
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { A2AClient } from '@/lib/a2a/client/a2a-client';
import { generateSnowflakeId } from '@/lib/snowflake';
import { prisma } from '@/lib/database-service';

describe('A2A Moderation Integration', () => {
  let client: A2AClient;
  let testUserId: string;
  let testPostId: string;

  beforeAll(async () => {
    // Initialize A2A client for testing
    client = new A2AClient({
      endpoint: process.env.A2A_TEST_ENDPOINT || 'ws://localhost:8765',
      credentials: {
        address: process.env.TEST_AGENT_ADDRESS || '0xtest',
        privateKey: process.env.TEST_AGENT_PRIVATE_KEY || '0xtest',
        tokenId: 1,
      },
    });

    await client.connect();

    // Create test user
    testUserId = generateSnowflakeId();
    await prisma.user.create({
      data: {
        id: testUserId,
        displayName: 'Test User',
        username: 'testuser',
        createdAt: new Date(),
        isTest: true,

        updatedAt: new Date(),
      },
    });

    // Create test post
    testPostId = generateSnowflakeId();
    await prisma.post.create({
      data: {
        id: testPostId,
        content: 'Test post content',
        authorId: testUserId,
        timestamp: new Date(),
        createdAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    await prisma.userBlock.deleteMany({ where: { blockedId: testUserId } });
    await prisma.userMute.deleteMany({ where: { mutedId: testUserId } });
    await prisma.report.deleteMany({ where: { reportedUserId: testUserId } });
    await prisma.post.delete({ where: { id: testPostId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await client.disconnect();
  });

  describe('Block User', () => {
    it('should block a user via A2A', async () => {
      const result = await client.request({
        method: 'moderation.blockUser',
        params: {
          userId: testUserId,
          reason: 'Test block reason',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('User blocked successfully');
      expect(result.block).toBeDefined();
      expect(result.block.blockedId).toBe(testUserId);
      expect(result.block.reason).toBe('Test block reason');
    });

    it('should check block status', async () => {
      const result = await client.request({
        method: 'moderation.checkBlockStatus',
        params: {
          userId: testUserId,
        },
      });

      expect(result.isBlocked).toBe(true);
      expect(result.block).toBeDefined();
    });

    it('should get list of blocks', async () => {
      const result = await client.request({
        method: 'moderation.getBlocks',
        params: {
          limit: 10,
          offset: 0,
        },
      });

      expect(result.blocks).toBeDefined();
      expect(Array.isArray(result.blocks)).toBe(true);
      expect(result.blocks.length).toBeGreaterThan(0);
      expect(result.pagination).toBeDefined();
    });

    it('should prevent duplicate blocks', async () => {
      try {
        await client.request({
          method: 'moderation.blockUser',
          params: {
            userId: testUserId,
          },
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('already blocked');
      }
    });

    it('should unblock a user', async () => {
      const result = await client.request({
        method: 'moderation.unblockUser',
        params: {
          userId: testUserId,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('User unblocked successfully');
    });
  });

  describe('Mute User', () => {
    it('should mute a user via A2A', async () => {
      const result = await client.request({
        method: 'moderation.muteUser',
        params: {
          userId: testUserId,
          reason: 'Test mute reason',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('User muted successfully');
      expect(result.mute).toBeDefined();
      expect(result.mute.mutedId).toBe(testUserId);
    });

    it('should check mute status', async () => {
      const result = await client.request({
        method: 'moderation.checkMuteStatus',
        params: {
          userId: testUserId,
        },
      });

      expect(result.isMuted).toBe(true);
      expect(result.mute).toBeDefined();
    });

    it('should get list of mutes', async () => {
      const result = await client.request({
        method: 'moderation.getMutes',
        params: {
          limit: 10,
        },
      });

      expect(result.mutes).toBeDefined();
      expect(Array.isArray(result.mutes)).toBe(true);
      expect(result.mutes.length).toBeGreaterThan(0);
    });

    it('should unmute a user', async () => {
      const result = await client.request({
        method: 'moderation.unmuteUser',
        params: {
          userId: testUserId,
        },
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Report User', () => {
    it('should report a user via A2A', async () => {
      const result = await client.request({
        method: 'moderation.reportUser',
        params: {
          userId: testUserId,
          category: 'spam',
          reason: 'Test report: This user is posting spam content repeatedly',
          evidence: 'https://example.com/screenshot.png',
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Report submitted');
      expect(result.report).toBeDefined();
      expect(result.report.reportedUserId).toBe(testUserId);
      expect(result.report.category).toBe('spam');
      expect(result.report.status).toBe('pending');
      expect(result.report.priority).toBe('low'); // spam is low priority
    });

    it('should prevent duplicate reports', async () => {
      try {
        await client.request({
          method: 'moderation.reportUser',
          params: {
            userId: testUserId,
            category: 'spam',
            reason: 'Another spam report within 24 hours',
          },
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('already reported');
      }
    });
  });

  describe('Report Post', () => {
    it('should report a post via A2A', async () => {
      const result = await client.request({
        method: 'moderation.reportPost',
        params: {
          postId: testPostId,
          category: 'misinformation',
          reason: 'Test report: This post contains false information about market outcomes',
        },
      });

      expect(result.success).toBe(true);
      expect(result.report).toBeDefined();
      expect(result.report.reportedPostId).toBe(testPostId);
      expect(result.report.category).toBe('misinformation');
      expect(result.report.status).toBe('pending');
    });
  });

  describe('Error Handling', () => {
    it('should reject blocking self', async () => {
      try {
        await client.request({
          method: 'moderation.blockUser',
          params: {
            userId: client.getAgentId(), // trying to block self
          },
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('Cannot block yourself');
      }
    });

    it('should reject invalid user ID', async () => {
      try {
        await client.request({
          method: 'moderation.blockUser',
          params: {
            userId: 'nonexistent_user_id',
          },
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('should reject short report reason', async () => {
      try {
        await client.request({
          method: 'moderation.reportUser',
          params: {
            userId: testUserId,
            category: 'spam',
            reason: 'short', // too short (min 10 chars)
          },
        });
        throw new Error('Should have thrown error');
      } catch (error: any) {
        expect(error.code).toBe(-32602); // Invalid params
      }
    });
  });

  describe('High Priority Reports', () => {
    it('should assign high priority to hate speech', async () => {
      // Cleanup previous reports
      await prisma.report.deleteMany({
        where: {
          reportedUserId: testUserId,
          category: 'hate_speech',
        },
      });

      const result = await client.request({
        method: 'moderation.reportUser',
        params: {
          userId: testUserId,
          category: 'hate_speech',
          reason: 'Test high priority report: Contains hate speech targeting a group',
        },
      });

      expect(result.report.priority).toBe('high');
    });

    it('should assign high priority to violence', async () => {
      // Cleanup previous reports
      await prisma.report.deleteMany({
        where: {
          reportedUserId: testUserId,
          category: 'violence',
        },
      });

      const result = await client.request({
        method: 'moderation.reportUser',
        params: {
          userId: testUserId,
          category: 'violence',
          reason: 'Test high priority report: Contains violent threats',
        },
      });

      expect(result.report.priority).toBe('high');
    });
  });
});

