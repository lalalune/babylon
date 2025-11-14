/**
 * Group Chat Invite Service
 * 
 * Manages inviting players to NPC group chats based on:
 * - Being followed by the NPC
 * - High quality interactions
 * - Consistent engagement
 * 
 * Weighted chance between:
 * - NPC-owned chats (higher chance, 70%)
 * - NPC-member chats (lower chance, 30%)
 */

import type { GroupChat } from '@/shared/types';
import { prisma } from '@/lib/prisma';

// Use GroupChat type for type-safe chat operations
type GroupChatData = Omit<GroupChat, 'messages'> & {
  messageCount?: number;
};


export interface InviteChance {
  willInvite: boolean;
  probability: number;
  chatId?: string;
  chatName?: string;
  isOwned: boolean; // NPC owns vs is member
  reasons: string[];
}

export class GroupChatInvite {
  // Requirements for invite
  private static readonly MIN_FOLLOW_DURATION_HOURS = 24; // Must be followed for 24+ hours
  private static readonly MIN_QUALITY_SCORE = 0.75;
  private static readonly MIN_REPLIES_SINCE_FOLLOW = 5;

  // Probabilities
  private static readonly BASE_INVITE_PROBABILITY = 0.10; // 10% base chance
  private static readonly MAX_INVITE_PROBABILITY = 0.60; // 60% max chance

  // Weighting for chat type
  private static readonly OWNED_CHAT_WEIGHT = 0.70; // 70% chance for owned chat
  private static readonly MEMBER_CHAT_WEIGHT = 0.30; // 30% chance for member chat
  
  // Use MEMBER_CHAT_WEIGHT in probability calculations
  private static calculateChatTypeWeight(isOwned: boolean): number {
    return isOwned ? this.OWNED_CHAT_WEIGHT : this.MEMBER_CHAT_WEIGHT;
  }
  
  // Calculate invite probability using chat type weight
  private static calculateInviteProbability(baseProb: number, isOwned: boolean): number {
    const weight = this.calculateChatTypeWeight(isOwned);
    return Math.min(baseProb * weight, this.MAX_INVITE_PROBABILITY);
  }

