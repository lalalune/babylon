/**
 * Market Context Service
 * 
 * Builds complete market context for NPCs to make trading decisions.
 * Gathers: feed posts, group chats, events, market data, current positions.
 * 
 * Token-aware: Limits context size to prevent LLM token overflows
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
// import { truncateToTokenLimitSync, countTokensSync } from '@/lib/token-counter';
import type {
  NPCMarketContext,
  MarketSnapshots,
  PerpMarketSnapshot,
  PredictionMarketSnapshot,
  NPCPosition,
  FeedPostContext,
  GroupChatContext,
  EventContext,
  RelationshipContext,
} from '@/types/market-context';

export class MarketContextService {
  /**
   * Build market context for all NPCs in the system
   * Optimized to minimize database queries
   */
  async buildContextForAllNPCs(): Promise<Map<string, NPCMarketContext>> {
    const startTime = Date.now();
    
    // Fetch all NPCs (no pool requirement)
    // Note: All records in Actor table are NPCs
    // Filter out test actors (Group Test Alice, Bob, Charlie)
    const npcs = (await prisma.actor.findMany()).filter(
      actor => !actor.name.includes('Group Test')
    );
    
    // Fetch shared data once (used by all NPCs)
    const [marketSnapshots, recentPosts, recentEvents] = await Promise.all([
      this.getMarketSnapshots(),
      this.getRecentFeed(),
      this.getRecentEvents(),
    ]);
    
    // Get group chat memberships for all NPCs
    const groupChats = await prisma.chat.findMany({
      where: { isGroup: true },
      include: {
        Message: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    
    // Fetch all relationships for all NPCs in one query
    const allRelationships = await prisma.actorRelationship.findMany({
      where: {
        OR: npcs.flatMap(npc => [
          { actor1Id: npc.id },
          { actor2Id: npc.id },
        ]),
      },
    });
    
    // Build context for each NPC
    const contexts = new Map<string, NPCMarketContext>();
    
    for (const npc of npcs) {
      // Use actor's trading balance (no pools)
      const availableBalance = parseFloat(npc.tradingBalance.toString());
      
      // Filter group chats this NPC is a member of (based on chat participants)
      const npcGroupChats = groupChats.filter(chat =>
        chat.Message.some(msg => msg.senderId === npc.id) ||
        chat.name?.toLowerCase().includes((npc.name.toLowerCase().split(' ')[0] ?? ''))
      );
      
      const groupChatMessages: GroupChatContext[] = npcGroupChats.flatMap(chat => 
        chat.Message.map(msg => ({
          chatId: chat.id,
          chatName: chat.name || 'Group Chat',
          from: msg.senderId,
          fromName: msg.senderId,
          message: msg.content,
          timestamp: msg.createdAt.toISOString(),
        }))
      );
      
      // No pool positions (pools feature removed)
      const currentPositions: NPCPosition[] = [];
      
      // Get relationships for this NPC
      const npcRelationships = allRelationships
        .filter(rel => rel.actor1Id === npc.id || rel.actor2Id === npc.id)
        .map(rel => {
          const isActor1 = rel.actor1Id === npc.id;
          const otherActorId = isActor1 ? rel.actor2Id : rel.actor1Id;
          
          return {
            actorId: otherActorId,
            actorName: otherActorId,
            relationshipType: rel.relationshipType,
            sentiment: rel.sentiment || 0,
            strength: rel.strength || 0.5,
            history: rel.history || undefined,
          };
        });
      
      contexts.set(npc.id, {
        npcId: npc.id,
        npcName: npc.name,
        personality: npc.personality || 'neutral trader',
        tier: npc.tier || 'B_TIER',
        availableBalance,
        relationships: npcRelationships,
        recentPosts,
        groupChatMessages,
        recentEvents,
        perpMarkets: marketSnapshots.perps,
        predictionMarkets: marketSnapshots.predictions,
        currentPositions,
      });
    }
    
    const duration = Date.now() - startTime;
    logger.info(`Built market context for ${contexts.size} NPCs in ${duration}ms`, {
      npcCount: contexts.size,
      durationMs: duration,
    }, 'MarketContextService');
    
    return contexts;
  }
  
  /**
   * Build context for a specific NPC with relationship data
   */
  async buildContextForNPC(npcId: string): Promise<NPCMarketContext> {
    const npc = await prisma.actor.findUnique({
      where: { id: npcId },
    });
    
    if (!npc) {
      throw new Error(`NPC not found: ${npcId}`);
    }
    
    const [marketSnapshots, recentPosts, recentEvents, groupChatMessages] = await Promise.all([
      this.getMarketSnapshots(),
      this.getRecentFeed(),
      this.getRecentEvents(),
      this.getInsiderInfo(npcId),
    ]);
    
    // Get relationships for this NPC
    const relationships = await this.getRelationshipsForNPC(npcId);
    
    // Use actor's trading balance (no pools)
    const availableBalance = parseFloat(npc.tradingBalance.toString());
    
    // No pool positions (pools feature removed)
    const currentPositions: NPCPosition[] = [];
    
    return {
      npcId: npc.id,
      npcName: npc.name,
      personality: npc.personality || 'neutral trader',
      tier: npc.tier || 'B_TIER',
      availableBalance,
      relationships,
      recentPosts,
      groupChatMessages,
      recentEvents,
      perpMarkets: marketSnapshots.perps,
      predictionMarkets: marketSnapshots.predictions,
      currentPositions,
    };
  }

  /**
   * Get relationships for an NPC (all relationships, not just event-related)
   */
  private async getRelationshipsForNPC(npcId: string): Promise<RelationshipContext[]> {
    const relationships = await prisma.actorRelationship.findMany({
      where: {
        OR: [
          { actor1Id: npcId },
          { actor2Id: npcId },
        ],
      },
    });
    
    return relationships.map(rel => {
      const isActor1 = rel.actor1Id === npcId;
      const otherActorId = isActor1 ? rel.actor2Id : rel.actor1Id;
      
      return {
        actorId: otherActorId,
        actorName: otherActorId,
        relationshipType: rel.relationshipType,
        sentiment: rel.sentiment || 0,
        strength: rel.strength || 0.5,
        history: rel.history || undefined,
      };
    });
  }

  
  /**
   * Get insider information from group chats this NPC is in (token-limited)
   */
  private async getInsiderInfo(npcId: string): Promise<GroupChatContext[]> {
    const groupChats = await prisma.chat.findMany({
      where: {
        isGroup: true,
      },
      include: {
        Message: {
          orderBy: { createdAt: 'desc' },
          take: 20, // Reduced from 50 to limit tokens
        },
        ChatParticipant: {
          select: {
            userId: true,
          },
        },
      },
    });
    
    // Filter chats where this NPC is a member
    const npcChats = groupChats.filter(chat =>
      chat.ChatParticipant.some(p => p.userId === npcId)
    );
    
    return npcChats.flatMap(chat =>
      chat.Message.slice(0, 15).map(msg => { // Limit to 15 messages per chat
        // Truncate long messages
        const maxMsgLength = 120;
        const message = msg.content.length > maxMsgLength
          ? msg.content.slice(0, maxMsgLength) + '...'
          : msg.content;
        
        return {
          chatId: chat.id,
          chatName: chat.name || 'Group Chat',
          from: msg.senderId,
          fromName: msg.senderId,
          message,
          timestamp: msg.createdAt.toISOString(),
        };
      })
    );
  }
  
  /**
   * Get recent feed posts (token-limited)
   */
  private async getRecentFeed(): Promise<FeedPostContext[]> {
    const posts = await prisma.post.findMany({
      where: {
        deletedAt: null, // Filter out deleted posts
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Reduced from 100 to limit tokens
    });
    
    return posts.map(post => {
      // Truncate long posts to save tokens
      const maxContentLength = 200;
      const content = post.content.length > maxContentLength
        ? post.content.slice(0, maxContentLength) + '...'
        : post.content;
      
      const maxTitleLength = 80;
      const articleTitle = post.articleTitle && post.articleTitle.length > maxTitleLength
        ? post.articleTitle.slice(0, maxTitleLength) + '...'
        : post.articleTitle;
      
      return {
        author: post.authorId,
        authorName: post.authorId,
        content,
        timestamp: post.createdAt.toISOString(),
        articleTitle: articleTitle || undefined,
      };
    });
  }
  
  /**
   * Get recent events with actor involvement (token-limited)
   */
  private async getRecentEvents(): Promise<EventContext[]> {
    const events = await prisma.worldEvent.findMany({
      orderBy: { timestamp: 'desc' },
      take: 30, // Reduced from 50 to limit tokens
    });
    
    return events.map(event => {
      // Truncate long descriptions
      const maxDescLength = 150;
      const description = event.description.length > maxDescLength
        ? event.description.slice(0, maxDescLength) + '...'
        : event.description;
      
      return {
        type: event.eventType,
        description,
        actors: event.actors as string[] | undefined,
        timestamp: event.timestamp.toISOString(),
        relatedQuestion: event.relatedQuestion || undefined,
        pointsToward: event.pointsToward || undefined,
      };
    });
  }
  
  /**
   * Get current market snapshots
   */
  private async getMarketSnapshots(): Promise<MarketSnapshots> {
    const [perps, predictions] = await Promise.all([
      this.getPerpMarketSnapshots(),
      this.getPredictionMarketSnapshots(),
    ]);
    
    return {
      perps,
      predictions,
      timestamp: new Date().toISOString(),
    };
  }
  
  /**
   * Get perpetual market snapshots
   */
  private async getPerpMarketSnapshots(): Promise<PerpMarketSnapshot[]> {
    const companies = await prisma.organization.findMany({
      where: {
        type: 'company',
        currentPrice: { not: null },
      },
    });
    
    return Promise.all(
      companies.map(async (company) => {
        const currentPrice = company.currentPrice || company.initialPrice || 100;
        
        // Get 24h price history
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const priceHistory = await prisma.stockPrice.findMany({
          where: {
            organizationId: company.id,
            timestamp: { gte: oneDayAgo },
          },
          orderBy: { timestamp: 'asc' },
        });
        
        let change24h = 0;
        let changePercent24h = 0;
        let high24h = currentPrice;
        let low24h = currentPrice;
        
        if (priceHistory.length > 0) {
          const oldestPrice = priceHistory[0]!.price;
          change24h = currentPrice - oldestPrice;
          changePercent24h = (change24h / oldestPrice) * 100;
          
          high24h = Math.max(...priceHistory.map(p => p.price), currentPrice);
          low24h = Math.min(...priceHistory.map(p => p.price), currentPrice);
        }
        
        // Get open interest from pool positions
        // Use raw org ID since TradeExecutionService now stores raw IDs
        const positions = await prisma.poolPosition.findMany({
          where: {
            ticker: company.id,
            closedAt: null,
          },
        });
        
        const openInterest = positions.reduce((sum, pos) => sum + pos.size, 0);
        const volume24h = positions.reduce((sum, pos) => sum + pos.size, 0);
        
        // Provide raw org ID as ticker so LLM uses the correct format
        return {
          ticker: company.id,
          organizationId: company.id,
          name: company.name || 'Unknown',
          currentPrice,
          change24h,
          changePercent24h,
          high24h,
          low24h,
          volume24h,
          openInterest,
        };
      })
    );
  }
  
  /**
   * Get prediction market snapshots (token-limited)
   */
  private async getPredictionMarketSnapshots(): Promise<PredictionMarketSnapshot[]> {
    const markets = await prisma.market.findMany({
      where: {
        resolved: false,
        endDate: { gte: new Date() },
      },
      orderBy: [
        { yesShares: 'desc' }, // Prioritize markets with more activity
      ],
      take: 15, // Limit to top 15 most active markets
    });
    
    return markets.map(market => {
      const yesShares = parseFloat(market.yesShares.toString());
      const noShares = parseFloat(market.noShares.toString());
      const totalShares = yesShares + noShares;
      
      const yesPrice = totalShares > 0 ? (yesShares / totalShares) * 100 : 50;
      const noPrice = totalShares > 0 ? (noShares / totalShares) * 100 : 50;
      const totalVolume = totalShares * 0.5;
      
      const now = new Date();
      const resolutionDate = market.endDate.toISOString();
      const daysUntilResolution = Math.max(
        0,
        Math.ceil((market.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      
      // Truncate long question text
      const maxQuestionLength = 120;
      const text = market.question.length > maxQuestionLength
        ? market.question.slice(0, maxQuestionLength) + '...'
        : market.question;
      
      return {
        id: market.id, // Keep as Snowflake string
        text,
        yesPrice,
        noPrice,
        totalVolume,
        resolutionDate,
        daysUntilResolution,
      };
    });
  }
  
}

