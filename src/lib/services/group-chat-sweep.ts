/**
 * Group Chat Sweep Service
 * 
 * Manages removal of players from group chats for:
 * - Inactivity (not posting for 72+ hours)
 * - Over-posting (more than 10 messages per day)
 * - Low quality (average quality < 0.5)
 * - Spam behavior
 * 
 * Sweeps run periodically (daily) to maintain chat quality
 */

import { prisma } from '@/lib/database-service';

export interface SweepDecision {
  kickChance: number;
  reason?: string;
  stats: {
    hoursSinceLastMessage: number;
    messagesLast24h: number;
    averageQuality: number;
    totalMessages: number;
  };
}

export class GroupChatSweep {
  // Base probability of being kicked per day, even with ideal activity
  private static readonly BASE_KICK_PROBABILITY = 0.01; // 1%

  // Inactivity thresholds (in hours)
  private static readonly INACTIVITY_GRACE_PERIOD_HOURS = 24;
  private static readonly INACTIVITY_MAX_HOURS = 72; // At this point, kick is certain

  // Activity thresholds (messages per 24 hours)
  private static readonly ACTIVITY_SWEET_SPOT_MAX = 4; // Up to this many messages is ideal
  private static readonly ACTIVITY_HARD_CAP = 15; // At this point, kick is certain

  /**
   * Calculate the probability that a user should be removed from a group chat.
   */
  static async calculateKickChance(
    userId: string,
    chatId: string
  ): Promise<SweepDecision> {
    const membership = await prisma.groupChatMembership.findUnique({
      where: {
        userId_chatId: {
          userId,
          chatId,
        },
      },
    });

    const baseStats = {
      hoursSinceLastMessage: 0,
      messagesLast24h: 0,
      averageQuality: 0,
      totalMessages: 0,
    };

    if (!membership || !membership.isActive) {
      return {
        kickChance: 0,
        reason: 'Not an active member',
        stats: baseStats,
      };
    }

    // Get messages from this user in this chat
    const allMessages = await prisma.message.findMany({
      where: {
        chatId,
        senderId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalMessages = allMessages.length;
    const hoursSinceJoin =
      (Date.now() - membership.joinedAt.getTime()) / (1000 * 60 * 60);

    // If no messages yet, give them a grace period
    if (totalMessages === 0) {
      if (hoursSinceJoin > this.INACTIVITY_GRACE_PERIOD_HOURS) {
        return {
          kickChance: 0.75, // High chance of being kicked if no posts after grace period
          reason: `Never posted after joining (${Math.floor(hoursSinceJoin)} hours ago)`,
          stats: { ...baseStats, hoursSinceLastMessage: hoursSinceJoin },
        };
      }
      // Safe for now if they just joined
      return {
        kickChance: 0,
        stats: { ...baseStats, hoursSinceLastMessage: hoursSinceJoin },
      };
    }

    // --- Calculate inactivity penalty ---
    let inactivityPenalty = 0;
    let reason = '';
    const lastMessage = allMessages[0]!;
    const hoursSinceLastMessage =
      (Date.now() - lastMessage.createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastMessage > this.INACTIVITY_GRACE_PERIOD_HOURS) {
      const excessHours = hoursSinceLastMessage - this.INACTIVITY_GRACE_PERIOD_HOURS;
      const range = this.INACTIVITY_MAX_HOURS - this.INACTIVITY_GRACE_PERIOD_HOURS;
      inactivityPenalty = Math.pow(Math.min(excessHours / range, 1), 2);
      reason = `Inactive for ${Math.floor(hoursSinceLastMessage)} hours`;
    }

    // --- Calculate over-activity penalty ---
    let overactivityPenalty = 0;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messagesLast24h = allMessages.filter(
      (m) => m.createdAt >= oneDayAgo
    ).length;

    if (messagesLast24h > this.ACTIVITY_SWEET_SPOT_MAX) {
      const excessMessages = messagesLast24h - this.ACTIVITY_SWEET_SPOT_MAX;
      const range = this.ACTIVITY_HARD_CAP - this.ACTIVITY_SWEET_SPOT_MAX;
      overactivityPenalty = Math.pow(Math.min(excessMessages / range, 1), 2);
      reason = `Over-posting: ${messagesLast24h} messages in 24h`;
    }
    
    // --- Combine penalties ---
    const penalty = Math.max(inactivityPenalty, overactivityPenalty);
    const kickChance = Math.min(1, this.BASE_KICK_PROBABILITY + penalty);

    return {
      kickChance,
      reason: kickChance > this.BASE_KICK_PROBABILITY ? reason : 'Random sweep',
      stats: {
        hoursSinceLastMessage,
        messagesLast24h,
        averageQuality: membership.qualityScore,
        totalMessages,
      },
    };
  }

  /**
   * Remove a user from a group chat
   */
  static async removeFromChat(
    userId: string,
    chatId: string,
    reason: string
  ): Promise<void> {
    await prisma.groupChatMembership.updateMany({
      where: {
        userId,
        chatId,
        isActive: true,
      },
      data: {
        isActive: false,
        sweepReason: reason,
        removedAt: new Date(),
      },
    });
  }

  /**
   * Run sweep on all members of a chat
   */
  static async sweepChat(chatId: string): Promise<{
    checked: number;
    removed: number;
    reasons: Record<string, number>;
  }> {
    const memberships = await prisma.groupChatMembership.findMany({
      where: {
        chatId,
        isActive: true,
      },
    });

    let removed = 0;
    const reasons: Record<string, number> = {};

    for (const membership of memberships) {
      const decision = await this.calculateKickChance(membership.userId, chatId);

      if (Math.random() < decision.kickChance && decision.reason) {
        await this.removeFromChat(membership.userId, chatId, decision.reason);
        removed++;

        // Track reasons
        const genericReason = decision.reason.split(':')[0] || 'Unknown';
        reasons[genericReason] = (reasons[genericReason] || 0) + 1;
      }
    }

    return {
      checked: memberships.length,
      removed,
      reasons,
    };
  }

  /**
   * Run sweep on all group chats
   */
  static async sweepAllChats(): Promise<{
    chatsChecked: number;
    totalRemoved: number;
    reasonsSummary: Record<string, number>;
  }> {
    const chats = await prisma.chat.findMany({
      where: {
        isGroup: true,
      },
      select: {
        id: true,
      },
    });

    let totalRemoved = 0;
    const reasonsSummary: Record<string, number> = {};

    for (const chat of chats) {
      const result = await this.sweepChat(chat.id);
      totalRemoved += result.removed;

      // Merge reasons
      for (const [reason, count] of Object.entries(result.reasons)) {
        reasonsSummary[reason] = (reasonsSummary[reason] || 0) + count;
      }
    }

    return {
      chatsChecked: chats.length,
      totalRemoved,
      reasonsSummary,
    };
  }

  /**
   * Update user's quality score in chat
   */
  static async updateQualityScore(
    userId: string,
    chatId: string,
    newMessageQuality: number
  ): Promise<void> {
    const membership = await prisma.groupChatMembership.findUnique({
      where: {
        userId_chatId: {
          userId,
          chatId,
        },
      },
    });

    if (!membership) return;

    // Calculate new average quality
    const totalMessages = membership.messageCount + 1;
    const newAvgQuality =
      (membership.qualityScore * membership.messageCount + newMessageQuality) /
      totalMessages;

    await prisma.groupChatMembership.update({
      where: {
        userId_chatId: {
          userId,
          chatId,
        },
      },
      data: {
        messageCount: totalMessages,
        qualityScore: newAvgQuality,
        lastMessageAt: new Date(),
      },
    });
  }
}