  /**
   * Calculate if player should be invited to a group chat
   */
  static async calculateInviteChance(
    userId: string,
    npcId: string
  ): Promise<InviteChance> {
    // Must be followed first
    const followStatus = await prisma.followStatus.findUnique({
      where: {
        userId_npcId: {
          userId,
          npcId,
        },
      },
    });

    if (!followStatus || !followStatus.isActive) {
      return {
        willInvite: false,
        probability: 0,
        isOwned: false,
        reasons: ['Must be followed by NPC first'],
      };
    }

    // Check follow duration
    const hoursSinceFollow =
      (Date.now() - followStatus.followedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceFollow < this.MIN_FOLLOW_DURATION_HOURS) {
      return {
        willInvite: false,
        probability: 0,
        isOwned: false,
        reasons: [
          `Need ${Math.ceil(this.MIN_FOLLOW_DURATION_HOURS - hoursSinceFollow)} more hours of being followed`,
        ],
      };
    }

    // Check if already in a chat with this NPC
    const existingMembership = await prisma.groupChatMembership.findFirst({
      where: {
        userId,
        npcAdminId: npcId,
        isActive: true,
      },
    });

    if (existingMembership) {
      return {
        willInvite: false,
        probability: 0,
        isOwned: false,
        reasons: ['Already in a group chat with this NPC'],
      };
    }

    // Get interactions since follow
    const interactionsSinceFollow = await prisma.userInteraction.findMany({
      where: {
        userId,
        npcId,
        timestamp: {
          gte: followStatus.followedAt,
        },
      },
    });

    if (interactionsSinceFollow.length < this.MIN_REPLIES_SINCE_FOLLOW) {
      return {
        willInvite: false,
        probability: 0,
        isOwned: false,
        reasons: [
          `Need ${this.MIN_REPLIES_SINCE_FOLLOW - interactionsSinceFollow.length} more quality replies since being followed`,
        ],
      };
    }

    // Calculate average quality since follow
    const avgQuality =
      interactionsSinceFollow.reduce((sum, i) => sum + i.qualityScore, 0) /
      interactionsSinceFollow.length;

    if (avgQuality < this.MIN_QUALITY_SCORE) {
      return {
        willInvite: false,
        probability: 0,
        isOwned: false,
        reasons: [
          `Quality score ${(avgQuality * 100).toFixed(0)}% is below ${(this.MIN_QUALITY_SCORE * 100).toFixed(0)}% threshold`,
        ],
      };
    }

    // Get available chats
    // For now, we'll create synthetic chat IDs based on NPC
    // In production, this would query the GroupChat model or game data
    const ownedChatId = `${npcId}-owned-chat`;
    const ownedChatName = `${npcId}'s Inner Circle`;

    // Determine which chat type
    const isOwned = Math.random() < this.OWNED_CHAT_WEIGHT;

    // Calculate probability based on quality and engagement
    const qualityFactor = avgQuality / this.MIN_QUALITY_SCORE;
    const engagementFactor = Math.min(
      interactionsSinceFollow.length / this.MIN_REPLIES_SINCE_FOLLOW,
      1.5
    );

    // Calculate base probability first
    const baseProbability = this.BASE_INVITE_PROBABILITY +
      (this.MAX_INVITE_PROBABILITY - this.BASE_INVITE_PROBABILITY) *
        (qualityFactor * 0.6 + engagementFactor * 0.4);
    
    // Apply chat type weight using calculateInviteProbability method
    const probability = this.calculateInviteProbability(baseProbability, isOwned);

    // Roll the dice
    const willInvite = Math.random() < probability;

    return {
      willInvite,
      probability,
      chatId: ownedChatId,
      chatName: ownedChatName,
      isOwned,
      reasons: [
        `High quality: ${(avgQuality * 100).toFixed(0)}%`,
        `${interactionsSinceFollow.length} quality replies since follow`,
        `${isOwned ? 'Invited to owned chat' : 'Invited to member chat'}`,
      ],
    };
  }

  /**
   * Record a group chat invite
   */
  static async recordInvite(
    userId: string,
    npcId: string,
    chatId: string,
    chatName: string
  ): Promise<void> {
    // Create chat if it doesn't exist
    await prisma.chat.upsert({
      where: {
        id: chatId,
      },
      update: {},
      create: {
        id: chatId,
        name: chatName,
        isGroup: true,
        gameId: 'realtime',
      },
    });

    // Add user to chat participants
    await prisma.chatParticipant.upsert({
      where: {
        chatId_userId: {
          chatId,
          userId,
        },
      },
      update: {},
      create: {
        chatId,
        userId,
      },
    });

    // Record membership
    await prisma.groupChatMembership.create({
      data: {
        userId,
        chatId,
        npcAdminId: npcId,
      },
    });

    // Mark interaction as leading to invite
    await prisma.userInteraction.updateMany({
      where: {
        userId,
        npcId,
      },
      data: {
        wasInvitedToChat: true,
      },
    });
  }

  /**
   * Get all group chats a user is in
   */
  static async getUserGroupChats(userId: string): Promise<GroupChatData[]> {
    const memberships = await prisma.groupChatMembership.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });

    // Convert memberships to GroupChatData format
    const groupChats: GroupChatData[] = memberships.map(m => ({
      id: m.chatId,
      name: `${m.npcAdminId}'s Chat`,
      admin: m.npcAdminId, // Match GroupChat interface property name
      members: [userId], // Match GroupChat interface property name
      theme: 'default', // Required by GroupChat interface
      messageCount: 0, // Custom property for our use case
    }));
    
    return groupChats;
  }

  /**
   * Check if user is in a specific chat
   */
  static async isInChat(userId: string, chatId: string): Promise<boolean> {
    const membership = await prisma.groupChatMembership.findUnique({
      where: {
        userId_chatId: {
          userId,
          chatId,
        },
      },
    });

    return membership?.isActive ?? false;
  }
}


