/**
 * Alpha Group Invite Service
 * 
 * Invites users to NPC group chats based on positive interactions.
 * Runs on game ticks with small random chance for eligible users.
 * 
 * Criteria:
 * - User has positive interactions with NPC (replies, likes, shares)
 * - Not too many interactions (avoid spam)
 * - Not already in a group with this NPC
 * - Small random chance each tick (0.5% for highly engaged users)
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { NPCInteractionTracker } from './npc-interaction-tracker';
import { GroupChatInvite } from './group-chat-invite';

export interface AlphaInviteResult {
  npcId: string;
  npcName: string;
  userId: string;
  invitedToChat: string;
  engagementScore: number;
  probability: number;
}

export class AlphaGroupInviteService {
  // Base invite probability per tick (0.5% for top engaged users)
  private static readonly BASE_INVITE_CHANCE = 0.005; // 0.5%
  
  // Minimum engagement score to be considered (0-100 scale)
  private static readonly MIN_ENGAGEMENT_SCORE = 40;
  
  // Maximum invites per tick (prevent too many at once)
  private static readonly MAX_INVITES_PER_TICK = 5;

  /**
   * Process alpha group invites for one tick
   * Checks all NPCs and their top engaged users
   */
  static async processTickInvites(): Promise<AlphaInviteResult[]> {
    const startTime = Date.now();
    const invites: AlphaInviteResult[] = [];

    // Get all NPCs (actors)
    const npcs = await prisma.actor.findMany({
      where: {
        hasPool: true, // Only NPCs with active pools
      },
      select: {
        id: true,
        name: true,
      },
    });

    logger.info(`Processing alpha invites for ${npcs.length} NPCs`, undefined, 'AlphaGroupInviteService');

    // Process each NPC
    for (const npc of npcs) {
      if (invites.length >= this.MAX_INVITES_PER_TICK) {
        logger.info('Reached max invites per tick', { count: invites.length }, 'AlphaGroupInviteService');
        break;
      }

      const npcInvites = await this.processNPCInvites(npc.id, npc.name);
      invites.push(...npcInvites);
    }

    const duration = Date.now() - startTime;
    logger.info(`Alpha invite tick complete: ${invites.length} invites sent`, { duration, invites: invites.length }, 'AlphaGroupInviteService');

    return invites;
  }

  /**
   * Process invites for a single NPC
   */
  private static async processNPCInvites(npcId: string, npcName: string): Promise<AlphaInviteResult[]> {
    const invites: AlphaInviteResult[] = [];

    // Get top engaged users with this NPC
    const topUsers = await NPCInteractionTracker.getTopEngagedUsers(npcId, 20); // Top 20 users

    for (const userScore of topUsers) {
      // Only consider users with sufficient engagement
      if (userScore.engagementScore < this.MIN_ENGAGEMENT_SCORE) {
        continue;
      }

      // Check if already invited to a group with this NPC
      const existingMembership = await prisma.groupChatMembership.findFirst({
        where: {
          userId: userScore.userId,
          npcAdminId: npcId,
          isActive: true,
        },
      });

      if (existingMembership) {
        continue; // Already in a group
      }

      // Calculate invite probability based on engagement score
      // Higher engagement = higher chance
      const scoreFactor = userScore.engagementScore / 100; // 0-1
      const inviteProbability = this.BASE_INVITE_CHANCE * scoreFactor;

      // Roll the dice
      const roll = Math.random();
      
      if (roll < inviteProbability) {
        // User wins the lottery! Invite them
        const chatId = `${npcId}-alpha-chat`;
        const chatName = `${npcName}'s Alpha Group`;

        await GroupChatInvite.recordInvite(
          userScore.userId,
          npcId,
          chatId,
          chatName
        );

        invites.push({
          npcId,
          npcName,
          userId: userScore.userId,
          invitedToChat: chatName,
          engagementScore: userScore.engagementScore,
          probability: inviteProbability,
        });

        logger.info(`User invited to alpha group`, {
          userId: userScore.userId,
          npcId,
          npcName,
          chatName,
          engagementScore: userScore.engagementScore,
          probability: inviteProbability,
          roll,
        }, 'AlphaGroupInviteService');

        // Only one invite per NPC per tick
        break;
      }
    }

    return invites;
  }

  /**
   * Get invite statistics for debugging
   */
  static async getInviteStats(): Promise<{
    totalInvites: number;
    activeGroups: number;
    invitesLast24h: number;
  }> {
    const [totalInvites, activeGroups, recentInvites] = await Promise.all([
      prisma.groupChatMembership.count(),
      prisma.groupChatMembership.count({
        where: { isActive: true },
      }),
      prisma.groupChatMembership.count({
        where: {
          joinedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      totalInvites,
      activeGroups,
      invitesLast24h: recentInvites,
    };
  }
}

