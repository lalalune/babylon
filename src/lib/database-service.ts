/**
 * Database Service
 * 
 * Wrapper for all database operations.
 * Handles posts, questions, organizations, stock prices, events, actors.
 * 
 * Usage:
 *   import db from '@/lib/database-service'
 *   await db().createPost({...})
 *   const posts = await db().getRecentPosts(100)
 */

import type { FeedPost, Question as GameQuestion, Question, Organization, Actor } from '@/shared/types';
import { logger } from './logger';
import { prisma } from './prisma';
import { generateTagsForPosts } from './services/tag-generation-service';
import { storeTagsForPost } from './services/tag-storage-service';
import { generateSnowflakeId } from './snowflake';

class DatabaseService {
  // Expose prisma for direct queries - use getter to avoid issues if prisma isn't initialized
  get prisma() {
    return prisma;
  }
  /**
   * Initialize game state in database
   */
  async initializeGame() {
    // Check if game already exists
    const existing = await prisma.game.findFirst({
      where: { isContinuous: true },
    });

    if (existing) {
      logger.info(`Game already initialized (${existing.id})`, undefined, 'DatabaseService');
      return existing;
    }

    // Create new game
    const game = await prisma.game.create({
      data: {
        id: await generateSnowflakeId(),
        isContinuous: true,
        isRunning: true,
        currentDate: new Date(),
        speed: 60000, // 1 minute ticks
        updatedAt: new Date(),
      },
    });

    logger.info(`Game initialized (${game.id})`, undefined, 'DatabaseService');
    return game;
  }

  /**
   * Get current game state
   */
  async getGameState() {
    return await prisma.game.findFirst({
      where: { isContinuous: true },
    });
  }

  /**
   * Update game state (currentDay, currentDate, lastTickAt, etc.)
   */
  async updateGameState(data: {
    currentDay?: number;
    currentDate?: Date;
    lastTickAt?: Date;
    lastSnapshotAt?: Date;
    activeQuestions?: number;
  }) {
    const game = await this.getGameState();
    if (!game) throw new Error('Game not initialized');

    return await prisma.game.update({
      where: { id: game.id },
      data,
    });
  }

  // ========== POSTS ==========

  /**
   * Create a new post
   */
  async createPost(post: FeedPost & { gameId?: string; dayNumber?: number }) {
    const created = await prisma.post.create({
      data: {
        id: post.id,
        content: post.content,
        authorId: post.author,
        gameId: post.gameId,
        dayNumber: post.dayNumber,
        timestamp: new Date(post.timestamp),
      },
    });

    void this.tagPostAsync(post.id, post.content);

    return created;
  }

  /**
   * Tag a post asynchronously (fire-and-forget)
   */
  private async tagPostAsync(postId: string, content: string): Promise<void> {
    const tagMap = await generateTagsForPosts([{ id: postId, content }]);
    const tags = tagMap.get(postId);
    if (tags && tags.length > 0) {
      await storeTagsForPost(postId, tags);
    }
  }

  /**
   * Create a post with all fields (including article fields) and auto-tag it
   * Used by serverless game tick
   */
  async createPostWithAllFields(data: {
    id: string;
    type?: string;
    content: string;
    fullContent?: string;
    articleTitle?: string;
    byline?: string;
    biasScore?: number;
    sentiment?: string;
    slant?: string;
    category?: string;
    authorId: string;
    gameId?: string;
    dayNumber?: number;
    timestamp: Date;
  }) {
    // Validate dayNumber to prevent INT4 overflow
    const safeDayNumber = typeof data.dayNumber === 'number' && 
      Number.isFinite(data.dayNumber) && 
      data.dayNumber >= 0 && 
      data.dayNumber <= 2147483647 
      ? data.dayNumber 
      : undefined;

    if (data.dayNumber !== undefined && safeDayNumber === undefined) {
      logger.warn('[Post] Invalid dayNumber value', { dayNumber: data.dayNumber, postId: data.id }, 'database-service');
    }

    const created = await prisma.post.create({
      data: {
        id: data.id,
        type: data.type || 'post',
        content: data.content,
        fullContent: data.fullContent,
        articleTitle: data.articleTitle,
        byline: data.byline,
        biasScore: data.biasScore,
        sentiment: data.sentiment,
        slant: data.slant,
        category: data.category,
        authorId: data.authorId,
        gameId: data.gameId,
        dayNumber: safeDayNumber,
        timestamp: data.timestamp,
      },
    });

    void this.tagPostAsync(data.id, data.content);

    return created;
  }

