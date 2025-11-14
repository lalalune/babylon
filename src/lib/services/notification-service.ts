/**
 * Notification Service
 * 
 * Helper functions for creating notifications when users interact
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';


export type NotificationType = 'comment' | 'reaction' | 'follow' | 'mention' | 'reply' | 'share' | 'system';

interface CreateNotificationParams {
  userId: string; // Who receives the notification
  type: NotificationType;
  actorId?: string; // Who performed the action
  postId?: string;
  commentId?: string;
  title: string;
  message: string;
}

/**
 * Create a notification
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  // Verify that the userId exists in the User table before creating notification
  // This prevents foreign key constraint errors
  const userExists = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true },
  });

  if (!userExists) {
    logger.warn(
      `Skipping notification creation: userId ${params.userId} does not exist in User table (may be an Actor)`,
      undefined,
      'NotificationService'
    );
    return;
  }

  await prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      actorId: params.actorId,
      postId: params.postId,
      commentId: params.commentId,
      title: params.title,
      message: params.message,
    },
  });
}

/**
 * Create notification for comment on user's post
 */
export async function notifyCommentOnPost(
  postAuthorId: string,
  commentAuthorId: string,
  postId: string,
  commentId: string
): Promise<void> {
  // Don't notify if user commented on their own post
  if (postAuthorId === commentAuthorId) {
    return;
  }

  // Get comment author info for message
  const commentAuthor = await prisma.user.findUnique({
    where: { id: commentAuthorId },
    select: { displayName: true, username: true },
  });

  const authorName = commentAuthor?.displayName || commentAuthor?.username || 'Someone';
  const message = `${authorName} commented on your post`;

  await createNotification({
    userId: postAuthorId,
    type: 'comment',
    actorId: commentAuthorId,
    postId,
    commentId,
    title: 'New Comment',
    message,
  });
}

/**
 * Create notification for reaction on user's post
 */
export async function notifyReactionOnPost(
  postAuthorId: string,
  reactionUserId: string,
  postId: string,
  reactionType: string = 'like'
): Promise<void> {
  // Don't notify if user reacted to their own post
  if (postAuthorId === reactionUserId) {
    return;
  }

  const reactionUser = await prisma.user.findUnique({
    where: { id: reactionUserId },
    select: { displayName: true, username: true },
  });

  const userName = reactionUser?.displayName || reactionUser?.username || 'Someone';
  const action = reactionType === 'like' ? 'liked' : reactionType;
  const message = `${userName} ${action} your post`;

  await createNotification({
    userId: postAuthorId,
    type: 'reaction',
    actorId: reactionUserId,
    postId,
    title: 'New Reaction',
    message,
  });
}

/**
 * Create notification for follow
 */
export async function notifyFollow(
  followedUserId: string,
  followerId: string
): Promise<void> {
  // Don't notify if user followed themselves
  if (followedUserId === followerId) {
    return;
  }

  const follower = await prisma.user.findUnique({
    where: { id: followerId },
    select: { displayName: true, username: true },
  });

  const userName = follower?.displayName || follower?.username || 'Someone';
  const message = `${userName} started following you`;

  await createNotification({
    userId: followedUserId,
    type: 'follow',
    actorId: followerId,
    title: 'New Follower',
    message,
  });
}

/**
 * Create notification for reply to comment
 */
export async function notifyReplyToComment(
  commentAuthorId: string,
  replyAuthorId: string,
  postId: string,
  commentId: string,
  replyCommentId: string
): Promise<void> {
  // Don't notify if user replied to their own comment
  if (commentAuthorId === replyAuthorId) {
    return;
  }

  // Use commentId to create notification context
  const notificationContext = {
    commentId,
    replyCommentId,
    postId,
  };

  const replyAuthor = await prisma.user.findUnique({
    where: { id: replyAuthorId },
    select: { displayName: true, username: true },
  });

  const userName = replyAuthor?.displayName || replyAuthor?.username || 'Someone';
  const message = `${userName} replied to your comment`;

  // Use notificationContext when creating the notification
  await createNotification({
    userId: commentAuthorId,
    type: 'reply',
    actorId: replyAuthorId,
    postId: notificationContext.postId,
    commentId: notificationContext.commentId,
    title: 'New Reply',
    message,
  });
}

/**
 * Create notification for share/repost
 */
export async function notifyShare(
  postAuthorId: string,
  sharerId: string,
  postId: string
): Promise<void> {
  // Don't notify if user shared their own post
  if (postAuthorId === sharerId) {
    return;
  }

  const sharer = await prisma.user.findUnique({
    where: { id: sharerId },
    select: { displayName: true, username: true },
  });

  const userName = sharer?.displayName || sharer?.username || 'Someone';
  const message = `${userName} shared your post`;

  await createNotification({
    userId: postAuthorId,
    type: 'share',
    actorId: sharerId,
    postId,
    title: 'Post Shared',
    message,
  });
}

/**
 * Create system notification for new account creation
 */
export async function notifyNewAccount(userId: string): Promise<void> {
  const message = "🎉 Welcome to Babylon! Edit your profile details to earn free points and unlock rewards.";

  await createNotification({
    userId,
    type: 'system',
    title: 'Welcome to Babylon',
    message,
  });
}

/**
 * Create system notification for profile completion
 */
export async function notifyProfileComplete(userId: string, pointsAwarded: number): Promise<void> {
  const message = `🎊 Congratulations! You've completed your profile and earned ${pointsAwarded} points!`;

  await createNotification({
    userId,
    type: 'system',
    title: 'Profile Complete',
    message,
  });
}


