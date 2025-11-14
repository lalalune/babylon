/**
 * Serverless Game Tick Logic
 *
 * Lightweight game content generation for Vercel Cron Jobs.
 * Executes a single "tick" of game logic without persistent processes.
 *
 * This replaces the continuous daemon with stateless, scheduled execution.
 *
 * ✅ Vercel-compatible: No filesystem access, completes in <60s
 */

import { MarketDecisionEngine } from '@/engine/MarketDecisionEngine';
import { BabylonLLMClient } from '@/generator/llm/openai-client';
import type { Prisma } from '@prisma/client';
import { db } from './database-service';
import { logger } from './logger';
import { prisma } from './prisma';
import { MarketContextService } from './services/market-context-service';
import { TradeExecutionService } from './services/trade-execution-service';
import { calculateTrendingIfNeeded, calculateTrendingTags } from './services/trending-calculation-service';
import { generateSnowflakeId } from './snowflake';
import { ArticleGenerator } from '@/engine/ArticleGenerator';
import type { ActorTier, WorldEvent } from '@/shared/types';

export interface GameTickResult {
  postsCreated: number;
  eventsCreated: number;
  articlesCreated: number;
  marketsUpdated: number;
  questionsResolved: number;
  questionsCreated: number;
  widgetCachesUpdated: number;
  trendingCalculated: boolean;
  reputationSynced: boolean;
  reputationSyncStats?: {
    total: number;
    successful: number;
    failed: number;
  };
}

/**
 * Execute a single game tick
 * Designed to complete within Vercel's 60-second limit
 */
