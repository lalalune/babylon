/**
 * NPC Interaction Tracker
 * 
 * Tracks all user interactions with NPCs:
 * - Replies to NPC posts
 * - Likes on NPC posts
 * - Shares/retweets of NPC posts
 * 
 * Calculates engagement scores for group invite eligibility
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

export interface NPCInteractionScore {
  userId: string;
  npcId: string;
  replyCount: number;
  likeCount: number;
  shareCount: number;
  totalInteractions: number;
  avgQualityScore: number;
  engagementScore: number; // 0-100 score
  isEligibleForInvite: boolean;
  reasons: string[];
}

export interface InteractionWindow {
  startDate: Date;
  endDate: Date;
}

export class NPCInteractionTracker {
  // Thresholds for healthy engagement
  private static readonly MIN_REPLIES = 3;
  private static readonly MIN_LIKES = 5;
  private static readonly MIN_TOTAL_INTERACTIONS = 10;
  private static readonly MAX_INTERACTIONS_PER_DAY = 50; // Prevent spam
  
  // Weights for engagement score
  private static readonly REPLY_WEIGHT = 3.0; // Replies are most valuable
  private static readonly LIKE_WEIGHT = 1.0;
  private static readonly SHARE_WEIGHT = 2.0;

  /**
   * Track a like interaction
   */
  static async trackLike(userId: string, postId: string): Promise<void> {
    // Get post author (should be an NPC)
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) {
      return;
    }

    // Check if author is an NPC
    const author = await prisma.user.findUnique({
      where: { id: post.authorId },
      select: { isActor: true },
    });

    if (!author?.isActor) {
      return; // Not an NPC post
    }

    // We don't need to store individual likes in UserInteraction
    // They're already in the Reaction table
    // This method is just for validation
    
    logger.debug(`User ${userId} liked NPC ${post.authorId}'s post`, undefined, 'NPCInteractionTracker');
  }

  /**
   * Track a share/retweet interaction
   */
  static async trackShare(userId: string, postId: string): Promise<void> {
    // Get post author (should be an NPC)
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) {
      return;
    }

    // Check if author is an NPC
    const author = await prisma.user.findUnique({
      where: { id: post.authorId },
      select: { isActor: true },
    });

    if (!author?.isActor) {
      return; // Not an NPC post
    }

    // We don't need to store individual shares in UserInteraction
    // They're already in the Share table
    
    logger.debug(`User ${userId} shared NPC ${post.authorId}'s post`, undefined, 'NPCInteractionTracker');
  }

  /**
   * Calculate engagement score for a user with an NPC
   */
  static async calculateEngagementScore(
    userId: string,
    npcId: string,
    window?: InteractionWindow
  ): Promise<NPCInteractionScore> {
    const endDate = window?.endDate || new Date();
    const startDate = window?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

    // Get all NPC posts in the time window
    const npcPosts = await prisma.post.findMany({
      where: {
        authorId: npcId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const npcPostIds = npcPosts.map(p => p.id);

    // Count replies (from UserInteraction table)
    const replyInteractions = await prisma.userInteraction.findMany({
      where: {
        userId,
        npcId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        qualityScore: true,
      },
    });

    const replyCount = replyInteractions.length;
    const avgQualityScore = replyCount > 0
      ? replyInteractions.reduce((sum, i) => sum + i.qualityScore, 0) / replyCount
      : 0;

    // Count likes
    const likeCount = await prisma.reaction.count({
      where: {
        userId,
        postId: {
          in: npcPostIds,
        },
        type: 'like',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Count shares
    const shareCount = await prisma.share.count({
      where: {
        userId,
        postId: {
          in: npcPostIds,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalInteractions = replyCount + likeCount + shareCount;

    // Calculate engagement score (0-100)
    const replyScore = replyCount * this.REPLY_WEIGHT;
    const likeScore = likeCount * this.LIKE_WEIGHT;
    const shareScore = shareCount * this.SHARE_WEIGHT;
    
    const rawScore = replyScore + likeScore + shareScore;
    
    // Normalize to 0-100 scale (cap at reasonable max)
    const maxExpectedScore = 100; // Roughly 20 replies + 20 likes + 10 shares
    const engagementScore = Math.min(100, (rawScore / maxExpectedScore) * 100);

    // Quality multiplier (if avg quality is high, boost score)
    const qualityMultiplier = avgQualityScore > 0.8 ? 1.2 : 1.0;
    const finalScore = Math.min(100, engagementScore * qualityMultiplier);

    // Determine eligibility
    const reasons: string[] = [];
    let isEligible = true;

    if (replyCount < this.MIN_REPLIES) {
      isEligible = false;
      reasons.push(`Need ${this.MIN_REPLIES - replyCount} more replies`);
    }

    if (likeCount < this.MIN_LIKES) {
      isEligible = false;
      reasons.push(`Need ${this.MIN_LIKES - likeCount} more likes`);
    }

    if (totalInteractions < this.MIN_TOTAL_INTERACTIONS) {
      isEligible = false;
      reasons.push(`Need ${this.MIN_TOTAL_INTERACTIONS - totalInteractions} more total interactions`);
    }

    // Check for spam (too many interactions per day)
    const daysSinceStart = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const interactionsPerDay = totalInteractions / daysSinceStart;
    
    if (interactionsPerDay > this.MAX_INTERACTIONS_PER_DAY) {
      isEligible = false;
      reasons.push('Too many interactions per day (possible spam)');
    }

    // Quality threshold
    if (avgQualityScore < 0.7 && replyCount > 0) {
      isEligible = false;
      reasons.push('Reply quality is too low');
    }

    if (isEligible) {
      reasons.push('Eligible for group invite!');
      reasons.push(`Engagement score: ${finalScore.toFixed(0)}/100`);
    }

    return {
      userId,
      npcId,
      replyCount,
      likeCount,
      shareCount,
      totalInteractions,
      avgQualityScore,
      engagementScore: finalScore,
      isEligibleForInvite: isEligible,
      reasons,
    };
  }

  /**
   * Get top users by engagement with an NPC
   */
  static async getTopEngagedUsers(
    npcId: string,
    limit: number = 10,
    window?: InteractionWindow
  ): Promise<NPCInteractionScore[]> {
    // Get all users who have interacted with this NPC
    const interactions = await prisma.userInteraction.findMany({
      where: {
        npcId,
        timestamp: window ? {
          gte: window.startDate,
          lte: window.endDate,
        } : undefined,
      },
      select: {
        userId: true,
      },
      distinct: ['userId'],
    });

    const userIds = interactions.map(i => i.userId);

    // Calculate scores for each user
    const scores = await Promise.all(
      userIds.map(userId => this.calculateEngagementScore(userId, npcId, window))
    );

    // Sort by engagement score and return top N
    return scores
      .sort((a, b) => b.engagementScore - a.engagementScore)
      .slice(0, limit);
  }

  /**
   * Get all NPCs a user has engaged with
   */
  static async getUserEngagedNPCs(userId: string, window?: InteractionWindow): Promise<string[]> {
    const interactions = await prisma.userInteraction.findMany({
      where: {
        userId,
        timestamp: window ? {
          gte: window.startDate,
          lte: window.endDate,
        } : undefined,
      },
      select: {
        npcId: true,
      },
      distinct: ['npcId'],
    });

    return interactions.map(i => i.npcId);
  }
}

