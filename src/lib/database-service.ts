/**
 * Database Service
 * 
 * Wrapper for all database operations.
 * Handles posts, questions, organizations, stock prices, events, actors.
 * 
 * Usage:
 *   import { db } from '@/lib/database-service'
 *   await db.createPost({...})
 *   const posts = await db.getRecentPosts(100)
 */

import type { FeedPost, Question as GameQuestion, Question, Organization, Actor } from '@/shared/types';
import { logger } from './logger';
import { prisma } from './prisma';
import { generateTagsForPosts } from './services/tag-generation-service';
import { storeTagsForPost } from './services/tag-storage-service';

class DatabaseService {
  // Expose prisma for direct queries
  public prisma = prisma;
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
        isContinuous: true,
        isRunning: true,
        currentDate: new Date(),
        speed: 60000, // 1 minute ticks
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

    // Generate and store tags for the post (async, don't wait)
    this.tagPostAsync(post.id, post.content).catch(error => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.warn('Failed to tag post', { 
        postId: post.id,
        error: errorMessage 
      }, 'DatabaseService');
    });

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
        dayNumber: data.dayNumber,
        timestamp: data.timestamp,
      },
    });

    // Generate and store tags for the post (async, don't wait)
    this.tagPostAsync(data.id, data.content).catch(error => {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.warn('Failed to tag post', { 
        postId: data.id,
        error: errorMessage 
      }, 'DatabaseService');
    });

    return created;
  }

  /**
   * Create multiple posts in batch
   */
  async createManyPosts(posts: Array<FeedPost & { gameId?: string; dayNumber?: number }>) {
    const result = await prisma.post.createMany({
      data: posts.map(post => ({
        id: post.id,
        content: post.content,
        authorId: post.author,
        gameId: post.gameId,
        dayNumber: post.dayNumber,
        timestamp: new Date(post.timestamp),
      })),
      skipDuplicates: true,
    });

    if (posts.length > 0) {
      try {
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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error('Failed to generate/store tags for posts', { 
          error: errorMessage,
          stack: errorStack 
        }, 'DatabaseService');
      }
    }

    return result;
  }

  /**
   * Get recent posts (paginated)
   * Note: Not cached as this is real-time data that updates frequently
   */
  async getRecentPosts(limit = 100, offset = 0) {
    logger.debug('DatabaseService.getRecentPosts called', { limit, offset }, 'DatabaseService');
    
    const posts = await prisma.post.findMany({
      take: limit,
      skip: offset,
      orderBy: { timestamp: 'desc' },
    });
    
    logger.info('DatabaseService.getRecentPosts completed', {
      limit,
      offset,
      postCount: posts.length,
      firstPostId: posts[0]?.id,
      lastPostId: posts[posts.length - 1]?.id,
    }, 'DatabaseService');
    
    return posts;
  }

  /**
   * Get posts by actor
   */
  async getPostsByActor(authorId: string, limit = 100) {
    logger.debug('DatabaseService.getPostsByActor called', { authorId, limit }, 'DatabaseService');
    
    const posts = await prisma.post.findMany({
      where: { authorId },
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
    
    logger.info('DatabaseService.getPostsByActor completed', {
      authorId,
      limit,
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
        questionNumber: question.questionNumber,
        text: question.text,
        scenarioId: question.scenario,
        outcome: question.outcome,
        rank: question.rank,
        createdDate: new Date(question.createdDate || new Date()),
        resolutionDate: new Date(question.resolutionDate!),
        status: question.status || 'active',
        resolvedOutcome: question.resolvedOutcome,
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
      },
      update: {
        currentPrice: org.currentPrice || org.initialPrice,
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

    return await prisma.worldEvent.create({
      data: {
        ...event,
        description: descriptionString,
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

// Singleton instance
export const db = new DatabaseService();

// Export prisma for direct access (for API routes that need it)
export { prisma } from './prisma';
