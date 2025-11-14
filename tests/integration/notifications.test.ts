/**
 * Notification System Integration Tests
 * 
 * Tests all notification types to ensure they are properly created and sent:
 * - Comment notifications
 * - Comment like notifications  
 * - Post like notifications
 * - Follow notifications
 * - Share notifications
 * - Reply notifications
 * - Group chat invite notifications
 * - DM message notifications
 * - Group chat message notifications
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { prisma } from '../../src/lib/database-service';
import {
  notifyCommentOnPost,
  notifyReactionOnPost,
  notifyReactionOnComment,
  notifyFollow,
  notifyShare,
  notifyReplyToComment,
  notifyGroupChatInvite,
  notifyDMMessage,
  notifyGroupChatMessage,
} from '../../src/lib/services/notification-service';
import { clearAllRateLimits, clearAllDuplicates } from '../../src/lib/rate-limiting';

describe('Notification System', () => {
  let testUser1: { id: string };
  let testUser2: { id: string };
  let testPost: { id: string; authorId: string };
  let testComment: { id: string; authorId: string; postId: string };

  beforeEach(async () => {
    // Clear rate limits to prevent test interference
    clearAllRateLimits();
    clearAllDuplicates();
    
    // Create test users
    const timestamp = Date.now();
    testUser1 = await prisma.user.create({
      data: {
        id: 'test-user-1-' + timestamp,
        displayName: 'Test User 1',
        username: `testuser1-${timestamp}`,
          isTest: true,
        updatedAt: new Date(),
      },
    });

    testUser2 = await prisma.user.create({
      data: {
        id: 'test-user-2-' + timestamp,
        displayName: 'Test User 2',
        username: `testuser2-${timestamp}`,
          isTest: true,
        updatedAt: new Date(),
      },
    });

    // Create test post
    testPost = await prisma.post.create({
      data: {
        id: 'test-post-' + Date.now(),
        content: 'Test post content',
        authorId: testUser1.id,
        timestamp: new Date(),
      },
    });

    // Create test comment
    testComment = await prisma.comment.create({
      data: {
        id: 'test-comment-' + Date.now(),
        content: 'Test comment content',
        authorId: testUser1.id,
        postId: testPost.id,
        updatedAt: new Date(),
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { userId: testUser1.id },
          { userId: testUser2.id },
        ],
      },
    });

    await prisma.comment.deleteMany({
      where: { id: testComment.id },
    });

    await prisma.post.deleteMany({
      where: { id: testPost.id },
    });

    await prisma.user.deleteMany({
      where: {
        OR: [
          { id: testUser1.id },
          { id: testUser2.id },
        ],
      },
    });
  });

  describe('Comment Notifications', () => {
    it('should create notification when user comments on a post', async () => {
      await notifyCommentOnPost(
        testPost.authorId,
        testUser2.id,
        testPost.id,
        testComment.id
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testPost.authorId,
          type: 'comment',
          postId: testPost.id,
          commentId: testComment.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toContain('commented on your post');
      expect(notification?.read).toBe(false);
    });

    it('should NOT create notification when user comments on their own post', async () => {
      await notifyCommentOnPost(
        testUser1.id,
        testUser1.id,
        testPost.id,
        testComment.id
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'comment',
          postId: testPost.id,
        },
      });

      expect(notification).toBeNull();
    });
  });

  describe('Reaction Notifications', () => {
    it('should create notification when user likes a post', async () => {
      await notifyReactionOnPost(
        testPost.authorId,
        testUser2.id,
        testPost.id,
        'like'
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testPost.authorId,
          type: 'reaction',
          postId: testPost.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toContain('liked your post');
    });

    it('should create notification when user likes a comment', async () => {
      await notifyReactionOnComment(
        testComment.authorId,
        testUser2.id,
        testComment.id,
        testPost.id,
        'like'
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testComment.authorId,
          type: 'reaction',
          commentId: testComment.id,
          postId: testPost.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toContain('liked your comment');
    });

    it('should NOT create notification when user likes their own post', async () => {
      await notifyReactionOnPost(
        testUser1.id,
        testUser1.id,
        testPost.id,
        'like'
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'reaction',
          postId: testPost.id,
        },
      });

      expect(notification).toBeNull();
    });
  });

  describe('Follow Notifications', () => {
    it('should create notification when user follows another user', async () => {
      await notifyFollow(testUser1.id, testUser2.id);

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'follow',
          actorId: testUser2.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toContain('started following you');
    });

    it('should NOT create notification when user follows themselves', async () => {
      await notifyFollow(testUser1.id, testUser1.id);

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'follow',
        },
      });

      expect(notification).toBeNull();
    });
  });

  describe('Share Notifications', () => {
    it('should create notification when user shares a post', async () => {
      await notifyShare(testPost.authorId, testUser2.id, testPost.id);

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testPost.authorId,
          type: 'share',
          postId: testPost.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toContain('shared your post');
    });

    it('should NOT create notification when user shares their own post', async () => {
      await notifyShare(testUser1.id, testUser1.id, testPost.id);

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'share',
        },
      });

      expect(notification).toBeNull();
    });
  });

  describe('Reply Notifications', () => {
    it('should create notification when user replies to a comment', async () => {
      const replyComment = await prisma.comment.create({
        data: {
          id: 'test-reply-' + Date.now(),
          content: 'Test reply',
          authorId: testUser2.id,
          postId: testPost.id,
          parentCommentId: testComment.id,
          updatedAt: new Date(),
        },
      });

      await notifyReplyToComment(
        testComment.authorId,
        testUser2.id,
        testPost.id,
        testComment.id,
        replyComment.id
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testComment.authorId,
          type: 'reply',
          commentId: testComment.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toContain('replied to your comment');

      // Cleanup
      await prisma.comment.delete({ where: { id: replyComment.id } });
    });
  });

  describe('Group Chat Notifications', () => {
    it('should create notification when user is invited to a group chat', async () => {
      await notifyGroupChatInvite(
        testUser1.id,
        testUser2.id,
        'test-chat-id',
        'Test Chat'
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'system',
          actorId: testUser2.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toContain('invited you to');
      expect(notification?.message).toContain('Test Chat');
    });

    it('should create notifications for group chat messages', async () => {
      await notifyGroupChatMessage(
        [testUser1.id, testUser2.id],
        testUser2.id,
        'test-chat-id',
        'Test Group',
        'Hello everyone!'
      );

      // Should only notify testUser1 (not the sender)
      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'system',
          actorId: testUser2.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toContain('in "Test Group"');
      expect(notification?.message).toContain('Hello everyone!');

      // Should NOT notify the sender
      const senderNotification = await prisma.notification.findFirst({
        where: {
          userId: testUser2.id,
          actorId: testUser2.id,
        },
      });

      expect(senderNotification).toBeNull();
    });
  });

  describe('DM Notifications', () => {
    it('should create notification for DM message', async () => {
      await notifyDMMessage(
        testUser1.id,
        testUser2.id,
        'dm-test-chat-id',
        'Hey there!'
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'system',
          actorId: testUser2.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message).toContain('Hey there!');
      expect(notification?.title).toBe('New Message');
    });

    it('should truncate long DM messages in notification', async () => {
      const longMessage = 'a'.repeat(100);
      
      await notifyDMMessage(
        testUser1.id,
        testUser2.id,
        'dm-test-chat-id',
        longMessage
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'system',
          actorId: testUser2.id,
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.message.length).toBeLessThanOrEqual(80); // Name + ": " + 50 chars + "..."
      expect(notification?.message).toContain('...');
    });

    it('should NOT create notification when user DMs themselves', async () => {
      await notifyDMMessage(
        testUser1.id,
        testUser1.id,
        'dm-self-chat-id',
        'Talking to myself'
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testUser1.id,
          type: 'system',
        },
      });

      expect(notification).toBeNull();
    });
  });

  describe('Notification Data Integrity', () => {
    it('should include all required fields in notification', async () => {
      await notifyCommentOnPost(
        testPost.authorId,
        testUser2.id,
        testPost.id,
        testComment.id
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: testPost.authorId,
          type: 'comment',
        },
      });

      expect(notification).toBeTruthy();
      expect(notification?.id).toBeTruthy();
      expect(notification?.userId).toBe(testPost.authorId);
      expect(notification?.type).toBe('comment');
      expect(notification?.actorId).toBe(testUser2.id);
      expect(notification?.postId).toBe(testPost.id);
      expect(notification?.commentId).toBe(testComment.id);
      expect(notification?.title).toBeTruthy();
      expect(notification?.message).toBeTruthy();
      expect(notification?.read).toBe(false);
      expect(notification?.createdAt).toBeTruthy();
    });

    it('should not create notification for non-existent users', async () => {
      // Try to notify a user that doesn't exist
      await notifyCommentOnPost(
        'non-existent-user',
        testUser2.id,
        testPost.id,
        testComment.id
      );

      const notification = await prisma.notification.findFirst({
        where: {
          userId: 'non-existent-user',
        },
      });

      expect(notification).toBeNull();
    });
  });
});

