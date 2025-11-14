/**
 * Notification Service
 * 
 * Helper functions for creating notifications when users interact
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { generateSnowflakeId } from '@/lib/snowflake';


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
      id: await generateSnowflakeId(),
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
 * Create notification for mention (@username)
 */
export async function notifyMention(
  mentionedUserId: string,
  mentionerUserId: string,
  postId?: string,
  commentId?: string
): Promise<void> {
  // Don't notify if user mentioned themselves
  if (mentionedUserId === mentionerUserId) {
    return;
  }

  const mentioner = await prisma.user.findUnique({
    where: { id: mentionerUserId },
    select: { displayName: true, username: true },
  });

  const mentionerName = mentioner?.displayName || mentioner?.username || 'Someone';
  const message = commentId 
    ? `${mentionerName} mentioned you in a comment`
    : `${mentionerName} mentioned you in a post`;

  await createNotification({
    userId: mentionedUserId,
    type: 'mention',
    actorId: mentionerUserId,
    postId,
    commentId,
    title: 'Mention',
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

/**
 * Create notification for reaction on user's comment
 */
export async function notifyReactionOnComment(
  commentAuthorId: string,
  reactionUserId: string,
  commentId: string,
  postId: string,
  reactionType: string = 'like'
): Promise<void> {
  // Don't notify if user reacted to their own comment
  if (commentAuthorId === reactionUserId) {
    return;
  }

  const reactionUser = await prisma.user.findUnique({
    where: { id: reactionUserId },
    select: { displayName: true, username: true },
  });

  const userName = reactionUser?.displayName || reactionUser?.username || 'Someone';
  const action = reactionType === 'like' ? 'liked' : reactionType;
  const message = `${userName} ${action} your comment`;

  await createNotification({
    userId: commentAuthorId,
    type: 'reaction',
    actorId: reactionUserId,
    postId,
    commentId,
    title: 'New Reaction',
    message,
  });
}

/**
 * Create notification for group chat invite
 */
export async function notifyGroupChatInvite(
  userId: string,
  inviterId: string,
  _chatId: string,
  chatName: string
): Promise<void> {
  // Don't notify if user invited themselves (shouldn't happen but safety check)
  if (userId === inviterId) {
    return;
  }

  const inviter = await prisma.user.findUnique({
    where: { id: inviterId },
    select: { displayName: true, username: true },
  });

  const inviterName = inviter?.displayName || inviter?.username || 'Someone';
  const message = `${inviterName} invited you to "${chatName}"`;

  await createNotification({
    userId,
    type: 'system',
    actorId: inviterId,
    title: 'Group Chat Invite',
    message,
  });
}

/**
 * Create notification for user group invite
 */
export async function notifyUserGroupInvite(
  userId: string,
  inviterId: string,
  groupId: string,
  groupName: string,
  inviteId?: string
): Promise<void> {
  // Don't notify if user invited themselves
  if (userId === inviterId) {
    return;
  }

  const inviter = await prisma.user.findUnique({
    where: { id: inviterId },
    select: { displayName: true, username: true },
  });

  const inviterName = inviter?.displayName || inviter?.username || 'Someone';
  const message = `${inviterName} invited you to join ${groupName}`;

  // Create notification with groupId and inviteId for proper linking
  await prisma.notification.create({
    data: {
      id: await generateSnowflakeId(),
      userId,
      type: 'group_invite',
      actorId: inviterId,
      title: 'Group Invitation',
      message,
      groupId,
      inviteId,
    },
  });
}

/**
 * Create notification for new DM message
 */
export async function notifyDMMessage(
  recipientUserId: string,
  senderUserId: string,
  _chatId: string,
  messagePreview: string
): Promise<void> {
  // Don't notify if user sent message to themselves
  if (recipientUserId === senderUserId) {
    return;
  }

  const sender = await prisma.user.findUnique({
    where: { id: senderUserId },
    select: { displayName: true, username: true },
  });

  const senderName = sender?.displayName || sender?.username || 'Someone';
  
  // Truncate message preview to 50 characters
  const preview = messagePreview.length > 50 
    ? messagePreview.substring(0, 50) + '...' 
    : messagePreview;
  
  const message = `${senderName}: ${preview}`;

  await createNotification({
    userId: recipientUserId,
    type: 'system',
    actorId: senderUserId,
    title: 'New Message',
    message,
  });
}

/**
 * Create notification for new group chat message
 */
export async function notifyGroupChatMessage(
  recipientUserIds: string[],
  senderUserId: string,
  _chatId: string,
  chatName: string,
  messagePreview: string
): Promise<void> {
  const sender = await prisma.user.findUnique({
    where: { id: senderUserId },
    select: { displayName: true, username: true },
  });

  const senderName = sender?.displayName || sender?.username || 'Someone';
  
  // Truncate message preview to 50 characters
  const preview = messagePreview.length > 50 
    ? messagePreview.substring(0, 50) + '...' 
    : messagePreview;
  
  const message = `${senderName} in "${chatName}": ${preview}`;

  // Send notification to all participants except the sender
  const notificationPromises = recipientUserIds
    .filter(userId => userId !== senderUserId)
    .map(userId => 
      createNotification({
        userId,
        type: 'system',
        actorId: senderUserId,
        title: 'New Group Message',
        message,
      })
    );

  await Promise.all(notificationPromises);
}


