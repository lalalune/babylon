/**
 * Reply Rate Limiter Service
 * 
 * Enforces exactly 1 reply per hour per NPC for each player.
 * - Too fast: returns error with time until next allowed reply
 * - Too slow: returns warning that consistent replies are needed
 * - Just right: allows reply and tracks timing
 */

import { prisma } from '@/lib/database-service';
import { generateSnowflakeId } from '@/lib/snowflake';

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
  minutesUntilNextReply?: number;
  lastReplyAt?: Date;
  replyStreak?: number; // How many consecutive hours they've replied
  expectedNextReply?: Date; // Expected next reply time based on ideal interval
}

export class ReplyRateLimiter {
  // Exactly 1 reply per hour window (55-65 minutes for some flexibility)
  private static readonly MIN_REPLY_INTERVAL_MS = 55 * 60 * 1000; // 55 minutes
  private static readonly MAX_REPLY_INTERVAL_MS = 65 * 60 * 1000; // 65 minutes
  private static readonly IDEAL_REPLY_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes
  
  // Use IDEAL_REPLY_INTERVAL_MS to calculate expected next reply time
  static getExpectedNextReplyTime(lastReplyTime: Date): Date {
    return new Date(lastReplyTime.getTime() + this.IDEAL_REPLY_INTERVAL_MS);
  }

  /**
   * Check if user can reply to an NPC's post
   */
  static async canReply(userId: string, npcId: string): Promise<RateLimitResult> {
    // Get last interaction with this NPC
    const lastInteraction = await prisma.userInteraction.findFirst({
      where: {
        userId,
        npcId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // First reply to this NPC - always allowed
    if (!lastInteraction) {
      return {
        allowed: true,
        replyStreak: 0,
      };
    }

    const now = new Date();
    const timeSinceLastReply = now.getTime() - lastInteraction.timestamp.getTime();
    
    // Calculate expected next reply time using IDEAL_REPLY_INTERVAL_MS
    const expectedNextReply = this.getExpectedNextReplyTime(lastInteraction.timestamp);

    // Too soon - need to wait
    if (timeSinceLastReply < this.MIN_REPLY_INTERVAL_MS) {
      const nextAllowedAt = new Date(
        lastInteraction.timestamp.getTime() + this.MIN_REPLY_INTERVAL_MS
      );
      const minutesUntilNextReply = Math.ceil(
        (nextAllowedAt.getTime() - now.getTime()) / (60 * 1000)
      );
      
      // Use expectedNextReply for user messaging
      const minutesUntilExpected = Math.ceil(
        (expectedNextReply.getTime() - now.getTime()) / (60 * 1000)
      );

      return {
        allowed: false,
        reason: `You must wait at least 55 minutes between replies to the same NPC. Expected next reply time: ${minutesUntilExpected} minutes. Please wait ${minutesUntilNextReply} more minutes.`,
        nextAllowedAt,
        minutesUntilNextReply,
        lastReplyAt: lastInteraction.timestamp,
        expectedNextReply,
      };
    }

    // Calculate streak (consecutive hourly replies)
    const streak = await this.calculateReplyStreak(userId, npcId);

    // Too late - warn but allow (breaks consistency for following chance)
    if (timeSinceLastReply > this.MAX_REPLY_INTERVAL_MS) {
      return {
        allowed: true,
        reason: `It's been ${Math.floor(timeSinceLastReply / (60 * 60 * 1000))} hours since your last reply. For best chance of being followed, reply every hour.`,
        lastReplyAt: lastInteraction.timestamp,
        replyStreak: 0, // Streak broken
      };
    }

    // Just right - within 55-65 minute window
    return {
      allowed: true,
      lastReplyAt: lastInteraction.timestamp,
      replyStreak: streak + 1, // Continue streak
    };
  }

  /**
   * Calculate consecutive hourly reply streak
   */
  private static async calculateReplyStreak(
    userId: string,
    npcId: string
  ): Promise<number> {
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
        npcId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 24, // Check last 24 interactions
    });

    if (interactions.length < 2) return 0;

    let streak = 0;
    for (let i = 0; i < interactions.length - 1; i++) {
      const current = interactions[i]!.timestamp;
      const previous = interactions[i + 1]!.timestamp;
      const gap = current.getTime() - previous.getTime();

      // If gap is within ideal window (55-65 minutes), continue streak
      if (gap >= this.MIN_REPLY_INTERVAL_MS && gap <= this.MAX_REPLY_INTERVAL_MS) {
        streak++;
      } else {
        // Streak broken
        break;
      }
    }

    return streak;
  }

  /**
   * Record a reply interaction
   */
  static async recordReply(
    userId: string,
    npcId: string,
    postId: string,
    commentId: string,
    qualityScore: number
  ): Promise<void> {
    await prisma.userInteraction.create({
      data: {
        id: await generateSnowflakeId(),
        userId,
        npcId,
        postId,
        commentId,
        qualityScore,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Get user's reply statistics for an NPC
   */
  static async getReplyStats(userId: string, npcId: string) {
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
        npcId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    if (interactions.length === 0) {
      return {
        totalReplies: 0,
        currentStreak: 0,
        longestStreak: 0,
        averageQuality: 0,
        lastReplyAt: null,
      };
    }

    const currentStreak = await this.calculateReplyStreak(userId, npcId);
    const averageQuality =
      interactions.reduce((sum, i) => sum + i.qualityScore, 0) / interactions.length;

    // Calculate longest streak from all historical interactions
    const longestStreak = await this.calculateLongestStreak(userId, npcId, interactions);

    return {
      totalReplies: interactions.length,
      currentStreak,
      longestStreak,
      averageQuality,
      lastReplyAt: interactions[0]?.timestamp,
    };
  }

  /**
   * Calculate longest consecutive reply streak from all interactions
   */
  private static async calculateLongestStreak(
    _userId: string,
    _npcId: string,
    interactions: Array<{ timestamp: Date }>
  ): Promise<number> {
    if (interactions.length < 2) return interactions.length;

    let maxStreak = 1;
    let currentStreak = 1;

    for (let i = 0; i < interactions.length - 1; i++) {
      const current = interactions[i]!.timestamp;
      const next = interactions[i + 1]!.timestamp;
      const gap = current.getTime() - next.getTime();

      // If gap is within ideal window (55-65 minutes), continue streak
      if (gap >= this.MIN_REPLY_INTERVAL_MS && gap <= this.MAX_REPLY_INTERVAL_MS) {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else {
        // Streak broken, reset
        currentStreak = 1;
      }
    }

    return maxStreak;
  }

  /**
   * Get all NPCs user has replied to with their stats
   */
  static async getAllReplyStats(userId: string) {
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Group by NPC
    const npcMap = new Map<string, typeof interactions>();
    for (const interaction of interactions) {
      if (!npcMap.has(interaction.npcId)) {
        npcMap.set(interaction.npcId, []);
      }
      npcMap.get(interaction.npcId)!.push(interaction);
    }

    // Calculate stats for each NPC
    const stats = await Promise.all(
      Array.from(npcMap.keys()).map(async (npcId) => {
        const npcStats = await this.getReplyStats(userId, npcId);
        return {
          npcId,
          ...npcStats,
        };
      })
    );

    return stats;
  }
}


