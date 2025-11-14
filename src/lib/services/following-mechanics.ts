/**
 * Following Mechanics Service
 * 
 * Determines when NPCs follow players based on:
 * - Reply consistency (streak of hourly replies)
 * - Quality of replies (average quality score)
 * - Time invested (total number of quality replies)
 * 
 * Following probability increases with:
 * - Longer streaks (5+ hourly replies in a row)
 * - Higher quality scores (0.7+)
 * - More total interactions (10+ quality replies)
 */

import { notifyFollow } from './notification-service';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';


export interface FollowingChance {
  willFollow: boolean;
  probability: number; // 0-1
  reasons: string[];
  factors: {
    streak: number;
    quality: number;
    volume: number;
  };
}

export class FollowingMechanics {
  // Following probability factors
  private static readonly MIN_STREAK_FOR_FOLLOW = 5; // 5 consecutive hourly replies
  private static readonly MIN_QUALITY_SCORE = 0.7;
  private static readonly MIN_TOTAL_REPLIES = 10;

  // Base probabilities
  private static readonly BASE_FOLLOW_PROBABILITY = 0.05; // 5% base chance
  private static readonly MAX_FOLLOW_PROBABILITY = 0.80; // 80% max chance

  /**
   * Calculate if NPC should follow player after a reply
   */
  static async calculateFollowingChance(
    userId: string,
    npcId: string,
    currentStreak: number,
    currentQualityScore: number
  ): Promise<FollowingChance> {
    // Use currentQualityScore to calculate following probability
    // Higher quality interactions increase following chance
    const qualityMultiplier = Math.min(currentQualityScore * 1.5, 2.0); // Cap at 2x
    
    // Check if already following
    const existingFollow = await prisma.followStatus.findUnique({
      where: {
        userId_npcId: {
          userId,
          npcId,
        },
      },
    });

    if (existingFollow && existingFollow.isActive) {
      return {
        willFollow: false,
        probability: 0,
        reasons: ['Already following'],
        factors: { streak: 0, quality: 0, volume: 0 },
      };
    }

    // Get all interactions for quality and volume metrics
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
        npcId,
      },
      select: {
        qualityScore: true,
      },
    });

    const totalReplies = interactions.length;
    const averageQuality =
      interactions.reduce((sum, i) => sum + i.qualityScore, 0) /
      Math.max(interactions.length, 1);

    // Calculate factor scores (0-1)
    const streakFactor = Math.min(currentStreak / this.MIN_STREAK_FOR_FOLLOW, 1);
    const qualityFactor = Math.min(averageQuality / this.MIN_QUALITY_SCORE, 1);
    const volumeFactor = Math.min(totalReplies / this.MIN_TOTAL_REPLIES, 1);

    // Calculate weighted probability
    // Streak is most important (50%), quality (30%), volume (20%)
    // Apply qualityMultiplier to boost probability for high-quality interactions
    const baseProbability = this.BASE_FOLLOW_PROBABILITY +
      (this.MAX_FOLLOW_PROBABILITY - this.BASE_FOLLOW_PROBABILITY) *
        (streakFactor * 0.5 + qualityFactor * 0.3 + volumeFactor * 0.2);
    
    const probability = Math.min(
      baseProbability * qualityMultiplier,
      this.MAX_FOLLOW_PROBABILITY
    );

    // Reasons for following (or not)
    const reasons: string[] = [];

    if (currentStreak >= this.MIN_STREAK_FOR_FOLLOW) {
      reasons.push(`Consistent streak: ${currentStreak} hourly replies`);
    } else {
      reasons.push(
        `Need ${this.MIN_STREAK_FOR_FOLLOW - currentStreak} more consecutive hourly replies`
      );
    }

    if (averageQuality >= this.MIN_QUALITY_SCORE) {
      reasons.push(`High quality: ${(averageQuality * 100).toFixed(0)}% avg`);
    } else {
      reasons.push(
        `Improve quality to ${(this.MIN_QUALITY_SCORE * 100).toFixed(0)}%+ for better chances`
      );
    }

    if (totalReplies >= this.MIN_TOTAL_REPLIES) {
      reasons.push(`Engaged: ${totalReplies} quality replies`);
    } else {
      reasons.push(`Post ${this.MIN_TOTAL_REPLIES - totalReplies} more quality replies`);
    }

    // Roll the dice
    const willFollow = Math.random() < probability;

    return {
      willFollow,
      probability,
      reasons,
      factors: {
        streak: streakFactor,
        quality: qualityFactor,
        volume: volumeFactor,
      },
    };
  }

  /**
   * Record an NPC following a player
   */
  static async recordFollow(
    userId: string,
    npcId: string,
    reason: string
  ): Promise<void> {
    await prisma.followStatus.upsert({
      where: {
        userId_npcId: {
          userId,
          npcId,
        },
      },
      update: {
        isActive: true,
        followedAt: new Date(),
        unfollowedAt: null,
        followReason: reason,
      },
      create: {
        userId,
        npcId,
        followReason: reason,
      },
    });

    // Mark the interaction that triggered the follow
    await prisma.userInteraction.updateMany({
      where: {
        userId,
        npcId,
      },
      data: {
        wasFollowed: true,
      },
    });

    // Create notification for the user (NPCs follow users, not the other way around)
    // Note: For NPC follows, we use the NPC's ID as actorId since they're not real users
    // In the future, if NPCs have user records, we can update this
    await notifyFollow(userId, npcId);
  }

  /**
   * Check if an NPC is following a player
   */
  static async isFollowing(userId: string, npcId: string): Promise<boolean> {
    const follow = await prisma.followStatus.findUnique({
      where: {
        userId_npcId: {
          userId,
          npcId,
        },
      },
    });

    return follow?.isActive ?? false;
  }

  /**
   * Get all NPCs following a player
   */
  static async getFollowers(userId: string) {
    const follows = await prisma.followStatus.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        followedAt: 'desc',
      },
    });

    return follows;
  }

  /**
   * Unfollow (if quality drops or streak breaks badly)
   */
  static async unfollow(
    userId: string,
    npcId: string,
    reason: string
  ): Promise<void> {
    // Log unfollow reason for analytics/debugging
    logger.info(`User ${userId} unfollowed ${npcId}. Reason: ${reason}`, undefined, 'FollowingMechanics');
    
    await prisma.followStatus.updateMany({
      where: {
        userId,
        npcId,
        isActive: true,
      },
      data: {
        isActive: false,
        unfollowedAt: new Date(),
      },
    });
  }

  /**
   * Check if follow should be revoked (periodic check)
   */
  static async shouldUnfollow(userId: string, npcId: string): Promise<boolean> {
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
        npcId,
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 10,
    });

    if (interactions.length === 0) return false;

    // Check for sustained low quality
    const recentQuality =
      interactions.reduce((sum, i) => sum + i.qualityScore, 0) /
      interactions.length;

    if (recentQuality < 0.4) {
      return true; // Quality dropped too low
    }

    // Check for long gaps (no replies for 24+ hours)
    const lastInteraction = interactions[0]!.timestamp;
    const hoursSinceLastReply =
      (Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastReply > 24) {
      return true; // Stopped engaging
    }

    return false;
  }
}


