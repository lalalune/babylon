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
  // Base probability of being kicked per tick for ideal users
  // At 1440 ticks/day, 0.00007 = ~10 day average retention
  private static readonly BASE_KICK_PROBABILITY = 0.00007; // ~10 day retention

  // Inactivity thresholds (in ticks, not hours)
  // 1 tick = 60 seconds, 1440 ticks = 1 day
  private static readonly INACTIVITY_GRACE_PERIOD_TICKS = 1440; // 1 day
  private static readonly INACTIVITY_MAX_TICKS = 7200; // 5 days

  // Activity thresholds (messages per day)
  private static readonly ACTIVITY_SWEET_SPOT_MIN = 1; // At least 1 message per day
  private static readonly ACTIVITY_SWEET_SPOT_MAX = 3; // Up to 3 messages per day is ideal
  private static readonly ACTIVITY_HARD_CAP = 10; // More than 10/day = spamming

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
    const ticksSinceJoin =
      (Date.now() - membership.joinedAt.getTime()) / (1000 * 60); // Convert to ticks (60 sec each)

    // If no messages yet, give them a grace period
    if (totalMessages === 0) {
      if (ticksSinceJoin > this.INACTIVITY_GRACE_PERIOD_TICKS) {
        return {
          kickChance: this.BASE_KICK_PROBABILITY * 100, // 100× multiplier for never posted
          reason: `Never posted after joining (${Math.floor(ticksSinceJoin / 60)} hours ago)`,
          stats: { ...baseStats, hoursSinceLastMessage: ticksSinceJoin / 60 },
        };
      }
      // Safe for now if they just joined
      return {
        kickChance: 0,
        stats: { ...baseStats, hoursSinceLastMessage: ticksSinceJoin / 60 },
      };
    }

    // --- Calculate inactivity multiplier ---
    let inactivityMultiplier = 1;
    let reason = '';
    const lastMessage = allMessages[0]!;
    const ticksSinceLastMessage =
      (Date.now() - lastMessage.createdAt.getTime()) / (1000 * 60); // Convert to ticks

    if (ticksSinceLastMessage > this.INACTIVITY_GRACE_PERIOD_TICKS) {
      const excessTicks = ticksSinceLastMessage - this.INACTIVITY_GRACE_PERIOD_TICKS;
      const range = this.INACTIVITY_MAX_TICKS - this.INACTIVITY_GRACE_PERIOD_TICKS;
      // Scale from 1× to 10× as inactivity increases
      inactivityMultiplier = 1 + (Math.min(excessTicks / range, 1) * 9);
      reason = `Inactive for ${Math.floor(ticksSinceLastMessage / 60)} hours`;
    }

    // --- Calculate over-activity multiplier ---
    let overactivityMultiplier = 1;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const messagesLast24h = allMessages.filter(
      (m) => m.createdAt >= oneDayAgo
    ).length;

    if (messagesLast24h > this.ACTIVITY_HARD_CAP) {
      // Spam: 20× multiplier
      overactivityMultiplier = 20;
      reason = `Spamming: ${messagesLast24h} messages in 24h`;
    } else if (messagesLast24h > this.ACTIVITY_SWEET_SPOT_MAX) {
      // Over-active but not spam: 2-5× multiplier
      const excess = messagesLast24h - this.ACTIVITY_SWEET_SPOT_MAX;
      const range = this.ACTIVITY_HARD_CAP - this.ACTIVITY_SWEET_SPOT_MAX;
      overactivityMultiplier = 2 + (excess / range) * 3; // Scale 2× to 5×
      reason = `Over-active: ${messagesLast24h} messages in 24h`;
    } else if (messagesLast24h < this.ACTIVITY_SWEET_SPOT_MIN) {
      // Under-active: 3× multiplier
      overactivityMultiplier = 3;
      reason = `Low participation: ${messagesLast24h} messages in 24h`;
    }
    
    // --- Combine multipliers ---
    const finalMultiplier = Math.max(inactivityMultiplier, overactivityMultiplier);
    const kickChance = Math.min(1, this.BASE_KICK_PROBABILITY * finalMultiplier);

    return {
      kickChance,
      reason: kickChance > this.BASE_KICK_PROBABILITY ? reason : undefined,
      stats: {
        hoursSinceLastMessage: ticksSinceLastMessage / 60, // Convert back to hours for display
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