  /**
   * Create multiple posts in batch
   */
  async createManyPosts(posts: Array<FeedPost & { gameId?: string; dayNumber?: number }>) {
    const result = await prisma.post.createMany({
      data: posts.map(post => {
        // Validate dayNumber to prevent INT4 overflow
        const safeDayNumber = typeof post.dayNumber === 'number' && 
          Number.isFinite(post.dayNumber) && 
          post.dayNumber >= 0 && 
          post.dayNumber <= 2147483647 
          ? post.dayNumber 
          : undefined;

        if (post.dayNumber !== undefined && safeDayNumber === undefined) {
          logger.warn('[Post] Invalid dayNumber value', { dayNumber: post.dayNumber, postId: post.id }, 'database-service');
        }

        return {
          id: post.id,
          content: post.content,
          authorId: post.author,
          gameId: post.gameId,
          dayNumber: safeDayNumber,
          timestamp: new Date(post.timestamp),
        };
      }),
      skipDuplicates: true,
    });

    if (posts.length > 0) {
      const postsForTagging = posts.map(p => ({
        id: p.id,
        content: p.content,
      }));

      const tagMap = await generateTagsForPosts(postsForTagging);

      await Promise.all(
        Array.from(tagMap.entries()).map(async ([postId, tags]) => {
          if (tags.length > 0) {
            await storeTagsForPost(postId, tags);
          }
        })
      );
    }

    return result;
  }