export async function executeGameTick(): Promise<GameTickResult> {
  const timestamp = new Date();
  const startedAt = Date.now();
  const budgetMs = Number(process.env.GAME_TICK_BUDGET_MS || 45000);
  const deadline = startedAt + budgetMs;

  logger.info(
    'Executing game tick',
    { timestamp: timestamp.toISOString() },
    'GameTick'
  );

  // Initialize result counters
  const result: GameTickResult = {
    postsCreated: 0,
    eventsCreated: 0,
    articlesCreated: 0,
    marketsUpdated: 0,
    questionsResolved: 0,
    questionsCreated: 0,
    widgetCachesUpdated: 0,
    trendingCalculated: false,
    reputationSynced: false,
  };

  try {
    // Bootstrap initial content if this is a fresh setup
    await bootstrapContentIfNeeded(timestamp);

    // Initialize LLM client with error handling
    const llmClient = (() => {
      try {
        return new BabylonLLMClient();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        logger.error('Failed to initialize LLM client', { 
          error: errorMessage,
          stack: errorStack 
        }, 'GameTick');
        return null;
      }
    })();

    // Get active questions from database
    const activeQuestions = await prisma.question.findMany({
      where: {
        status: 'active',
      },
    });

    logger.info(
      `Found ${activeQuestions.length} active questions`,
      { count: activeQuestions.length },
      'GameTick'
    );

    // Generate initial questions FIRST if this is the first tick
    if (activeQuestions.length === 0 && llmClient && Date.now() < deadline) {
      logger.info('First tick detected - generating initial questions', {}, 'GameTick');
      try {
        const questionsGenerated = await generateNewQuestions(
          5, // Generate 5 initial questions
          llmClient,
          deadline
        );
        result.questionsCreated = questionsGenerated;
        
        // Reload active questions after generation
        const newActiveQuestions = await prisma.question.findMany({
          where: { status: 'active' },
        });
        activeQuestions.length = 0;
        activeQuestions.push(...newActiveQuestions);
        
        logger.info(`Initial questions created: ${questionsGenerated}`, { count: questionsGenerated }, 'GameTick');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to generate initial questions', { error: errorMessage }, 'GameTick');
      }
    }

    const questionsToResolve = activeQuestions.filter((q: { resolutionDate: Date | null }) => {
      if (!q.resolutionDate) return false;
      const resolutionDate = new Date(q.resolutionDate);
      return resolutionDate <= timestamp;
    });

    if (questionsToResolve.length > 0) {
      try {
        logger.info(
          `Resolving ${questionsToResolve.length} questions`,
          { count: questionsToResolve.length },
          'GameTick'
        );

        await prisma.question.updateMany({
          where: {
            id: { in: questionsToResolve.map((q: typeof questionsToResolve[number]) => q.id) },
          },
          data: { status: 'resolved' },
        });

        for (const question of questionsToResolve) {
          try {
            await resolveQuestionPayouts(question.questionNumber);
            result.questionsResolved++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error('Failed to resolve question payout', { 
              error: errorMessage, 
              questionNumber: question.questionNumber 
            }, 'GameTick');
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error('Failed to resolve questions', { error: errorMessage }, 'GameTick');
      }
    }

    // Each generation function is isolated with its own error handling
    // Combined post and article generation to mix NPCs and orgs
    if (llmClient) {
      if (Date.now() < deadline) {
        try {
          const { posts, articles } = await generateMixedPosts(
            activeQuestions.slice(0, 3),
            timestamp,
            llmClient,
            deadline
          );
          result.postsCreated = posts;
          result.articlesCreated = articles;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(
            'Failed to generate posts',
            { error: errorMessage },
            'GameTick'
          );
        }
      } else {
        logger.warn(
          'Skipping post generation – tick budget exceeded',
          { budgetMs },
          'GameTick'
        );
      }
    } else {
      logger.warn(
        'Skipping post generation – LLM unavailable',
        undefined,
        'GameTick'
      );
    }

    try {
      const eventsGenerated = await generateEvents(
        activeQuestions.slice(0, 3),
        timestamp
      );
      result.eventsCreated = eventsGenerated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to generate events', { error: errorMessage }, 'GameTick');
    }

    if (llmClient) {
      if (Date.now() < deadline) {
        try {
          const articlesGenerated = await generateArticles(
            timestamp,
            llmClient,
            deadline
          );
          result.articlesCreated = articlesGenerated;
        } catch (error) {
          logger.error('Failed to generate articles', { error }, 'GameTick');
        }
      } else {
        logger.warn(
          'Skipping article generation – tick budget exceeded',
          { budgetMs },
          'GameTick'
        );
      }
    } else {
      logger.warn(
        'Skipping article generation – LLM unavailable',
        undefined,
        'GameTick'
      );
    }

    // Generate and execute NPC trading decisions
    if (llmClient && Date.now() < deadline) {
      try {
        const contextService = new MarketContextService();
        const decisionEngine = new MarketDecisionEngine(llmClient, contextService);
        const executionService = new TradeExecutionService();

        const marketDecisions = await decisionEngine.generateBatchDecisions();
        const executionResult =
          await executionService.executeDecisionBatch(marketDecisions);

        logger.info(
          `NPC Trading: ${executionResult.successfulTrades} trades executed`,
          {
            successful: executionResult.successfulTrades,
            failed: executionResult.failedTrades,
            holds: executionResult.holdDecisions,
          },
          'GameTick'
        );

        // Update prices based on NPC trades
        const marketsUpdated = await updateMarketPricesFromTrades(
          timestamp
        );
        result.marketsUpdated = marketsUpdated;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          'Failed to generate/execute market decisions',
          { error: errorMessage },
          'GameTick'
        );
      }
    } else if (!llmClient) {
      logger.warn(
        'Skipping market decisions – LLM unavailable',
        undefined,
        'GameTick'
      );
    } else {
      logger.warn(
        'Skipping market decisions – tick budget exceeded',
        { budgetMs },
        'GameTick'
      );
    }

    try {
      const currentActiveCount =
        activeQuestions.length - result.questionsResolved;
      if (currentActiveCount < 10) {
        if (llmClient && Date.now() < deadline) {
          const questionsGenerated = await generateNewQuestions(
            Math.min(3, 15 - currentActiveCount),
            llmClient,
            deadline
          );
          result.questionsCreated = questionsGenerated;
        } else if (!llmClient) {
          logger.warn(
            'Skipping question generation – LLM unavailable',
            undefined,
            'GameTick'
          );
        } else {
          logger.warn(
            'Skipping question generation – tick budget exceeded',
            { budgetMs },
            'GameTick'
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to generate new questions', { error: errorMessage }, 'GameTick');
    }

    try {
      await prisma.game.updateMany({
        where: { isContinuous: true },
        data: {
          lastTickAt: timestamp,
          updatedAt: timestamp,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to update game state', { error: errorMessage }, 'GameTick');
    }

    try {
      const cachesUpdated = await updateWidgetCaches();
      result.widgetCachesUpdated = cachesUpdated;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to update widget caches', { error: errorMessage }, 'GameTick');
    }

    // Calculate trending tags if needed (checks 30-minute interval internally)
    // Force calculation on first tick if we just generated baseline posts
    const forceCalculation = result.postsCreated > 0 && result.articlesCreated > 0;
    try {
      const trendingCalculated = forceCalculation 
        ? await forceTrendingCalculation()
        : await calculateTrendingIfNeeded();
      result.trendingCalculated = trendingCalculated;
      if (trendingCalculated) {
        logger.info('Trending tags recalculated', {}, 'GameTick');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to calculate trending tags', { error: errorMessage }, 'GameTick');
      // Don't fail the entire tick if trending calculation fails
    }

    // Sync reputation if needed (checks 3-hour interval internally)
    try {
      const { periodicReputationSyncIfNeeded } = await import('./reputation/agent0-reputation-sync');
      const syncResult = await periodicReputationSyncIfNeeded();
      result.reputationSynced = syncResult.synced;
      if (syncResult.synced && syncResult.total !== undefined) {
        result.reputationSyncStats = {
          total: syncResult.total,
          successful: syncResult.successful || 0,
          failed: syncResult.failed || 0,
        };
        logger.info('Reputation sync completed', result.reputationSyncStats, 'GameTick');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to sync reputation', { error: errorMessage }, 'GameTick');
      // Don't fail the entire tick if reputation sync fails
    }

    const durationMs = Date.now() - startedAt;
    logger.info('Game tick completed', { ...result, durationMs }, 'GameTick');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    logger.error('Critical error in game tick', { 
      error: errorMessage,
      stack: errorStack 
    }, 'GameTick');
    throw error;
  }

  return result;
}

/**
 * Bootstrap content on first game tick
 * Ensures trending and news are initialized automatically
 */
async function bootstrapContentIfNeeded(timestamp: Date): Promise<void> {
  // Check if we need to bootstrap
  const trendingCount = await prisma.trendingTag.count();
  const newsCount = await prisma.post.count({ where: { type: 'article' } });
  
  const MIN_TRENDING = 5;
  const MIN_NEWS = 5;
  
  // If we have enough of both, nothing to do
  if (trendingCount >= MIN_TRENDING && newsCount >= MIN_NEWS) {
    return;
  }
  
  logger.info('Bootstrapping initial content...', {
    currentTrending: trendingCount,
    currentNews: newsCount,
    needTrending: trendingCount < MIN_TRENDING,
    needNews: newsCount < MIN_NEWS,
  }, 'GameTick');
  
  // Bootstrap news articles if needed
  if (newsCount < MIN_NEWS) {
    await bootstrapNewsArticles(timestamp, MIN_NEWS - newsCount);
  }
  
  // Bootstrap trending if needed (requires posts and tags)
  if (trendingCount < MIN_TRENDING) {
    await bootstrapTrending();
  }
  
  logger.info('Bootstrap complete', {
    trendingCount: await prisma.trendingTag.count(),
    newsCount: await prisma.post.count({ where: { type: 'article' } }),
  }, 'GameTick');
}

/**
 * Create initial news articles
 */
async function bootstrapNewsArticles(timestamp: Date, count: number): Promise<void> {
  logger.info(`Creating ${count} initial news articles...`, undefined, 'GameTick');
  
  // Get media organizations
  const newsOrgs = await prisma.organization.findMany({
    where: { type: 'media' },
    take: 5,
  });
  
  if (newsOrgs.length === 0) {
    logger.warn('No media organizations found, skipping news bootstrap', undefined, 'GameTick');
    return;
  }
  
  // Sample news topics (realistic, varied)
  const sampleArticles = [
    {
      title: 'Markets Show Mixed Signals Amid Economic Uncertainty',
      summary: 'Investors navigate volatile conditions as key indicators point to divergent trends across major sectors and asset classes.',
      category: 'Finance',
      sentiment: 'neutral',
      biasScore: 0.0,
    },
    {
      title: 'Tech Industry Faces New Regulatory Scrutiny',
      summary: 'Government agencies announce enhanced oversight measures targeting major technology companies and their market practices.',
      category: 'Tech',
      sentiment: 'negative',
      biasScore: -0.3,
    },
    {
      title: 'Innovation in Clean Energy Accelerates',
      summary: 'Breakthrough developments in renewable energy technology promise significant advances toward sustainability goals.',
      category: 'Tech',
      sentiment: 'positive',
      biasScore: 0.5,
    },
    {
      title: 'Global Markets Digest Policy Changes',
      summary: 'Financial markets adjust to new policy frameworks as central banks signal potential shifts in monetary strategy.',
      category: 'Finance',
      sentiment: 'neutral',
      biasScore: 0.1,
    },
    {
      title: 'Corporate Investment Trends Shift',
      summary: 'Major corporations redirect capital allocation strategies in response to evolving market dynamics and opportunities.',
      category: 'Finance',
      sentiment: 'neutral',
      biasScore: 0.0,
    },
    {
      title: 'Technology Adoption Reaches New Milestone',
      summary: 'Enterprise software and cloud services see record adoption rates as digital transformation accelerates across industries.',
      category: 'Tech',
      sentiment: 'positive',
      biasScore: 0.4,
    },
    {
      title: 'Economic Indicators Point to Continued Growth',
      summary: 'Latest data releases suggest sustained expansion despite headwinds from global trade tensions and policy uncertainty.',
      category: 'Finance',
      sentiment: 'positive',
      biasScore: 0.3,
    },
    {
      title: 'Industry Leaders Navigate Changing Landscape',
      summary: 'Executives across sectors adapt strategies to address emerging challenges and capitalize on new market opportunities.',
      category: 'Business',
      sentiment: 'neutral',
      biasScore: 0.0,
    },
  ];
  
  // Create articles spread over last 24 hours
  for (let i = 0; i < count && i < sampleArticles.length; i++) {
    const article = sampleArticles[i];
    if (!article) continue;
    
    const org = newsOrgs[i % newsOrgs.length];
    if (!org) continue;
    
    const hoursAgo = Math.floor((i / count) * 24);
    const articleTimestamp = new Date(timestamp.getTime() - hoursAgo * 60 * 60 * 1000);
    
    await db.createPostWithAllFields({
      id: generateSnowflakeId(),
      type: 'article',
      content: article.summary,
      articleTitle: article.title,
      category: article.category,
      sentiment: article.sentiment,
      biasScore: article.biasScore,
      authorId: org.id,
      gameId: 'continuous',
      dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
      timestamp: articleTimestamp,
    });
  }
  
  logger.info(`Created ${count} initial news articles`, undefined, 'GameTick');
}

/**
 * Bootstrap trending tags
 */
async function bootstrapTrending(): Promise<void> {
  logger.info('Bootstrapping trending tags...', undefined, 'GameTick');
  
  // Check if we have enough posts and tags
  const postCount = await prisma.post.count();
  const taggedPostCount = await prisma.post.count({
    where: { postTags: { some: {} } },
  });
  
  logger.info('Post/tag status for trending', {
    totalPosts: postCount,
    taggedPosts: taggedPostCount,
    taggedPercentage: postCount > 0 ? Math.round((taggedPostCount / postCount) * 100) : 0,
  }, 'GameTick');
  
  // If we have tagged posts, calculate trending
  if (taggedPostCount >= 10) {
    await calculateTrendingTags();
    logger.info('Calculated trending from existing posts', undefined, 'GameTick');
    return;
  }
  
  // If we have posts but they're not tagged, tag them first
  if (postCount >= 10 && taggedPostCount < 10) {
    logger.info('Posts exist but not tagged, waiting for auto-tagging...', undefined, 'GameTick');
    logger.info('Trending will be calculated once posts are tagged', undefined, 'GameTick');
    return;
  }
  
  // If we have very few posts, create sample tags and trending
  logger.info('Creating sample trending data...', undefined, 'GameTick');
  
  const sampleTags = [
    { name: 'markets', displayName: 'Markets', category: 'Finance' },
    { name: 'tech', displayName: 'Tech', category: 'Tech' },
    { name: 'ai', displayName: 'AI', category: 'Tech' },
    { name: 'finance', displayName: 'Finance', category: 'Finance' },
    { name: 'innovation', displayName: 'Innovation', category: 'Tech' },
  ];
  
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  for (let i = 0; i < sampleTags.length; i++) {
    const tagData = sampleTags[i];
    if (!tagData) continue;
    
    // Create tag
    const tag = await prisma.tag.upsert({
      where: { name: tagData.name },
      update: {},
      create: tagData,
    });
    
    // Create trending entry
    const score = (sampleTags.length - i) * 10 + Math.random() * 5;
    
    await prisma.trendingTag.create({
      data: {
        tagId: tag.id,
        score,
        postCount: Math.floor(Math.random() * 10) + 5,
        rank: i + 1,
        windowStart: weekAgo,
        windowEnd: now,
        relatedContext: null,
      },
    });
  }
  
  logger.info(`Created ${sampleTags.length} sample trending tags`, undefined, 'GameTick');
}

/**
 * Generate mixed posts from both NPCs and organizations
 * This ensures posts are interleaved rather than chunked by type
 */
async function generateMixedPosts(
  questions: Array<{ id: string; text: string; questionNumber: number }>,
  timestamp: Date,
  llm: BabylonLLMClient,
  deadlineMs: number
): Promise<{ posts: number; articles: number }> {
  const postsToGenerate = 8; // Mix of NPC posts and org articles
  let postsCreated = 0;
  let articlesCreated = 0;
  
  if (questions.length === 0) {
    logger.warn('No questions available for post generation', {}, 'GameTick');
    return { posts: 0, articles: 0 };
  }

  // Get actors (NPCs) and organizations in parallel
  const [actors, organizations] = await Promise.all([
    prisma.actor.findMany({
      take: 15,
      orderBy: { reputationPoints: 'desc' },
    }),
    prisma.organization.findMany({
      where: { type: 'media' },
      take: 5,
    }),
  ]);

  if (actors.length === 0 && organizations.length === 0) {
    logger.warn('No actors or organizations found for post generation', {}, 'GameTick');
    return { posts: 0, articles: 0 };
  }

  // Create a mixed pool of content creators
  interface ContentCreator {
    id: string;
    name: string;
    type: 'actor' | 'organization';
    data: typeof actors[number] | typeof organizations[number];
  }

  const creators: ContentCreator[] = [
    ...actors.map((actor: typeof actors[number]) => ({ 
      id: actor.id, 
      name: actor.name, 
      type: 'actor' as const,
      data: actor 
    })),
    ...organizations.map((org: typeof organizations[number]) => ({ 
      id: org.id, 
      name: org.name || 'Unknown Org', 
      type: 'organization' as const,
      data: org 
    })),
  ];

  // Shuffle to mix actors and orgs
  for (let i = creators.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [creators[i], creators[j]] = [creators[j]!, creators[i]!];
  }

  // Generate posts with timestamps spread across the tick interval (60 seconds)
  const tickDurationMs = 60000; // 1 minute
  const timeSlotMs = tickDurationMs / postsToGenerate;

  for (let i = 0; i < postsToGenerate && i < creators.length; i++) {
    // Check deadline before each post generation
    if (Date.now() > deadlineMs) {
      logger.warn(
        'Post generation aborted due to tick budget limit',
        { generated: postsCreated },
        'GameTick'
      );
      break;
    }

    const question = questions[i % questions.length]; // Use modulo to cycle through questions
    
    // Defensive check for question validity
    if (!question || !question.text) {
      logger.warn(
        'Missing question data',
        { questionIndex: i },
        'GameTick'
      );
      continue;
    }

    const creator = creators[i];
    if (!creator) {
      logger.warn('Missing creator data', { creatorIndex: i }, 'GameTick');
      continue;
    }

    try {
      // Calculate timestamp for this post (spread throughout the minute)
      const slotOffset = i * timeSlotMs;
      const randomJitter = Math.random() * timeSlotMs * 0.8; // 80% of slot for randomness
      const timestampWithOffset = new Date(timestamp.getTime() + slotOffset + randomJitter);
      if (creator.type === 'actor') {
        // Generate NPC post
        const prompt = `You are ${creator.name}. Write a brief social media post (max 200 chars) about this prediction market question: "${question.text}". Be opinionated and entertaining.

Return your response as JSON in this exact format:
{
  "post": "your post content here"
}`;

        const response = await llm.generateJSON<{ post: string }>(
          prompt,
          {
            properties: {
              post: { type: 'string' },
            },
            required: ['post'],
          },
          { temperature: 0.9, maxTokens: 200 }
        );

        if (!response.post) {
          logger.warn('Empty post generated', { creatorIndex: i, creatorName: creator.name }, 'GameTick');
          continue;
        }

        await db.createPostWithAllFields({
          id: generateSnowflakeId(),
          content: response.post,
          authorId: creator.id,
          gameId: 'continuous',
          dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
          timestamp: timestampWithOffset,
        });
        postsCreated++;
        logger.debug('Created NPC post', { actor: creator.name, timestamp: timestampWithOffset }, 'GameTick');

      } else {
        // Generate organization article
        const prompt = `You are ${creator.name}, a news organization. Write a brief news headline and summary (max 300 chars total) about this prediction market: "${question.text}". Be professional and informative.

Return your response as JSON in this exact format:
{
  "title": "news headline here",
  "summary": "brief summary here"
}`;

        const response = await llm.generateJSON<{ title: string; summary: string }>(
          prompt,
          { 
            properties: {
              title: { type: 'string' },
              summary: { type: 'string' }
            },
            required: ['title', 'summary'] 
          },
          { temperature: 0.7, maxTokens: 300 }
        );

        if (!response.title || !response.summary) {
          logger.warn('Empty article generated', { creatorIndex: i, creatorName: creator.name }, 'GameTick');
          continue;
        }

        await db.createPostWithAllFields({
          id: generateSnowflakeId(),
          type: 'article',
          content: response.summary,
          articleTitle: response.title,
          authorId: creator.id,
          gameId: 'continuous',
          dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
          timestamp: timestampWithOffset,
        });
        postsCreated++;
        articlesCreated++;
        logger.debug('Created org article', { org: creator.name, timestamp: timestampWithOffset }, 'GameTick');
      }
    } catch (error) {
      logger.error(
        'Failed to generate post',
        { error, questionIndex: i, creatorId: creator?.id, creatorName: creator?.name, questionId: question?.id },
        'GameTick'
      );
      // Continue with next post instead of failing entire batch
    }
  }

  logger.info('Mixed post generation complete', { 
    postsCreated, 
    articlesCreated,
    actorsAvailable: actors.length, 
    orgsAvailable: organizations.length 
  }, 'GameTick');

  return { posts: postsCreated, articles: articlesCreated };
}

/**
 * Generate baseline articles on first tick (when no events exist yet)
 * Creates general news coverage to seed the Latest News panel
 */
async function generateBaselineArticles(
  newsOrgs: Array<{ id: string; name: string | null; description: string | null }>,
  timestamp: Date,
  llm: BabylonLLMClient,
  deadlineMs: number
): Promise<number> {
  let articlesCreated = 0;
  
  const baselineTopics = [
    { topic: "the current state of prediction markets", category: "finance" },
    { topic: "upcoming trends in tech and politics", category: "tech" },
    { topic: "volatility in crypto markets", category: "finance" },
    { topic: "major developments to watch this week", category: "business" },
    { topic: "the state of global markets", category: "finance" },
  ];
  
  // Calculate timestamp spread
  const tickDurationMs = 60000; // 1 minute
  const timeSlotMs = tickDurationMs / newsOrgs.length;
  
  for (let i = 0; i < Math.min(5, newsOrgs.length); i++) {
    if (Date.now() > deadlineMs) break;
    
    const org = newsOrgs[i];
    if (!org || !org.name) continue;
    
    const topicData = baselineTopics[i % baselineTopics.length];
    if (!topicData) continue;
    
    try {
      const slotOffset = i * timeSlotMs;
      const randomJitter = Math.random() * timeSlotMs * 0.8;
      const timestampWithOffset = new Date(timestamp.getTime() + slotOffset + randomJitter);
      
      const prompt = `You are ${org.name}, a news organization. Write a detailed news article about ${topicData.topic}.

Your article should include:
- A compelling headline (max 100 chars)
- A 2-3 sentence summary for the article listing (max 200 chars)
- Be professional and informative
- Match the tone of a ${org.description || 'news organization'}

Return your response as JSON in this exact format:
{
  "title": "compelling headline here",
  "summary": "2-3 sentence summary here"
}`;
      
      const response = await llm.generateJSON<{ title: string; summary: string }>(
        prompt,
        { properties: { title: { type: 'string' }, summary: { type: 'string' } }, required: ['title', 'summary'] },
        { temperature: 0.7, maxTokens: 400 }
      );
      
      if (!response.title || !response.summary) continue;
      
      await db.createPostWithAllFields({
        id: generateSnowflakeId(),
        type: 'article',
        content: response.summary,
        articleTitle: response.title,
        category: topicData.category,
        authorId: org.id,
        gameId: 'continuous',
        dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
        timestamp: timestampWithOffset,
      });
      articlesCreated++;
      logger.debug('Created baseline article', { org: org.name, topic: topicData.topic }, 'GameTick');
    } catch (error) {
      logger.warn('Failed to generate baseline article', { error, orgId: org.id }, 'GameTick');
    }
  }
  
  logger.info('Baseline article generation complete', { articlesCreated }, 'GameTick');
  return articlesCreated;
}

/**
 * Generate articles
 */
async function generateArticles(
  timestamp: Date,
  llm: BabylonLLMClient,
  deadlineMs: number
): Promise<number> {
  // Get recent events (from last 2 hours)
  const twoHoursAgo = new Date(timestamp.getTime() - 2 * 60 * 60 * 1000);
  const recentEvents = await prisma.worldEvent.findMany({
    where: {
      timestamp: { gte: twoHoursAgo },
      visibility: 'public',
    },
    orderBy: { timestamp: 'desc' },
    take: 10,
  });

  // If no recent events, generate baseline articles about general topics
  if (recentEvents.length === 0) {
    logger.info('No recent events - generating baseline articles', {}, 'GameTick');
    const newsOrgs = await prisma.organization.findMany({
      where: { type: 'media' },
      take: 5,
    });
    
    if (newsOrgs.length === 0) {
      logger.warn('No news organizations found for baseline articles', {}, 'GameTick');
      return 0;
    }
    
    return await generateBaselineArticles(newsOrgs, timestamp, llm, deadlineMs);
  }

  // Get news organizations (media type)
  const newsOrgs = await prisma.organization.findMany({
    where: { type: 'media' },
  });

  if (newsOrgs.length === 0) return 0;

  // Get actors for journalist bylines and relationship context
  const actors = await prisma.actor.findMany({
    take: 50,
    orderBy: { tier: 'asc' }, // Higher tier actors first
  });

  if (actors.length === 0) {
    logger.warn('No actors found for article generation', {}, 'GameTick');
    return 0;
  }

  // Initialize article generator
  const articleGen = new ArticleGenerator(llm);

  let articlesCreated = 0;

  // Generate 1-3 articles per tick (to avoid overwhelming and stay within time limit)
  const articlesToGenerate = Math.min(3, Math.ceil(recentEvents.length * 0.3));
  const eventsTocover = recentEvents.slice(0, articlesToGenerate);

  for (const event of eventsTocover) {
    // Check deadline before each article generation
    if (Date.now() > deadlineMs) {
      logger.warn(
        'Article generation aborted due to tick budget limit',
        { articlesCreated },
        'GameTick'
      );
      break;
    }

    try {
      const worldEvent: WorldEvent = {
        id: event.id,
        type: event.eventType as WorldEvent['type'],
        description: event.description,
        actors: event.actors || [],
        relatedQuestion: event.relatedQuestion || undefined,
        visibility: event.visibility as WorldEvent['visibility'],
        day: event.dayNumber || 0,
      };

      const organizations = newsOrgs.map((org: typeof newsOrgs[number]) => ({
        id: org.id,
        name: org.name || 'Unknown Organization',
        description: org.description || '',
        type: (org.type as 'company' | 'media' | 'government') || 'media',
        canBeInvolved: org.canBeInvolved,
        initialPrice: org.initialPrice || undefined,
        currentPrice: org.currentPrice || undefined,
      }));

      const actorList = actors
        .filter((a: typeof actors[number]) => a && a.id && a.name) // Filter out invalid actors
        .map((a: typeof actors[number]) => ({
          id: a.id,
          name: a.name,
          description: a.description || '',
          domain: a.domain || '',
          personality: a.personality || undefined,
          tier: (a.tier as ActorTier) || undefined,
          affiliations: a.affiliations || [],
          postStyle: a.postStyle || undefined,
          postExample: a.postExample || '',
          role: (a.role as 'main' | 'supporting' | 'extra') || undefined,
          initialLuck:
            (a.initialLuck as 'low' | 'medium' | 'high') || 'medium',
          initialMood: a.initialMood || 0,
        }));

      if (actorList.length === 0) {
        logger.warn(
          'No valid actors for article generation',
          { eventId: event.id },
          'GameTick'
        );
        continue;
      }

      const articles = await articleGen.generateArticlesForEvent(
        worldEvent,
        organizations,
        actorList,
        []
      );

      for (const article of articles) {
        if (!article || !article.authorOrgId) {
          logger.warn(
            'Invalid article generated',
            { eventId: event.id },
            'GameTick'
          );
          continue;
        }

        await db.createPostWithAllFields({
          id: generateSnowflakeId(),
          type: 'article',
          content: article.summary || '',
          fullContent: article.content || '',
          articleTitle: article.title || 'Untitled',
          byline: article.byline || undefined,
          biasScore: article.biasScore || undefined,
          sentiment: article.sentiment || undefined,
          slant: article.slant || undefined,
          category: article.category || undefined,
          authorId: article.authorOrgId,
          gameId: 'continuous',
          dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
          timestamp: article.publishedAt || new Date(),
        });
        articlesCreated++;
      }
    } catch (error) {
      logger.error(
        'Failed to generate article from event',
        { error, eventId: event.id },
        'GameTick'
      );
    }
  }

  return articlesCreated;
}

/**
 * Generate events
 */
async function generateEvents(
  questions: Array<{ id: string; text: string; questionNumber: number }>,
  timestamp: Date
): Promise<number> {
  if (questions.length === 0) return 0;

  let eventsCreated = 0;
  const eventsToGenerate = Math.min(2, questions.length);

  for (let i = 0; i < eventsToGenerate; i++) {
    try {
      const question = questions[i];

      if (!question || !question.text) {
        logger.warn(
          'Missing question data for event',
          { questionIndex: i },
          'GameTick'
        );
        continue;
      }

      await prisma.worldEvent.create({
        data: {
          eventType: 'announcement',
          description: `Development regarding: ${question.text}`,
          actors: [],
          relatedQuestion: question.questionNumber,
          visibility: 'public',
          gameId: 'continuous',
          dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
          timestamp: timestamp,
        },
      });
      eventsCreated++;
    } catch (error) {
      logger.error(
        'Failed to generate event',
        { error, questionIndex: i },
        'GameTick'
      );
      // Continue with next event
    }
  }

  return eventsCreated;
}


/**
 * Update market prices based on NPC trading activity
 * Prices move based on net sentiment from trades
 */
async function updateMarketPricesFromTrades(
  timestamp: Date
): Promise<number> {
  // TODO: Implement market price updates based on NPC trading activity
  // This should analyze recent Position and PerpPosition changes and adjust
  // Organization and Question prices accordingly based on trading volume/sentiment
  
  logger.info(
    'Market price update from trades (not yet implemented)',
    { timestamp },
    'GameTick'
  );
  
  return 0;
}

/**
 * Generate new questions
 */
async function generateNewQuestions(
  count: number,
  llm: BabylonLLMClient,
  deadlineMs: number
): Promise<number> {
  let questionsCreated = 0;

  for (let i = 0; i < count; i++) {
    if (Date.now() > deadlineMs) {
      logger.warn(
        'Question generation aborted due to tick budget limit',
        { questionsCreated },
        'GameTick'
      );
      break;
    }

    const prompt = `Generate a single yes/no prediction market question about current events in tech, crypto, or politics. Make it specific and resolvable within 7 days. 

Return your response as JSON in this exact format:
{
  "question": "Will X happen?",
  "resolutionCriteria": "Clear criteria for resolution"
}`;

    let response: { question: string; resolutionCriteria: string } | null =
      null;
    try {
      response = await llm.generateJSON<{
        question: string;
        resolutionCriteria: string;
      }>(
        prompt,
        {
          properties: {
            question: { type: 'string' },
            resolutionCriteria: { type: 'string' },
          },
          required: ['question', 'resolutionCriteria'],
        },
        { temperature: 0.8, maxTokens: 300 }
      );
    } catch (error) {
      logger.warn(
        'Failed to generate new question via LLM',
        { error },
        'GameTick'
      );
      continue;
    }

    if (!response?.question) {
      continue;
    }

    const resolutionDate = new Date();
    resolutionDate.setDate(resolutionDate.getDate() + 3);

    let nextQuestionNumber = 1;
    try {
      const lastQuestion = await prisma.question.findFirst({
        orderBy: { questionNumber: 'desc' },
      });
      nextQuestionNumber = (lastQuestion?.questionNumber || 0) + 1;
    } catch (error) {
      logger.error(
        'Failed to calculate next question number',
        { error },
        'GameTick'
      );
      continue;
    }

    const scenarioId = 1; // TODO: replace with dynamic scenario selection when schema supports it

    try {
      const question = await prisma.question.create({
        data: {
          questionNumber: nextQuestionNumber,
          text: response.question,
          scenarioId,
          outcome: Math.random() > 0.5,
          rank: 1,
          resolutionDate,
          status: 'active',
        },
      });

      await prisma.market.create({
        data: {
          id: question.id,
          question: response.question,
          description: response.resolutionCriteria,
          liquidity: 1000,
          endDate: resolutionDate,
          gameId: 'continuous',
        },
      });

      questionsCreated++;
    } catch (error) {
      logger.error(
        'Failed to persist generated question',
        { error },
        'GameTick'
      );
    }
  }

  return questionsCreated;
}

/**
 * Resolve question payouts
 */
async function resolveQuestionPayouts(questionNumber: number): Promise<void> {
  const question = await prisma.question.findFirst({
    where: { questionNumber },
  });

  if (!question) return;

  // Find the market for this question (by matching question text)
  const market = await prisma.market.findFirst({
    where: { question: question.text },
  });

  if (!market) return;

  // Get all positions for this market
  const positions = await prisma.position.findMany({
    where: {
      marketId: market.id,
    },
  });

  // Pay out winners
  for (const position of positions) {
    const isWinner =
      (position.side === true && question.outcome) ||
      (position.side === false && !question.outcome);

    if (isWinner) {
      const payout = Number(position.shares) * 2; // Simplified: 2x payout for winners

      await prisma.user.update({
        where: { id: position.userId },
        data: {
          virtualBalance: {
            increment: payout,
          },
        },
      });
    }
  }

  // Mark market as resolved
  await prisma.market.update({
    where: { id: market.id },
    data: {
      resolved: true,
      resolution: question.outcome,
    },
  });
}

/**
 * Update widget caches
 * This pre-generates and caches widget data to improve performance
 */
async function updateWidgetCaches(): Promise<number> {
  let cachesUpdated = 0;

  try {
    const companies = await db.getCompanies();

    if (!companies || companies.length === 0) {
      logger.warn('No companies found for widget cache update', {}, 'GameTick');
      return 0;
    }

    const perpMarketsWithStats = await Promise.all(
      companies
        .filter((company: typeof companies[number]) => company && company.id && company.name) // Filter out invalid companies
        .map(async (company: typeof companies[number]) => {
          try {
            const currentPrice =
              company.currentPrice || company.initialPrice || 100;

            const priceHistory = await db.getPriceHistory(company.id, 1440);

            let changePercent24h = 0;

            if (priceHistory && priceHistory.length > 0) {
              const price24hAgo = priceHistory[priceHistory.length - 1];
              if (price24hAgo && price24hAgo.price) {
                const change24h = currentPrice - price24hAgo.price;
                changePercent24h = (change24h / price24hAgo.price) * 100;
              }
            }

            return {
              ticker: company.id.toUpperCase().replace(/-/g, ''),
              organizationId: company.id,
              name: company.name || 'Unknown Company',
              currentPrice,
              changePercent24h,
              volume24h: 0,
            };
          } catch (error) {
            logger.warn(
              'Failed to get price stats for company',
              { companyId: company.id, error },
              'GameTick'
            );
            // Return a safe default
            return {
              ticker: company.id.toUpperCase().replace(/-/g, ''),
              organizationId: company.id,
              name: company.name || 'Unknown Company',
              currentPrice: company.currentPrice || company.initialPrice || 100,
              changePercent24h: 0,
              volume24h: 0,
            };
          }
        })
    );

    const topPerpGainers = perpMarketsWithStats
      .sort(
        (a: typeof perpMarketsWithStats[number], b: typeof perpMarketsWithStats[number]) => 
          Math.abs(b.changePercent24h) - Math.abs(a.changePercent24h)
      )
      .slice(0, 3);

    // 2. Get top 3 pool gainers
    const pools = await prisma.pool.findMany({
      where: { isActive: true },
      include: {
        npcActor: {
          select: { name: true },
        },
      },
      orderBy: { totalValue: 'desc' },
    });

    const poolsWithReturn = pools
      .filter((pool: typeof pools[number]) => pool && pool.id && pool.name) // Filter out invalid pools
      .map((pool: typeof pools[number]) => {
        const totalDeposits = parseFloat(pool.totalDeposits.toString());
        const totalValue = parseFloat(pool.totalValue.toString());
        const totalReturn =
          totalDeposits > 0
            ? ((totalValue - totalDeposits) / totalDeposits) * 100
            : 0;

        // Safely extract npcActor name with multiple fallbacks
        let npcActorName = 'Unknown';
        try {
          if (
            pool.npcActor &&
            typeof pool.npcActor === 'object' &&
            'name' in pool.npcActor
          ) {
            npcActorName = pool.npcActor.name || 'Unknown';
          }
        } catch (e) {
          logger.warn(
            'Failed to extract npcActor name',
            { poolId: pool.id, error: e },
            'GameTick'
          );
        }

        return {
          id: pool.id,
          name: pool.name,
          npcActorName,
          totalReturn,
          totalValue,
        };
      });

    const topPoolGainers = poolsWithReturn
      .sort((a: typeof poolsWithReturn[number], b: typeof poolsWithReturn[number]) => 
        b.totalReturn - a.totalReturn
      )
      .slice(0, 3);

    // 3. Get top 3 questions by time-weighted volume
    const activeMarkets = await prisma.market.findMany({
      where: {
        resolved: false,
        endDate: { gte: new Date() },
      },
      select: {
        id: true,
        question: true,
        yesShares: true,
        noShares: true,
        createdAt: true,
      },
    });

    const marketsWithTimeWeightedVolume = activeMarkets.map((market: typeof activeMarkets[number]) => {
      const yesShares = market.yesShares ? Number(market.yesShares) : 0;
      const noShares = market.noShares ? Number(market.noShares) : 0;
      const totalShares = yesShares + noShares;
      const totalVolume = totalShares * 0.5;

      const ageInHours =
        (Date.now() - market.createdAt.getTime()) / (1000 * 60 * 60);
      const timeWeight =
        ageInHours < 24
          ? 2.0
          : Math.max(1.0, 2.0 - (ageInHours - 24) / (6 * 24));

      const timeWeightedScore = totalVolume * timeWeight;

      const yesPrice = totalShares > 0 ? yesShares / totalShares : 0.5;

      return {
        id: parseInt(market.id) || 0,
        text: market.question || 'Unknown Question',
        totalVolume,
        yesPrice,
        timeWeightedScore,
      };
    });

    const topVolumeQuestions = marketsWithTimeWeightedVolume
      .sort((a: typeof marketsWithTimeWeightedVolume[number], b: typeof marketsWithTimeWeightedVolume[number]) => 
        b.timeWeightedScore - a.timeWeightedScore
      )
      .slice(0, 3);

    // Update cache
    await prisma.widgetCache.upsert({
      where: { widget: 'markets' },
      create: {
        widget: 'markets',
        data: {
          topPerpGainers,
          topPoolGainers,
          topVolumeQuestions,
          lastUpdated: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
      update: {
        data: {
          topPerpGainers,
          topPoolGainers,
          topVolumeQuestions,
          lastUpdated: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
    });

    cachesUpdated++;
    logger.info('Updated markets widget cache', {}, 'GameTick');

    return cachesUpdated;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('Failed to update widget caches', { error: errorMessage }, 'GameTick');
    return 0;
  }
}

/**
 * Force trending calculation (for first tick with baseline posts)
 * Waits a few seconds for tags to be generated from posts, then calculates trending
 */
async function forceTrendingCalculation(): Promise<boolean> {
  try {
    logger.info('Forcing trending calculation (first tick)', {}, 'GameTick');
    
    // Wait 3 seconds for tag generation to complete (tags are generated async)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Import and call trending calculation directly
    const { calculateTrendingTags } = await import('./services/trending-calculation-service');
    await calculateTrendingTags();
    
    logger.info('Forced trending calculation complete', {}, 'GameTick');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to force trending calculation', { error: errorMessage }, 'GameTick');
    return false;
  }
}
