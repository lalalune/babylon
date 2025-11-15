/**
 * NPC Group Dynamics Service
 * 
 * Manages continuous NPC group chat dynamics:
 * - Form new groups based on relationships
 * - NPCs join existing groups
 * - NPCs leave groups
 * - NPCs kick members from their groups
 * - NPCs invite users to their groups
 * - NPCs post messages to groups
 * 
 * Runs on game ticks to keep groups active and dynamic.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import { BabylonLLMClient } from '@/generator/llm/openai-client';
import { generateWorldContext } from '@/lib/prompts/world-context';
import { validateNoRealNames, validateNoHashtags, validateNoEmojis } from '@/lib/prompts/validate-output';
import { Prisma } from '@prisma/client';

export interface GroupDynamicsResult {
  groupsCreated: number;
  membersAdded: number;
  membersRemoved: number;
  usersInvited: number;
  usersKicked: number;
  messagesPosted: number;
}

export class NPCGroupDynamicsService {
  // Probabilities for actions per tick
  private static readonly FORM_NEW_GROUP_CHANCE = 0.05; // 5% chance per NPC
  private static readonly JOIN_GROUP_CHANCE = 0.10; // 10% chance if eligible
  private static readonly LEAVE_GROUP_CHANCE = 0.02; // 2% chance per membership
  private static readonly POST_MESSAGE_CHANCE = 0.25; // 25% chance per active group
  private static readonly INVITE_USER_CHANCE = 0.08; // 8% chance per group with space
  private static readonly KICK_CHECK_CHANCE = 0.15; // 15% chance to check for kicks
  
  // Group size limits
  private static readonly MIN_GROUP_SIZE = 3;
  private static readonly MAX_GROUP_SIZE = 12;
  private static readonly IDEAL_GROUP_SIZE = 7;
  
  // User group participation limits (prevent unlimited accumulation)
  private static readonly MAX_ACTIVE_USER_GROUPS = 5; // Max groups a user can be in simultaneously
  private static readonly INVITE_COOLDOWN_HOURS = 4; // Hours after joining before next invite eligible

  /**
   * Process all NPC group dynamics for one tick
   */
  static async processTickDynamics(): Promise<GroupDynamicsResult> {
    const startTime = Date.now();
    const result: GroupDynamicsResult = {
      groupsCreated: 0,
      membersAdded: 0,
      membersRemoved: 0,
      usersInvited: 0,
      usersKicked: 0,
      messagesPosted: 0,
    };

    try {
      logger.info('Processing NPC group dynamics', undefined, 'NPCGroupDynamicsService');

      // Initialize LLM client for message generation
      let llm: BabylonLLMClient | null = null;
      try {
        llm = new BabylonLLMClient();
      } catch (error) {
        logger.warn('Failed to initialize LLM for group dynamics', { error }, 'NPCGroupDynamicsService');
      }

      // 1. Form new groups
      const newGroups = await this.formNewGroups();
      result.groupsCreated = newGroups;

      // 2. NPCs join existing groups
      const joins = await this.processGroupJoins();
      result.membersAdded = joins;

      // 3. NPCs leave groups
      const leaves = await this.processGroupLeaves();
      result.membersRemoved = leaves;

      // 4. NPCs post messages to groups
      if (llm) {
        const messages = await this.postGroupMessages(llm);
        result.messagesPosted = messages;
      }

      // 5. Invite users to groups
      const invites = await this.inviteUsersToGroups();
      result.usersInvited = invites;

      // 6. Kick users based on weighted participation metrics
      const kicks = await this.kickUsersWithWeightedLogic();
      result.usersKicked = kicks;

      const duration = Date.now() - startTime;
      logger.info('NPC group dynamics complete', { ...result, duration }, 'NPCGroupDynamicsService');

      return result;
    } catch (error) {
      logger.error('Error in NPC group dynamics', { error }, 'NPCGroupDynamicsService');
      return result;
    }
  }

  /**
   * Form new NPC groups based on relationships
   */
  private static async formNewGroups(): Promise<number> {
    let groupsCreated = 0;

    try {
      // Get NPCs who could start a group
      const npcs = await prisma.actor.findMany({
        where: {
          hasPool: true,
        },
        select: {
          id: true,
          name: true,
        },
      });

      for (const npc of npcs) {
        // Random chance to form a group
        if (Math.random() > this.FORM_NEW_GROUP_CHANCE) {
          continue;
        }

        // Check if NPC already has a group they admin
        const existingGroup = await prisma.chat.findFirst({
          where: {
            name: {
              contains: npc.name,
            },
            isGroup: true,
          },
        });

        if (existingGroup) {
          continue; // Already has a group
        }

        // Get NPC's positive relationships
        const relationships = await prisma.actorRelationship.findMany({
          where: {
            OR: [
              { actor1Id: npc.id },
              { actor2Id: npc.id },
            ],
            sentiment: {
              gte: 0.5, // Positive relationships
            },
          },
          take: this.IDEAL_GROUP_SIZE - 1, // -1 for the admin
        });

        const memberIds = new Set<string>([npc.id]);

        // Add related actors as members
        for (const rel of relationships) {
          const memberId = rel.actor1Id === npc.id ? rel.actor2Id : rel.actor1Id;
          memberIds.add(memberId);
        }

        if (memberIds.size < this.MIN_GROUP_SIZE) {
          continue; // Not enough members
        }

        // Create the group chat
        const chatId = await generateSnowflakeId();
        const chatName = `${npc.name}'s Circle`;

        await prisma.chat.create({
        data: {
          id: chatId,
          name: chatName,
          isGroup: true,
          updatedAt: new Date(),
          ChatParticipant: {
            create: await Promise.all(
              Array.from(memberIds).map(async (memberId) => ({
                id: await generateSnowflakeId(),
                userId: memberId,
              }))
            ),
          },
        },
        });

        groupsCreated++;
        logger.info(`NPC formed new group`, {
          npcId: npc.id,
          npcName: npc.name,
          chatName,
          memberCount: memberIds.size,
        }, 'NPCGroupDynamicsService');
      }
    } catch (error) {
      logger.error('Error forming new groups', { error }, 'NPCGroupDynamicsService');
    }

    return groupsCreated;
  }

  /**
   * Process NPCs joining existing groups
   */
  private static async processGroupJoins(): Promise<number> {
    let joinsProcessed = 0;

    try {
      // Get all NPC group chats
      const groups = await prisma.chat.findMany({
        where: {
          isGroup: true,
        },
        include: {
          ChatParticipant: {
            select: {
              userId: true,
            },
          },
        },
      });

      for (const group of groups) {
        // Don't add to full groups
        if (group.ChatParticipant.length >= this.MAX_GROUP_SIZE) {
          continue;
        }

        const currentMemberIds = new Set(group.ChatParticipant.map(p => p.userId));

        // Get NPCs who could join
        const potentialMembers = await prisma.actor.findMany({
          where: {
            hasPool: true,
            id: {
              notIn: Array.from(currentMemberIds),
            },
          },
          take: 5, // Check a few candidates
        });

        for (const candidate of potentialMembers) {
          // Random chance to join
          if (Math.random() > this.JOIN_GROUP_CHANCE) {
            continue;
          }

          // Check if candidate has positive relationships with current members
          const relationships = await prisma.actorRelationship.findMany({
            where: {
              OR: [
                {
                  actor1Id: candidate.id,
                  actor2Id: {
                    in: Array.from(currentMemberIds),
                  },
                },
                {
                  actor2Id: candidate.id,
                  actor1Id: {
                    in: Array.from(currentMemberIds),
                  },
                },
              ],
              sentiment: {
                gte: 0.3, // Somewhat positive
              },
            },
          });

          // Must have at least 2 friends in the group
          if (relationships.length >= 2) {
            // Add to group
            await prisma.chatParticipant.create({
              data: {
                id: await generateSnowflakeId(),
                chatId: group.id,
                userId: candidate.id,
              },
            });

            joinsProcessed++;
            logger.info(`NPC joined group`, {
              npcId: candidate.id,
              npcName: candidate.name,
              chatName: group.name,
              friendsInGroup: relationships.length,
            }, 'NPCGroupDynamicsService');

            break; // Only one join per group per tick
          }
        }
      }
    } catch (error) {
      logger.error('Error processing group joins', { error }, 'NPCGroupDynamicsService');
    }

    return joinsProcessed;
  }

  /**
   * Process NPCs leaving groups
   */
  private static async processGroupLeaves(): Promise<number> {
    let leavesProcessed = 0;

    try {
      // Get all NPC group memberships
      const memberships = await prisma.chatParticipant.findMany({
        where: {
          Chat: {
            isGroup: true,
          },
        },
        include: {
          Chat: {
            include: {
              ChatParticipant: true,
            },
          },
        },
      });

      for (const membership of memberships) {
        // Don't leave if group would become too small
        if (membership.Chat.ChatParticipant.length <= this.MIN_GROUP_SIZE) {
          continue;
        }

        // Random chance to leave
        if (Math.random() > this.LEAVE_GROUP_CHANCE) {
          continue;
        }

        // Check if NPC is the group creator (don't leave own group)
        if (membership.Chat.name?.includes(membership.userId)) {
          continue;
        }

        // Check if NPC has negative relationships with members
        const memberIds = membership.Chat.ChatParticipant
          .map(p => p.userId)
          .filter(id => id !== membership.userId);

        const negativeRelationships = await prisma.actorRelationship.findMany({
          where: {
            OR: [
              {
                actor1Id: membership.userId,
                actor2Id: {
                  in: memberIds,
                },
              },
              {
                actor2Id: membership.userId,
                actor1Id: {
                  in: memberIds,
                },
              },
            ],
            sentiment: {
              lt: -0.3, // Negative
            },
          },
        });

        // Leave if too many enemies in group
        if (negativeRelationships.length >= 2) {
          await prisma.chatParticipant.delete({
            where: {
              id: membership.id,
            },
          });

          leavesProcessed++;
          logger.info(`NPC left group`, {
            npcId: membership.userId,
            chatName: membership.Chat.name,
            reason: `${negativeRelationships.length} negative relationships`,
          }, 'NPCGroupDynamicsService');
        }
      }
    } catch (error) {
      logger.error('Error processing group leaves', { error }, 'NPCGroupDynamicsService');
    }

    return leavesProcessed;
  }

  /**
   * Post messages to groups from NPCs
   */
  private static async postGroupMessages(llm: BabylonLLMClient): Promise<number> {
    let messagesPosted = 0;

    try {
      // Get active group chats with NPC participants
      const groups = await prisma.chat.findMany({
        where: {
          isGroup: true,
        },
        include: {
          ChatParticipant: true,
          Message: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
          },
        },
        take: 20, // Process up to 20 groups per tick
      });

      for (const group of groups) {
        // Random chance to post
        if (Math.random() > this.POST_MESSAGE_CHANCE) {
          continue;
        }

        // Get user details for participants
        const participantUserIds = group.ChatParticipant.map(p => p.userId);
        const participantUsers = await prisma.user.findMany({
          where: { id: { in: participantUserIds } },
          select: { id: true, displayName: true, isActor: true },
        });

        // Get NPCs in this group
        const npcUsers = participantUsers.filter(u => u.isActor);

        if (npcUsers.length === 0) {
          continue; // No NPCs in this group
        }

        // Pick a random NPC to post
        const randomNpc = npcUsers[Math.floor(Math.random() * npcUsers.length)];
        if (!randomNpc) continue;

        // Get sender details for recent messages
        const messageSenderIds = group.Message.slice(0, 5).map(m => m.senderId);
        const senders = await prisma.user.findMany({
          where: { id: { in: messageSenderIds } },
          select: { id: true, displayName: true },
        });
        const senderMap = new Map(senders.map(s => [s.id, s.displayName || 'Someone']));

        // Build conversation context from recent messages
        const recentMessages = group.Message.slice(0, 5)
          .reverse()
          .map((m) => `${senderMap.get(m.senderId) || 'Someone'}: ${m.content}`)
          .join('\n');

        const contextPrompt = recentMessages
          ? `Recent conversation:\n${recentMessages}\n\nRespond naturally to continue the conversation.`
          : `Start a casual conversation in the group "${group.name}".`;

        try {
          // Get world context for consistent parody names and market awareness
          const worldContext = await generateWorldContext({ maxActors: 20 });
          
          // Generate message using LLM with world context
          const prompt = `You are ${randomNpc.displayName}, chatting in a private group chat. ${contextPrompt}

${worldContext.worldActors}
${worldContext.currentMarkets}
${worldContext.recentTrades}

Write a brief, casual message (max 150 chars). Be natural and conversational.

IMPORTANT RULES:
- NO hashtags or emojis
- NEVER use real names (Elon Musk, Sam Altman, etc.)
- ALWAYS use parody names from World Actors list (AIlon Musk, Sam AIltman, etc.)
- You may reference markets or trades naturally if relevant

Return your response as XML in this exact format:
<response>
  <message>your message here</message>
</response>`;

          const rawResponse = await llm.generateJSON<{ message: string } | { response: { message: string } }>(
            prompt,
            {
              properties: {
                message: { type: 'string' },
              },
              required: ['message'],
            },
            { temperature: 0.9, maxTokens: 100 }
          );

          // Handle XML structure
          const response = 'response' in rawResponse && rawResponse.response
            ? rawResponse.response
            : rawResponse as { message: string };

          if (!response.message || response.message.length === 0) {
            continue;
          }

          // Validate message follows rules
          const messageContent = response.message.trim();
          const realNameViolations = validateNoRealNames(messageContent);
          const hashtagViolations = validateNoHashtags(messageContent);
          const emojiViolations = validateNoEmojis(messageContent);
          
          if (realNameViolations.length > 0 || hashtagViolations.length > 0 || emojiViolations.length > 0) {
            logger.warn('NPC group message validation failed, skipping', {
              npcId: randomNpc.id,
              violations: [...realNameViolations, ...hashtagViolations, ...emojiViolations],
              message: messageContent,
            }, 'NPCGroupDynamicsService');
            continue;
          }

          // Create the message
          await prisma.message.create({
            data: {
              id: await generateSnowflakeId(),
              content: messageContent,
              chatId: group.id,
              senderId: randomNpc.id,
              createdAt: new Date(),
            },
          });

          // Update chat updated timestamp
          await prisma.chat.update({
            where: { id: group.id },
            data: { updatedAt: new Date() },
          });

          messagesPosted++;
          logger.debug(`NPC posted to group`, {
            npcId: randomNpc.id,
            npcName: randomNpc.displayName,
            chatId: group.id,
            chatName: group.name,
          }, 'NPCGroupDynamicsService');

        } catch (error) {
          logger.warn('Failed to generate NPC group message', {
            error,
            npcId: randomNpc.id,
            chatId: group.id,
          }, 'NPCGroupDynamicsService');
        }
      }
    } catch (error) {
      logger.error('Error posting group messages', { error }, 'NPCGroupDynamicsService');
    }

    return messagesPosted;
  }

  /**
   * Calculate "reply guy" score for a user based on their interactions with NPCs
   * 
   * Rewards quality engagement, penalizes spam behavior
   * 
   * Scoring:
   * - Follow: +5 points
   * - Comment: +3 points (ideal: 1-3 per week)
   * - Like: +1 point (ideal: 3-10 per week)
   * - Repost: +4 points (ideal: 1-2 per week)
   * 
   * Penalties for excessive engagement (spam behavior):
   * - Too many comments (>10/week): -2 per excess comment
   * - Too many likes (>30/week): -0.5 per excess like
   * - Too many reposts (>5/week): -3 per excess repost
   */
  private static async calculateReplyGuyScore(userId: string, npcIds: string[]): Promise<{
    score: number;
    breakdown: {
      follows: number;
      comments: number;
      likes: number;
      reposts: number;
      penalties: number;
      relationshipModifier: number;
      friendBoosts: number;
      enemyPenalties: number;
    };
  }> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    let score = 0;
    const breakdown = {
      follows: 0,
      comments: 0,
      likes: 0,
      reposts: 0,
      penalties: 0,
      relationshipModifier: 1.0,
      friendBoosts: 0,
      enemyPenalties: 0,
    };

    try {
      // 1. Check follows (all-time)
      const followCount = await prisma.follow.count({
        where: {
          followerId: userId,
          followingId: {
            in: npcIds,
          },
        },
      });
      breakdown.follows = followCount * 5;
      score += breakdown.follows;

      // 2. Count comments on NPC posts (last 7 days)
      const commentCount = await prisma.post.count({
        where: {
          authorId: userId,
          commentOnPostId: {
            not: null,
          },
          Post_Post_commentOnPostIdToPost: {
            authorId: {
              in: npcIds,
            },
          },
          createdAt: {
            gte: oneWeekAgo,
          },
        },
      });

      // Ideal: 1-3 comments per week
      if (commentCount >= 1 && commentCount <= 3) {
        breakdown.comments = commentCount * 3;
        score += breakdown.comments;
      } else if (commentCount > 3 && commentCount <= 10) {
        // Still okay, but diminishing returns
        breakdown.comments = commentCount * 2;
        score += breakdown.comments;
      } else if (commentCount > 10) {
        // Spam behavior - penalty
        const goodComments = 10 * 2; // First 10 get points
        const excessComments = commentCount - 10;
        const penalty = excessComments * -2;
        breakdown.comments = goodComments;
        breakdown.penalties += penalty;
        score += goodComments + penalty;
      }

      // 3. Count likes on NPC posts (last 7 days)
      const likeCount = await prisma.reaction.count({
        where: {
          userId: userId,
          type: 'like',
          Post: {
            authorId: {
              in: npcIds,
            },
          },
          createdAt: {
            gte: oneWeekAgo,
          },
        },
      });

      // Ideal: 3-10 likes per week
      if (likeCount >= 3 && likeCount <= 10) {
        breakdown.likes = likeCount * 1;
        score += breakdown.likes;
      } else if (likeCount > 10 && likeCount <= 30) {
        // Moderate engagement
        breakdown.likes = likeCount * 0.5;
        score += breakdown.likes;
      } else if (likeCount > 30) {
        // Excessive liking - penalty
        const goodLikes = 30 * 0.5;
        const excessLikes = likeCount - 30;
        const penalty = excessLikes * -0.5;
        breakdown.likes = goodLikes;
        breakdown.penalties += penalty;
        score += goodLikes + penalty;
      } else if (likeCount > 0 && likeCount < 3) {
        // Some engagement is better than none
        breakdown.likes = likeCount * 0.5;
        score += breakdown.likes;
      }

      // 4. Count reposts/shares of NPC posts (last 7 days)
      const repostCount = await prisma.share.count({
        where: {
          userId: userId,
          Post: {
            authorId: {
              in: npcIds,
            },
          },
          createdAt: {
            gte: oneWeekAgo,
          },
        },
      });

      // Ideal: 1-2 reposts per week
      if (repostCount >= 1 && repostCount <= 2) {
        breakdown.reposts = repostCount * 4;
        score += breakdown.reposts;
      } else if (repostCount > 2 && repostCount <= 5) {
        // Moderate reposting
        breakdown.reposts = repostCount * 2;
        score += breakdown.reposts;
      } else if (repostCount > 5) {
        // Excessive reposting - penalty
        const goodReposts = 5 * 2;
        const excessReposts = repostCount - 5;
        const penalty = excessReposts * -3;
        breakdown.reposts = goodReposts;
        breakdown.penalties += penalty;
        score += goodReposts + penalty;
      }

      // 5. Apply relationship modifier
      const relationshipModifier = await this.calculateRelationshipModifier(userId, npcIds);
      breakdown.relationshipModifier = relationshipModifier.modifier;
      breakdown.friendBoosts = relationshipModifier.friendBoosts;
      breakdown.enemyPenalties = relationshipModifier.enemyPenalties;
      
      // Apply the modifier to the final score
      score = score * relationshipModifier.modifier;

    } catch (error) {
      logger.warn('Error calculating reply guy score', { error, userId }, 'NPCGroupDynamicsService');
    }

    return { score, breakdown };
  }

  /**
   * Calculate relationship-based modifier for invite probability
   * 
   * If user engages with friends of the candidate NPC, boost invite chance slightly
   * If user engages with enemies of the candidate NPC, reduce invite chance
   * 
   * @param userId - The user being evaluated
   * @param targetNpcIds - The NPCs in the group (candidates for inviting)
   * @returns Modifier between 0.2x and 2.0x
   */
  private static async calculateRelationshipModifier(
    userId: string,
    targetNpcIds: string[]
  ): Promise<{
    modifier: number;
    friendBoosts: number;
    enemyPenalties: number;
  }> {
    let modifier = 1.0;
    let friendBoosts = 0;
    let enemyPenalties = 0;

    try {
      // Get all NPCs the user has engaged with (via UserInteraction table)
      const userInteractions = await prisma.userInteraction.findMany({
        where: {
          userId,
          timestamp: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        select: {
          npcId: true,
        },
        distinct: ['npcId'],
      });

      const userEngagedNpcIds = userInteractions.map(i => i.npcId);

      if (userEngagedNpcIds.length === 0) {
        return { modifier: 1.0, friendBoosts: 0, enemyPenalties: 0 };
      }

      // For each target NPC (in the group), check relationships with NPCs user engages with
      for (const targetNpcId of targetNpcIds) {
        const relationships = await prisma.actorRelationship.findMany({
          where: {
            OR: [
              {
                actor1Id: targetNpcId,
                actor2Id: { in: userEngagedNpcIds },
              },
              {
                actor2Id: targetNpcId,
                actor1Id: { in: userEngagedNpcIds },
              },
            ],
          },
        });

        for (const rel of relationships) {
          // Enemy relationship: reduce invite chance
          if (rel.sentiment < -0.3) {
            modifier *= 0.8; // 20% reduction per enemy
            enemyPenalties++;
            logger.debug('User engages with enemy NPC, reducing invite chance', {
              userId,
              targetNpcId,
              enemyNpcId: rel.actor1Id === targetNpcId ? rel.actor2Id : rel.actor1Id,
              sentiment: rel.sentiment,
              newModifier: modifier,
            }, 'NPCGroupDynamicsService');
          }
          // Friend relationship: boost invite chance slightly
          else if (rel.sentiment > 0.5) {
            modifier *= 1.1; // 10% boost per friend
            friendBoosts++;
            logger.debug('User engages with friend NPC, boosting invite chance', {
              userId,
              targetNpcId,
              friendNpcId: rel.actor1Id === targetNpcId ? rel.actor2Id : rel.actor1Id,
              sentiment: rel.sentiment,
              newModifier: modifier,
            }, 'NPCGroupDynamicsService');
          }
        }
      }

      // Cap the modifier between 0.2x (80% penalty max) and 2.0x (100% boost max)
      modifier = Math.max(0.2, Math.min(2.0, modifier));

    } catch (error) {
      logger.warn('Error calculating relationship modifier', { error, userId }, 'NPCGroupDynamicsService');
      return { modifier: 1.0, friendBoosts: 0, enemyPenalties: 0 };
    }

    return { modifier, friendBoosts, enemyPenalties };
  }

  /**
   * Invite users to NPC groups based on quality engagement
   * 
   * Users earn invitation chances by:
   * - Following NPCs
   * - Commenting thoughtfully (not spamming)
   * - Liking posts moderately
   * - Reposting occasionally
   * 
   * Excessive engagement (spam) reduces invitation likelihood
   */
  private static async inviteUsersToGroups(): Promise<number> {
    let usersInvited = 0;

    // Get groups with space for more members
    const groups = await prisma.chat.findMany({
      where: {
        isGroup: true,
      },
      include: {
        ChatParticipant: {
          select: {
            userId: true,
          },
        },
      },
    });

      for (const group of groups) {
        // Check if group has space
        if (group.ChatParticipant.length >= this.MAX_GROUP_SIZE) {
          continue;
        }

        // Random chance to invite
        if (Math.random() > this.INVITE_USER_CHANCE) {
          continue;
        }

        const currentMemberIds = new Set(group.ChatParticipant.map(p => p.userId));

        // Get NPCs in this group (for scoring user interactions)
        const npcMemberIds = await prisma.actor.findMany({
          where: {
            id: {
              in: Array.from(currentMemberIds),
            },
            hasPool: true,
          },
          select: {
            id: true,
          },
        });

        if (npcMemberIds.length === 0) {
          continue; // No NPCs in group
        }

        const npcIds = npcMemberIds.map(npc => npc.id);

        // Get active real users (not NPCs) who aren't in this group
        const potentialInvites = await prisma.user.findMany({
          where: {
            isActor: false,
            id: {
              notIn: Array.from(currentMemberIds),
            },
            // Only invite users with some activity (at least one share)
            Share: {
              some: {},
            },
          },
          take: 30, // Increased to allow for better scoring pool
        });

        if (potentialInvites.length === 0) {
          continue;
        }

        // Calculate "reply guy" scores for all candidates
        const scoredUsers = await Promise.all(
          potentialInvites.map(async (user) => {
            const { score, breakdown } = await this.calculateReplyGuyScore(user.id, npcIds);
            return {
              user,
              score,
              breakdown,
            };
          })
        );

        // Filter out users with negative scores (spammers)
        let eligibleUsers = scoredUsers.filter(su => su.score > 0);
        
        // Filter users at their group limit or in cooldown
        eligibleUsers = await this.filterUsersForInvite(eligibleUsers);

        if (eligibleUsers.length === 0) {
          continue;
        }

        // Sort by score descending (best reply guys first)
        eligibleUsers.sort((a, b) => b.score - a.score);

        // Pick from top 5 candidates with weighted randomness
        // Higher scores = higher chance to be selected
        const topCandidates = eligibleUsers.slice(0, 5);
        const totalScore = topCandidates.reduce((sum, c) => sum + c.score, 0);
        
        if (totalScore === 0) {
          continue;
        }

        // Weighted random selection
        if (topCandidates.length === 0) continue;
        let randomValue = Math.random() * totalScore;
        let selectedCandidate = topCandidates[0];
        
        for (const candidate of topCandidates) {
          randomValue -= candidate.score;
          if (randomValue <= 0) {
            selectedCandidate = candidate;
            break;
          }
        }

        if (!selectedCandidate) continue;

        // Get an NPC admin from the group to send the invite
        if (npcMemberIds.length === 0) continue;
        const invitingNpc = npcMemberIds[0];
        if (!invitingNpc) continue;

        // Get full NPC data for logging
        const npcData = await prisma.actor.findUnique({
          where: { id: invitingNpc.id },
          select: { name: true },
        });

        // Create the invitation - handle unique constraint (user may already be invited)
        try {
          await prisma.userGroupInvite.create({
            data: {
              id: await generateSnowflakeId(),
              groupId: group.id,
              invitedUserId: selectedCandidate.user.id,
              invitedBy: invitingNpc.id,
              status: 'pending',
              message: `Join our group chat "${group.name}"!`,
              invitedAt: new Date(),
            },
          });
          usersInvited++;
          logger.info(`User invited to NPC group (reply guy score)`, {
            userId: selectedCandidate.user.id,
            userName: selectedCandidate.user.displayName,
            chatId: group.id,
            chatName: group.name,
            invitedBy: npcData?.name,
            replyGuyScore: selectedCandidate.score,
            breakdown: selectedCandidate.breakdown,
          }, 'NPCGroupDynamicsService');
        } catch (error: unknown) {
          // Handle unique constraint violation - user already has an invite
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = error.meta?.target as string[] | undefined
            if (target?.includes('groupId') && target?.includes('invitedUserId')) {
              // User already has an invite, skip silently (this is expected in NPC dynamics)
              logger.debug(`User already has invite, skipping`, {
                userId: selectedCandidate.user.id,
                groupId: group.id,
              }, 'NPCGroupDynamicsService');
              continue;
            }
          }
          // Re-throw other errors
          throw error;
        }
      }

    return usersInvited;
  }

  /**
   * Filter users who are at their group limit or in invite cooldown
   * Prevents unlimited group chat accumulation
   */
  private static async filterUsersForInvite<T extends { user: { id: string }; score: number; breakdown: Record<string, number | string> }>(
    candidates: T[]
  ): Promise<T[]> {
    const filtered: T[] = [];
    
    for (const candidate of candidates) {
      // Check 1: Total active groups limit
      const activeGroupCount = await prisma.groupChatMembership.count({
        where: {
          userId: candidate.user.id,
          isActive: true,
        },
      });
      
      if (activeGroupCount >= this.MAX_ACTIVE_USER_GROUPS) {
        logger.debug('User at group limit, skipping invite', {
          userId: candidate.user.id,
          activeGroups: activeGroupCount,
          maxGroups: this.MAX_ACTIVE_USER_GROUPS,
        }, 'NPCGroupDynamicsService');
        continue;
      }
      
      // Check 2: Invite cooldown
      const latestMembership = await prisma.groupChatMembership.findFirst({
        where: {
          userId: candidate.user.id,
          isActive: true,
        },
        orderBy: {
          joinedAt: 'desc',
        },
      });
      
      if (latestMembership) {
        const hoursSinceJoin = (Date.now() - latestMembership.joinedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceJoin < this.INVITE_COOLDOWN_HOURS) {
          logger.debug('User in invite cooldown, skipping', {
            userId: candidate.user.id,
            hoursSinceJoin: hoursSinceJoin.toFixed(2),
            cooldownRequired: this.INVITE_COOLDOWN_HOURS,
          }, 'NPCGroupDynamicsService');
          continue;
        }
      }
      
      // User passed all checks
      filtered.push(candidate);
    }
    
    return filtered;
  }

  /**
   * Kick users with weighted randomness based on participation
   * 
   * Calculates kick probability based on:
   * - Never posted: 0.9 probability
   * - Low participation: 0.3-0.6 probability (based on message count)
   * - Dominating conversation: 0.3-0.9 probability (based on message ratio)
   */
  private static async kickUsersWithWeightedLogic(): Promise<number> {
    let usersKicked = 0;

    // Only check for kicks some of the time
    if (Math.random() > this.KICK_CHECK_CHANCE) {
      return 0;
    }

    // Get all group chats
    const groups = await prisma.chat.findMany({
      where: {
        isGroup: true,
      },
      include: {
        ChatParticipant: true,
        Message: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
          select: {
            senderId: true,
          },
        },
      },
    });

      for (const group of groups) {
        // Get user details for participants
        const participantUserIds = group.ChatParticipant.map(p => p.userId);
        const participantUsers = await prisma.user.findMany({
          where: { 
            id: { in: participantUserIds },
            isActor: false, // Only consider real users for kicking
          },
          select: { id: true, displayName: true, isActor: true },
        });
        
        if (participantUsers.length === 0) continue;

        // Calculate message counts for all users in the group
        const totalMessages = group.Message.length;
        const messageCounts = new Map<string, number>();
        
        for (const msg of group.Message) {
          messageCounts.set(msg.senderId, (messageCounts.get(msg.senderId) || 0) + 1);
        }

        // Calculate kick probabilities for each user
        for (const participant of participantUsers) {
          const userId = participant.id;
          const userMessageCount = messageCounts.get(userId) || 0;
          
          let kickProbability = 0;
          let reason = '';

          // Case 1: Never posted
          if (userMessageCount === 0) {
            kickProbability = 0.90; // Very high chance
            reason = 'Never participated in conversation';
          }
          // Case 2: Low participation (only if group has significant activity)
          else if (userMessageCount < 3 && totalMessages > 20) {
            // Scale from 0.3 to 0.6 based on how few messages
            kickProbability = 0.6 - (userMessageCount / 3) * 0.3;
            reason = `Low participation (${userMessageCount} messages in last 7 days)`;
          }
          // Case 3: Dominating conversation (only if group has enough messages to judge)
          else if (totalMessages > 10) {
            const userRatio = userMessageCount / totalMessages;
            
            // If user has more than 40% of all messages, consider it dominating
            if (userRatio > 0.4) {
              // Scale from 0.3 to 0.9 as ratio increases from 0.4 to 1.0
              kickProbability = 0.3 + (userRatio - 0.4) / 0.6 * 0.6;
              reason = `Dominating conversation (${Math.round(userRatio * 100)}% of messages)`;
            }
            // Otherwise, user has good participation (3+ messages, <= 40% of total)
            // kickProbability remains 0 - this is the safe zone!
          }
          // Case 4: Mid participation in smaller groups
          else {
            // If we get here: userMessageCount >= 3 OR totalMessages <= 20
            // These are users with reasonable participation - kickProbability stays 0
          }

          // Apply the probability (make kicks rare per tick)
          if (kickProbability > 0 && Math.random() < kickProbability * 0.05) { // 5% multiplier to make it rare per tick
            // Remove from chat participants
            await prisma.chatParticipant.deleteMany({
              where: {
                chatId: group.id,
                userId: userId,
              },
            });

            // If GroupChatMembership exists, mark as removed
            await prisma.groupChatMembership.updateMany({
              where: {
                chatId: group.id,
                userId: userId,
              },
              data: {
                isActive: false,
                removedAt: new Date(),
                sweepReason: reason,
              },
            });

            usersKicked++;
            logger.info(`User kicked from group with weighted logic`, {
              userId,
              userName: participant.displayName,
              chatId: group.id,
              chatName: group.name,
              reason,
              kickProbability: kickProbability.toFixed(2),
              messageCount: userMessageCount,
              totalMessages,
            }, 'NPCGroupDynamicsService');
          }
        }
      }

    return usersKicked;
  }

  /**
   * Get group dynamics statistics
   */
  static async getGroupStats(): Promise<{
    totalGroups: number;
    activeGroups: number;
    totalMembers: number;
    avgGroupSize: number;
  }> {
    const [totalGroups, groups] = await Promise.all([
      prisma.chat.count({
        where: { isGroup: true },
      }),
      prisma.chat.findMany({
        where: { isGroup: true },
        include: {
          ChatParticipant: true,
        },
      }),
    ]);

    const activeGroups = groups.filter(g => g.ChatParticipant.length >= this.MIN_GROUP_SIZE).length;
    const totalMembers = groups.reduce((sum, g) => sum + g.ChatParticipant.length, 0);
    const avgGroupSize = groups.length > 0 ? totalMembers / groups.length : 0;

    return {
      totalGroups,
      activeGroups,
      totalMembers,
      avgGroupSize,
    };
  }
}