  /**
   * Get recent posts with cursor-based or offset-based pagination
   * Note: Not cached as this is real-time data that updates frequently
   * Filters out posts from test users (isTest = true)
   * 
   * @param limit - Number of posts to fetch
   * @param cursorOrOffset - Cursor (ISO string) for cursor-based pagination, or offset (number) for legacy offset pagination
   */
  async getRecentPosts(limit = 100, cursorOrOffset?: string | number) {
    const isCursor = typeof cursorOrOffset === 'string';
    const cursor = isCursor ? cursorOrOffset : undefined;
    const offset = !isCursor && typeof cursorOrOffset === 'number' ? cursorOrOffset : 0;
    
    logger.debug('DatabaseService.getRecentPosts called', { limit, cursor, offset }, 'DatabaseService');
    
    // Build where clause with cursor or use offset
    const where: {
      deletedAt: null;
      timestamp?: { lt: Date };
    } = {
      deletedAt: null,
    };
    
    if (cursor) {
      where.timestamp = { lt: new Date(cursor) };
    }
    
    // Get posts with author information to filter out test users
    // We need to check both User and Actor tables since authorId can reference either
    const allPosts = await prisma.post.findMany({
      where,
      take: limit * 2, // Fetch more than needed to account for filtering
      skip: cursor ? 0 : offset, // Only use skip if using offset pagination
      orderBy: { timestamp: 'desc' },
    });
    
    // Get all author IDs
    const authorIds = [...new Set(allPosts.map(p => p.authorId))];
    
    // Check which authors are test users
    const [testUsers, testActors] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: authorIds }, isTest: true },
        select: { id: true },
      }),
      prisma.actor.findMany({
        where: { id: { in: authorIds }, isTest: true },
        select: { id: true },
      }),
    ]);
    
    const testAuthorIds = new Set([
      ...testUsers.map(u => u.id),
      ...testActors.map(a => a.id),
    ]);
    
    // Filter out posts from test users
    const posts = allPosts
      .filter(post => !testAuthorIds.has(post.authorId))
      .slice(0, limit); // Take only the requested limit after filtering
    
    logger.info('DatabaseService.getRecentPosts completed', {
      limit,
      cursor,
      offset,
      postCount: posts.length,
      filteredTestPosts: allPosts.length - posts.length,
      firstPostId: posts[0]?.id,
      lastPostId: posts[posts.length - 1]?.id,
    }, 'DatabaseService');
    
    return posts;
  }

  /**
   * Get posts by actor with cursor-based or offset-based pagination
   * Filters out posts if the actor is a test user
   * 
   * @param authorId - Author ID (user or actor)
   * @param limit - Number of posts to fetch
   * @param cursorOrOffset - Cursor (ISO string) for cursor-based pagination, or offset (number) for legacy offset pagination
   */
  async getPostsByActor(authorId: string, limit = 100, cursorOrOffset?: string | number) {
    const isCursor = typeof cursorOrOffset === 'string';
    const cursor = isCursor ? cursorOrOffset : undefined;
    const offset = !isCursor && typeof cursorOrOffset === 'number' ? cursorOrOffset : 0;
    
    logger.debug('DatabaseService.getPostsByActor called', { authorId, limit, cursor, offset }, 'DatabaseService');
    
    // Check if this actor/user is a test user
    const [user, actor] = await Promise.all([
      prisma.user.findUnique({
        where: { id: authorId },
        select: { isTest: true },
      }),
      prisma.actor.findUnique({
        where: { id: authorId },
        select: { isTest: true },
      }),
    ]);
    
    const isTestUser = user?.isTest || actor?.isTest || false;
    
    // If it's a test user, return empty array
    if (isTestUser) {
      logger.info('DatabaseService.getPostsByActor - test user filtered', {
        authorId,
        isTestUser: true,
      }, 'DatabaseService');
      return [];
    }
    
    // Build where clause with cursor or use offset
    const where: {
      authorId: string;
      deletedAt: null;
      timestamp?: { lt: Date };
    } = {
      authorId,
      deletedAt: null,
    };
    
    if (cursor) {
      where.timestamp = { lt: new Date(cursor) };
    }
    
    const posts = await prisma.post.findMany({
      where,
      take: limit,
      skip: cursor ? 0 : offset, // Only use skip if using offset pagination
      orderBy: { timestamp: 'desc' },
    });
    
    logger.info('DatabaseService.getPostsByActor completed', {
      authorId,
      limit,
      cursor,
      offset,
      postCount: posts.length,
    }, 'DatabaseService');
    
    return posts;
  }

  /**
   * Get total post count
   */
  async getTotalPosts() {
    return await prisma.post.count();
  }

  // ========== QUESTIONS ==========

  /**
   * Create a question
   */
  async createQuestion(question: GameQuestion & { questionNumber: number }) {
    return await prisma.question.create({
      data: {
        id: await generateSnowflakeId(),
        questionNumber: question.questionNumber,
        text: question.text,
        scenarioId: question.scenario,
        outcome: question.outcome,
        rank: question.rank,
        createdDate: new Date(question.createdDate || new Date()),
        resolutionDate: new Date(question.resolutionDate!),
        status: question.status || 'active',
        resolvedOutcome: question.resolvedOutcome,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Convert Prisma Question to TypeScript Question
   */
  private adaptQuestion(prismaQuestion: {
    id: string;
    questionNumber: number;
    text: string;
    scenarioId: number;
    outcome: boolean;
    rank: number;
    createdDate: Date;
    resolutionDate: Date;
    status: string;
    resolvedOutcome: boolean | null;
  }): Question {
    return {
      id: prismaQuestion.id,
      questionNumber: prismaQuestion.questionNumber,
      text: prismaQuestion.text,
      scenario: prismaQuestion.scenarioId,
      scenarioId: prismaQuestion.scenarioId,
      outcome: prismaQuestion.outcome,
      rank: prismaQuestion.rank,
      createdDate: prismaQuestion.createdDate.toISOString(),
      resolutionDate: prismaQuestion.resolutionDate.toISOString(),
      status: prismaQuestion.status as 'active' | 'resolved' | 'cancelled',
      resolvedOutcome: prismaQuestion.resolvedOutcome ?? undefined,
      timeframe: this.calculateTimeframe(prismaQuestion.resolutionDate),
      createdAt: prismaQuestion.createdDate,
      updatedAt: prismaQuestion.createdDate, // Prisma model has updatedAt but we use createdDate for now
    };
  }

  /**
   * Calculate timeframe category from resolution date
   */
  private calculateTimeframe(resolutionDate: Date): string {
    const now = new Date();
    const msUntilResolution = resolutionDate.getTime() - now.getTime();
    const daysUntilResolution = Math.ceil(msUntilResolution / (1000 * 60 * 60 * 24));
    
    if (daysUntilResolution <= 1) return '24h';
    if (daysUntilResolution <= 7) return '7d';
    if (daysUntilResolution <= 30) return '30d';
    return '30d+';
  }

  /**
   * Get active questions
   * @param timeframe - Optional timeframe filter ('24h', '7d', '30d', '30d+')
   */
  async getActiveQuestions(timeframe?: string): Promise<Question[]> {
    const whereClause: { status: string; resolutionDate?: { gte?: Date; lte?: Date } } = { 
      status: 'active' 
    };
    
    // Filter by timeframe if provided
    // Timeframe filters questions by when they resolve (resolutionDate)
    if (timeframe) {
      const now = new Date();
      let endDate: Date | undefined;
      
      switch (timeframe) {
        case '24h':
          // Questions resolving within 24 hours
          endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          whereClause.resolutionDate = { gte: now, lte: endDate };
          break;
        case '7d':
          // Questions resolving within 7 days
          endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          whereClause.resolutionDate = { gte: now, lte: endDate };
          break;
        case '30d':
          // Questions resolving within 30 days
          endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          whereClause.resolutionDate = { gte: now, lte: endDate };
          break;
        case '30d+':
          // Questions resolving after 30 days
          const startDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          whereClause.resolutionDate = { gte: startDate };
          break;
      }
    }
    
    const questions = await prisma.question.findMany({
      where: whereClause,
      orderBy: { createdDate: 'desc' },
    });
    return questions.map(q => this.adaptQuestion(q));
  }

  /**
   * Get questions to resolve (resolutionDate <= now)
   */
  async getQuestionsToResolve(): Promise<Question[]> {
    const questions = await prisma.question.findMany({
      where: {
        status: 'active',
        resolutionDate: {
          lte: new Date(),
        },
      },
    });
    return questions.map(q => this.adaptQuestion(q));
  }

  /**
   * Get all questions (active and resolved)
   */
  async getAllQuestions(): Promise<Question[]> {
    const questions = await prisma.question.findMany({
      orderBy: { createdDate: 'desc' },
    });
    return questions.map(q => this.adaptQuestion(q));
  }

  /**
   * Resolve a question
   */
  async resolveQuestion(id: string, resolvedOutcome: boolean) {
    return await prisma.question.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedOutcome,
      },
    });
  }

  // ========== ORGANIZATIONS ==========

  /**
   * Upsert organization (create or update)
   */
  async upsertOrganization(org: Organization) {
    return await prisma.organization.upsert({
      where: { id: org.id },
      create: {
        id: org.id,
        name: org.name,
        description: org.description,
        type: org.type,
        canBeInvolved: org.canBeInvolved,
        initialPrice: org.initialPrice,
        currentPrice: org.currentPrice || org.initialPrice,
        updatedAt: new Date(),
      },
      update: {
        currentPrice: org.currentPrice || org.initialPrice,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Update organization price
   */
  async updateOrganizationPrice(id: string, price: number) {
    return await prisma.organization.update({
      where: { id },
      data: { currentPrice: price },
    });
  }

  /**
   * Get all companies (with prices)
   */
  async getCompanies() {
    return await prisma.organization.findMany({
      where: { type: 'company' },
      orderBy: { currentPrice: 'desc' },
    });
  }

  /**
   * Convert Prisma Organization to TypeScript Organization
   */
  private adaptOrganization(prismaOrg: {
    id: string;
    name: string;
    description: string;
    type: string;
    canBeInvolved: boolean;
    initialPrice: number | null;
    currentPrice: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): Organization {
    return {
      id: prismaOrg.id,
      name: prismaOrg.name,
      description: prismaOrg.description,
      type: prismaOrg.type as Organization['type'],
      canBeInvolved: prismaOrg.canBeInvolved,
      initialPrice: prismaOrg.initialPrice ?? undefined,
      currentPrice: prismaOrg.currentPrice ?? undefined,
    };
  }

  /**
   * Get all organizations
   */
  async getAllOrganizations(): Promise<Organization[]> {
    const orgs = await prisma.organization.findMany();
    return orgs.map(o => this.adaptOrganization(o));
  }

  // ========== STOCK PRICES ==========

  /**
   * Record a price update
   */
  async recordPriceUpdate(organizationId: string, price: number, change: number, changePercent: number) {
    return await prisma.stockPrice.create({
      data: {
        id: await generateSnowflakeId(),
        organizationId,
        price,
        change,
        changePercent,
        timestamp: new Date(),
        isSnapshot: false,
      },
    });
  }

  /**
   * Record daily snapshot (EOD prices)
   */
  async recordDailySnapshot(
    organizationId: string,
    data: {
      openPrice: number;
      highPrice: number;
      lowPrice: number;
      closePrice: number;
      volume: number;
    }
  ) {
    return await prisma.stockPrice.create({
      data: {
        id: await generateSnowflakeId(),
        organizationId,
        price: data.closePrice,
        change: data.closePrice - data.openPrice,
        changePercent: ((data.closePrice - data.openPrice) / data.openPrice) * 100,
        timestamp: new Date(),
        isSnapshot: true,
        openPrice: data.openPrice,
        highPrice: data.highPrice,
        lowPrice: data.lowPrice,
        volume: data.volume,
      },
    });
  }

  /**
   * Get price history for a company
   */
  async getPriceHistory(organizationId: string, limit = 1440) {
    return await prisma.stockPrice.findMany({
      where: { organizationId },
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get daily snapshots only
   */
  async getDailySnapshots(organizationId: string, days = 30) {
    return await prisma.stockPrice.findMany({
      where: {
        organizationId,
        isSnapshot: true,
      },
      take: days,
      orderBy: { timestamp: 'desc' },
    });
  }

  // ========== EVENTS ==========

  /**
   * Create a world event
   */
  async createEvent(event: {
    id: string;
    eventType: string;
    description: string | { title?: string; text?: string; timestamp?: string; source?: string };
    actors: string[];
    relatedQuestion?: number;
    pointsToward?: string;
    visibility: string;
    gameId?: string;
    dayNumber?: number;
  }) {
    // Convert description to string if it's an object
    let descriptionString: string;
    if (typeof event.description === 'string') {
      descriptionString = event.description;
    } else if (event.description && typeof event.description === 'object') {
      // Handle object description - use text or title, or stringify
      descriptionString = event.description.text || event.description.title || JSON.stringify(event.description);
    } else {
      descriptionString = String(event.description || '');
    }

    // Validate integer fields to prevent Snowflake ID insertion
    // Log warning if value exceeds INT4 range
    if (event.relatedQuestion !== undefined && 
        (typeof event.relatedQuestion !== 'number' || 
         !Number.isFinite(event.relatedQuestion) || 
         event.relatedQuestion < 0 || 
         event.relatedQuestion > 2147483647)) {
      logger.warn('[WorldEvent] Invalid relatedQuestion value', { relatedQuestion: event.relatedQuestion, eventId: event.id }, 'database-service');
    }
    
    if (event.dayNumber !== undefined && 
        (typeof event.dayNumber !== 'number' || 
         !Number.isFinite(event.dayNumber) || 
         event.dayNumber < 0 || 
         event.dayNumber > 2147483647)) {
      logger.warn('[WorldEvent] Invalid dayNumber value', { dayNumber: event.dayNumber, eventId: event.id }, 'database-service');
    }

    const safeRelatedQuestion = typeof event.relatedQuestion === 'number' && 
      Number.isFinite(event.relatedQuestion) && 
      event.relatedQuestion >= 0 && 
      event.relatedQuestion <= 2147483647 
      ? event.relatedQuestion 
      : undefined;

    const safeDayNumber = typeof event.dayNumber === 'number' && 
      Number.isFinite(event.dayNumber) && 
      event.dayNumber >= 0 && 
      event.dayNumber <= 2147483647 
      ? event.dayNumber 
      : undefined;

    return await prisma.worldEvent.create({
      data: {
        id: event.id,
        eventType: event.eventType,
        description: descriptionString,
        actors: event.actors,
        relatedQuestion: safeRelatedQuestion,
        pointsToward: event.pointsToward,
        visibility: event.visibility,
        gameId: event.gameId,
        dayNumber: safeDayNumber,
      },
    });
  }

  /**
   * Get recent events
   */
  async getRecentEvents(limit = 100) {
    return await prisma.worldEvent.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
  }

  // ========== ACTORS ==========

  /**
   * Upsert actor (create or update)
   */
  async upsertActor(actor: Actor) {
    return await prisma.actor.upsert({
      where: { id: actor.id },
      create: {
        id: actor.id,
        name: actor.name,
        description: actor.description,
        domain: actor.domain || [],
        personality: actor.personality,
        tier: actor.tier,
        affiliations: actor.affiliations || [],
        postStyle: actor.postStyle,
        postExample: actor.postExample || [],
        role: actor.role,
        initialLuck: actor.initialLuck || 'medium',
        initialMood: actor.initialMood ?? 0,
        hasPool: actor.hasPool ?? false,
        tradingBalance: actor.tradingBalance ?? (actor.hasPool ? 10000 : 0),
        reputationPoints: actor.reputationPoints ?? (actor.hasPool ? 10000 : 0),
        profileImageUrl: actor.profileImageUrl,
        updatedAt: new Date(),
      },
      update: {
        name: actor.name,
        description: actor.description,
        domain: actor.domain || [],
        personality: actor.personality,
        tier: actor.tier,
        affiliations: actor.affiliations || [],
        postStyle: actor.postStyle,
        postExample: actor.postExample || [],
        role: actor.role,
        // Update database-specific fields if provided
        ...(actor.initialLuck !== undefined && { initialLuck: actor.initialLuck }),
        ...(actor.initialMood !== undefined && { initialMood: actor.initialMood }),
        ...(actor.hasPool !== undefined && { hasPool: actor.hasPool }),
        ...(actor.tradingBalance !== undefined && { tradingBalance: actor.tradingBalance }),
        ...(actor.reputationPoints !== undefined && { reputationPoints: actor.reputationPoints }),
        ...(actor.profileImageUrl !== undefined && { profileImageUrl: actor.profileImageUrl }),
      },
    });
  }

  /**
   * Get all actors
   */
  async getAllActors() {
    return await prisma.actor.findMany({
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get actor by ID
   */
  async getActor(id: string) {
    return await prisma.actor.findUnique({
      where: { id },
    });
  }

  // ========== UTILITY ==========

  /**
   * Get database stats
   */
  async getStats() {
    const [
      totalPosts,
      totalQuestions,
      activeQuestions,
      totalOrganizations,
      totalActors,
      gameState,
    ] = await Promise.all([
      prisma.post.count(),
      prisma.question.count(),
      prisma.question.count({ where: { status: 'active' } }),
      prisma.organization.count(),
      prisma.actor.count(),
      this.getGameState(),
    ]);

    return {
      totalPosts,
      totalQuestions,
      activeQuestions,
      totalOrganizations,
      totalActors,
      currentDay: gameState?.currentDay || 0,
      isRunning: gameState?.isRunning || false,
    };
  }

  /**
   * Get all games
   */
  async getAllGames() {
    return await prisma.game.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}

// Singleton instance - ensure it's always available
let dbInstance: DatabaseService | null = null;

export function getDbInstance(): DatabaseService {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
  }
  return dbInstance;
}

export default getDbInstance;

// Note: Import prisma directly from '@/lib/prisma' to avoid circular dependencies
