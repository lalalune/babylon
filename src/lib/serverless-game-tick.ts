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

import { ArticleGenerator } from '@/engine/ArticleGenerator';
import { MarketDecisionEngine } from '@/engine/MarketDecisionEngine';
import { BabylonLLMClient } from '@/generator/llm/openai-client';
import type { ActorTier, WorldEvent } from '@/shared/types';
import { db } from './database-service';
import { logger } from './logger';
import { NPCInvestmentManager } from './npc/npc-investment-manager';
import { prisma } from './prisma';
import { MarketContextService } from './services/market-context-service';
import { TradeExecutionService } from './services/trade-execution-service';
import { calculateTrendingIfNeeded, calculateTrendingTags } from './services/trending-calculation-service';
import { generateSnowflakeId } from './snowflake';
import type { ExecutionResult } from '@/types/market-decisions';
import { getOracleService } from './oracle';
import { worldFactsService } from './services/world-facts-service';

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
  alphaInvitesSent: number;
  npcGroupDynamics?: {
    groupsCreated: number;
    membersAdded: number;
    membersRemoved: number;
    usersInvited: number;
    usersKicked: number;
    messagesPosted: number;
  };
  oracleCommits: number;
  oracleReveals: number;
  oracleErrors: number;
}

/**
 * Execute a single game tick
 * Designed to complete within 3 minutes (180 seconds)
 * Uses parallelization for posts, articles, and other operations to maximize throughput
 * Guarantees critical operations (market decisions) always execute via budget reserve
 */
export async function executeGameTick(): Promise<GameTickResult> {
  const timestamp = new Date();
  const startedAt = Date.now();
  const budgetMs = Number(process.env.GAME_TICK_BUDGET_MS || 180000); // 3 minutes default
  const deadline = startedAt + budgetMs;
  
  // Reserve 60 seconds for critical operations (market decisions, widget updates)
  const criticalOpsReserveMs = 60000;
  const criticalOpsDeadline = startedAt + budgetMs - criticalOpsReserveMs;

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
    alphaInvitesSent: 0,
    oracleCommits: 0,
    oracleReveals: 0,
    oracleErrors: 0,
  };

  try {
    // Bootstrap initial content if this is a fresh setup
    await bootstrapContentIfNeeded(timestamp);

    // Load wandb model configuration from database
    const { getWandbModel } = await import('./ai-model-config');
    const wandbModel = await getWandbModel();
    if (wandbModel) {
      logger.info('Loaded wandb model from config', { model: wandbModel }, 'GameTick');
    }

    // Initialize LLM client - force Groq for game NPCs (wandb is only for Eliza agents)
    const llmClient = new BabylonLLMClient(undefined, undefined, 'groq');
    const stats = llmClient.getStats();
    logger.info('LLM client initialized for game NPCs', { 
      provider: stats.provider, 
      model: stats.model 
    }, 'GameTick');

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
    if (activeQuestions.length === 0 && Date.now() < deadline) {
      logger.info('First tick detected - generating initial questions', {}, 'GameTick');
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
      
      // Publish commitments to blockchain oracle
      if (questionsGenerated > 0 && newActiveQuestions.length > 0) {
        const oracleResult = await publishOracleCommitments(newActiveQuestions);
        result.oracleCommits += oracleResult.committed;
        result.oracleErrors += oracleResult.errors;
      }
    }

    const questionsToResolve = activeQuestions.filter((q: { resolutionDate: Date | null }) => {
      if (!q.resolutionDate) return false;
      const resolutionDate = new Date(q.resolutionDate);
      return resolutionDate <= timestamp;
    });

    if (questionsToResolve.length > 0) {
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
        await resolveQuestionPayouts(question.questionNumber);
        result.questionsResolved++;
      }
      
      // Publish reveals to blockchain oracle
      if (questionsToResolve.length > 0) {
        const oracleResult = await publishOracleReveals(questionsToResolve);
        result.oracleReveals += oracleResult.revealed;
        result.oracleErrors += oracleResult.errors;
      }
    }

    // Combined post and article generation to mix NPCs and orgs
    if (Date.now() < criticalOpsDeadline) {
      const { posts, articles } = await generateMixedPosts(
        activeQuestions.slice(0, 3),
        timestamp,
        llmClient,
        criticalOpsDeadline
      );
      result.postsCreated = posts;
      result.articlesCreated = articles;
    } else {
      logger.warn(
        'Skipping post generation – tick budget exceeded',
        { budgetMs },
        'GameTick'
      );
    }

    const eventsGenerated = await generateEvents(
      activeQuestions.slice(0, 3),
      timestamp
    );
    result.eventsCreated = eventsGenerated;

    // CRITICAL PRIORITY: Generate and execute NPC trading decisions
    // This ALWAYS runs - uses the full deadline, not the critical ops deadline
    // Market decisions are essential for game economy and must always execute
    logger.info('Starting critical market decision operations', { 
      timeRemaining: deadline - Date.now() 
    }, 'GameTick');

    const baselineResult = await NPCInvestmentManager.executeBaselineInvestments(timestamp);

    if (baselineResult) {
      const baselineUpdates = await updateMarketPricesFromTrades(
        timestamp,
        baselineResult
      );
      result.marketsUpdated += baselineUpdates;
    }

    const contextService = new MarketContextService();
    
    // Configure decision engine with model and token limits from environment
    // Use qwen/qwen3-32b on Groq for background trading operations
    const modelName = process.env.MARKET_DECISION_MODEL || 'qwen/qwen3-32b';
    
    // Model-aware output token limits:
    // Note: Input and output are SEPARATE limits on modern models
    // - Kimi models: 260k INPUT + 16k OUTPUT (separate)
    // - qwen3-32b: 130k INPUT + 32k OUTPUT (separate)
    const isKimiModel = modelName.toLowerCase().includes('kimi');
    const defaultMaxOutput = isKimiModel ? 16000 : 32000;
    const maxOutputTokens = parseInt(
      process.env.MARKET_DECISION_MAX_OUTPUT_TOKENS || defaultMaxOutput.toString(), 
      10
    );
    
    const decisionEngine = new MarketDecisionEngine(llmClient, contextService, {
      model: modelName,
      maxOutputTokens,
    });
    const executionService = new TradeExecutionService();

    const marketDecisions = await decisionEngine.generateBatchDecisions();

    if (marketDecisions.length === 0) {
      logger.info('No NPC market trades generated this tick', {}, 'GameTick');
    } else {
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
        timestamp,
        executionResult
      );
      result.marketsUpdated += marketsUpdated;
    }

    // Generate articles AFTER market decisions (lower priority, but parallelized)
    if (Date.now() < deadline) {
      const articlesGenerated = await generateArticles(
        timestamp,
        llmClient,
        deadline
      );
      result.articlesCreated += articlesGenerated; // Add to existing count from mixed posts
    } else {
      logger.warn(
        'Skipping article generation – tick budget exceeded',
        { budgetMs },
        'GameTick'
      );
    }

    const currentActiveCount =
      activeQuestions.length - result.questionsResolved;
    if (currentActiveCount < 10) {
      if (Date.now() < deadline) {
        const questionsGenerated = await generateNewQuestions(
          Math.min(3, 15 - currentActiveCount),
          llmClient,
          deadline
        );
        result.questionsCreated = questionsGenerated;
      } else {
        logger.warn(
          'Skipping question generation – tick budget exceeded',
          { budgetMs },
          'GameTick'
        );
      }
    }

    await prisma.game.updateMany({
      where: { isContinuous: true },
      data: {
        lastTickAt: timestamp,
        updatedAt: timestamp,
      },
    });

    const cachesUpdated = await updateWidgetCaches();
    result.widgetCachesUpdated = cachesUpdated;

    // Calculate trending tags if needed (checks 30-minute interval internally)
    // Force calculation on first tick if we just generated baseline posts
    const forceCalculation = result.postsCreated > 0 && result.articlesCreated > 0;
    const trendingCalculated = forceCalculation 
      ? await forceTrendingCalculation()
      : await calculateTrendingIfNeeded();
    result.trendingCalculated = trendingCalculated;
    if (trendingCalculated) {
      logger.info('Trending tags recalculated', {}, 'GameTick');
    }

    // Sync reputation if needed (checks 3-hour interval internally)
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

    // Process alpha group invites (small chance for highly engaged users)
    const { AlphaGroupInviteService } = await import('./services/alpha-group-invite-service');
    const invites = await AlphaGroupInviteService.processTickInvites();
    result.alphaInvitesSent = invites.length;
    if (invites.length > 0) {
      logger.info('Alpha group invites sent', { count: invites.length, invites }, 'GameTick');
    }

    // Process NPC group dynamics (form, join, leave, post, invite, kick)
    const { NPCGroupDynamicsService } = await import('./services/npc-group-dynamics-service');
    const dynamics = await NPCGroupDynamicsService.processTickDynamics();
    result.npcGroupDynamics = {
      groupsCreated: dynamics.groupsCreated,
      membersAdded: dynamics.membersAdded,
      membersRemoved: dynamics.membersRemoved,
      usersInvited: dynamics.usersInvited,
      usersKicked: dynamics.usersKicked,
      messagesPosted: dynamics.messagesPosted,
    };
    if (dynamics.groupsCreated > 0 || dynamics.membersAdded > 0 || dynamics.membersRemoved > 0 || 
        dynamics.usersInvited > 0 || dynamics.usersKicked > 0 || dynamics.messagesPosted > 0) {
      logger.info('NPC group dynamics processed', dynamics, 'GameTick');
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
      id: await generateSnowflakeId(),
      type: 'article',
      content: article.summary,
      fullContent: article.summary, // Bootstrap articles use summary as full content
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
    where: { PostTag: { some: {} } },
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
      create: {
        id: await generateSnowflakeId(),
        ...tagData,
        updatedAt: now,
      },
    });
    
    // Create trending entry
    const score = (sampleTags.length - i) * 10 + Math.random() * 5;
    
    await prisma.trendingTag.create({
      data: {
        id: await generateSnowflakeId(),
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
 * Generate mixed posts from both NPCs and organizations (parallelized version)
 * This ensures posts are interleaved rather than chunked by type
 * Generates all posts in parallel for maximum throughput
 */
async function generateMixedPosts(
  questions: Array<{ id: string; text: string; questionNumber: number }>,
  timestamp: Date,
  llm: BabylonLLMClient,
  deadlineMs: number
): Promise<{ posts: number; articles: number }> {
  const postsToGenerate = 8; // Mix of NPC posts and org articles
  
  if (questions.length === 0) {
    logger.warn('No questions available for post generation', {}, 'GameTick');
    return { posts: 0, articles: 0 };
  }

  // Get actors (NPCs), organizations, and world facts in parallel
  const [actors, organizations, worldFactsContext] = await Promise.all([
    prisma.actor.findMany({
      take: 15,
      orderBy: { reputationPoints: 'desc' },
    }),
    prisma.organization.findMany({
      where: { type: 'media' },
      take: 5,
    }),
    worldFactsService.generatePromptContext(),
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

  logger.info(`Generating ${postsToGenerate} mixed posts in parallel`, { 
    actorsAvailable: actors.length, 
    orgsAvailable: organizations.length,
    creatorsPoolSize: creators.length
  }, 'GameTick');

  // Generate posts with timestamps spread across the tick interval (60 seconds)
  const tickDurationMs = 60000; // 1 minute
  const timeSlotMs = tickDurationMs / postsToGenerate;

  // Generate all posts in parallel
  const postPromises = Array.from({ length: Math.min(postsToGenerate, creators.length) }, async (_, i) => {
    // Check deadline before starting
    if (Date.now() > deadlineMs) {
      logger.debug('Skipping post due to deadline', { index: i }, 'GameTick');
      return { posts: 0, articles: 0 };
    }

    const question = questions[i % questions.length];
    
    if (!question || !question.text) {
      logger.warn('Missing question data', { questionIndex: i }, 'GameTick');
      return { posts: 0, articles: 0 };
    }

    const creator = creators[i];
    if (!creator) {
      logger.warn('Missing creator data', { creatorIndex: i }, 'GameTick');
      return { posts: 0, articles: 0 };
    }

    try {
      // Calculate timestamp for this post (spread throughout the minute)
      const slotOffset = i * timeSlotMs;
      const randomJitter = Math.random() * timeSlotMs * 0.8;
      const timestampWithOffset = new Date(timestamp.getTime() + slotOffset + randomJitter);
      
      if (creator.type === 'actor') {
        // Generate NPC post
        const prompt = `You are ${creator.name}. Write a brief social media post (max 200 chars) about this prediction market question: "${question.text}". Be opinionated and entertaining.

${worldFactsContext}

Return your response as XML in this exact format:
<response>
  <post>your post content here</post>
</response>`;

        const response = await llm.generateJSON<{ post: string } | { response: { post: string } }>(
          prompt,
          {
            properties: {
              post: { type: 'string' },
            },
            required: ['post'],
          },
          { temperature: 0.9, maxTokens: 200, model: 'moonshotai/kimi-k2-instruct-0905', format: 'xml' }
        );
        
        // Handle XML structure
        const postContent = 'response' in response && response.response && typeof response.response === 'object' && 'post' in response.response
          ? (response.response as { post: string }).post
          : (response as { post: string }).post;

        if (!postContent) {
          logger.warn('Empty post generated', { creatorIndex: i, creatorName: creator.name }, 'GameTick');
          return { posts: 0, articles: 0 };
        }

        await db.createPostWithAllFields({
          id: await generateSnowflakeId(),
          content: postContent,
          authorId: creator.id,
          gameId: 'continuous',
          dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
          timestamp: timestampWithOffset,
        });
        
        logger.debug('Created NPC post', { actor: creator.name, timestamp: timestampWithOffset }, 'GameTick');
        return { posts: 1, articles: 0 };

      } else {
        // Organization content - can be either article or regular post
        // 10% chance to create article, 90% chance to create regular post
        const shouldCreateArticle = Math.random() < 0.1;
        
        if (shouldCreateArticle) {
          // Generate organization article
          const prompt = `You are ${creator.name}, a news organization. Write a comprehensive news article about this prediction market: "${question.text}".

${worldFactsContext}

Provide:
- "title": a compelling headline (max 100 characters)
- "summary": a succinct 2-3 sentence summary for social feeds (max 400 characters)
- "article": a full-length article body (at least 4 paragraphs) with concrete details, analysis, and optional quotes. The article should read like a professional newsroom piece, not bullet points. Separate paragraphs with \\n\\n (two newlines).

Return your response as XML in this exact format:
<response>
  <title>news headline here</title>
  <summary>2-3 sentence summary here</summary>
  <article>full article body here with \\n\\n between paragraphs</article>
</response>`;

          const response = await llm.generateJSON<{ title: string; summary: string; article: string } | { response: { title: string; summary: string; article: string } }>(
            prompt,
            { 
              properties: {
                title: { type: 'string' },
                summary: { type: 'string' },
                article: { type: 'string' }
              },
              required: ['title', 'summary', 'article'] 
            },
            { temperature: 0.7, maxTokens: 1000, model: 'moonshotai/kimi-k2-instruct-0905', format: 'xml' }
          );
          
          // Handle XML structure
          const articleData = 'response' in response && response.response 
            ? response.response as { title: string; summary: string; article: string }
            : response as { title: string; summary: string; article: string };

          if (!articleData.title || !articleData.summary || !articleData.article) {
            logger.warn('Empty article generated', { creatorIndex: i, creatorName: creator.name }, 'GameTick');
            return { posts: 0, articles: 0 };
          }

          const summary = articleData.summary.trim();
          const articleTitle = articleData.title.trim();
          const articleBody = articleData.article.trim();

          if (articleBody.length < 400) {
            logger.warn('Article body too short', { creatorIndex: i, creatorName: creator.name, length: articleBody.length }, 'GameTick');
            return { posts: 0, articles: 0 };
          }

          await db.createPostWithAllFields({
            id: await generateSnowflakeId(),
            type: 'article',
            content: summary,
            fullContent: articleBody,
            articleTitle: articleTitle,
            authorId: creator.id,
            gameId: 'continuous',
            dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
            timestamp: timestampWithOffset,
          });
          
          logger.debug('Created org article', { org: creator.name, timestamp: timestampWithOffset }, 'GameTick');
          return { posts: 1, articles: 1 };
        } else {
          // Generate regular post from news organization (announcement, quick update, etc.)
          const prompt = `You are ${creator.name}, a news organization. Post a brief social media update about this prediction market: "${question.text}".

${worldFactsContext}

This should be a SHORT social media post (max 200 characters), not a full article. Examples:
- "Breaking: New developments in [topic]"
- "Just released: Our latest analysis on [topic]"
- "What we're watching: [brief insight]"

Return your response as XML in this exact format:
<response>
  <post>your brief post content here</post>
</response>`;

          const response = await llm.generateJSON<{ post: string } | { response: { post: string } }>(
            prompt,
            {
              properties: {
                post: { type: 'string' },
              },
              required: ['post'],
            },
            { temperature: 0.9, maxTokens: 200, model: 'moonshotai/kimi-k2-instruct-0905', format: 'xml' }
          );
          
          // Handle XML structure
          const orgPostContent = 'response' in response && response.response && typeof response.response === 'object' && 'post' in response.response
            ? (response.response as { post: string }).post
            : (response as { post: string }).post;

          if (!orgPostContent) {
            logger.warn('Empty org post generated', { creatorIndex: i, creatorName: creator.name }, 'GameTick');
            return { posts: 0, articles: 0 };
          }

          await db.createPostWithAllFields({
            id: await generateSnowflakeId(),
            type: 'post', // Regular post, not article
            content: orgPostContent,
            authorId: creator.id,
            gameId: 'continuous',
            dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
            timestamp: timestampWithOffset,
          });
          
          logger.debug('Created org post', { org: creator.name, timestamp: timestampWithOffset }, 'GameTick');
          return { posts: 1, articles: 0 };
        }
      }
    } catch (error) {
      logger.error(
        'Failed to generate post',
        { error, questionIndex: i, creatorId: creator?.id, creatorName: creator?.name, questionId: question?.id },
        'GameTick'
      );
      return { posts: 0, articles: 0 };
    }
  });

  // Wait for all posts to complete
  const results = await Promise.allSettled(postPromises);
  
  // Aggregate results
  let postsCreated = 0;
  let articlesCreated = 0;
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      postsCreated += result.value.posts;
      articlesCreated += result.value.articles;
    }
  }

  logger.info('Mixed post generation complete', { 
    postsCreated, 
    articlesCreated,
    actorsAvailable: actors.length, 
    orgsAvailable: organizations.length,
    attempted: postPromises.length,
    successful: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  }, 'GameTick');

  return { posts: postsCreated, articles: articlesCreated };
}

/**
 * Generates multiple articles concurrently to maximize throughput
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
    logger.info('No recent events - generating baseline articles in parallel', {}, 'GameTick');
    const newsOrgs = await prisma.organization.findMany({
      where: { type: 'media' },
      take: 5,
    });
    
    if (newsOrgs.length === 0) {
      logger.warn('No news organizations found for baseline articles', {}, 'GameTick');
      return 0;
    }
    
    return await generateBaselineArticlesParallel(newsOrgs, timestamp, llm, deadlineMs);
  }

  // Get news organizations and actors in parallel
  const [newsOrgs, actors] = await Promise.all([
    prisma.organization.findMany({
      where: { type: 'media' },
    }),
    prisma.actor.findMany({
      take: 50,
      orderBy: { tier: 'asc' }, // Higher tier actors first
    }),
  ]);

  if (newsOrgs.length === 0) {
    logger.warn('No news organizations found for article generation', {}, 'GameTick');
    return 0;
  }

  if (actors.length === 0) {
    logger.warn('No actors found for article generation', {}, 'GameTick');
    return 0;
  }

  // Initialize article generator
  const articleGen = new ArticleGenerator(llm);

  // Generate up to 10 articles in parallel (increased from 3)
  const articlesToGenerate = Math.min(10, recentEvents.length);
  const eventsTocover = recentEvents.slice(0, articlesToGenerate);

  logger.info(`Generating ${articlesToGenerate} articles in parallel`, { 
    eventCount: recentEvents.length 
  }, 'GameTick');

  // Map organization and actor data once
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
    .filter((a: typeof actors[number]) => a && a.id && a.name)
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
      initialLuck: (a.initialLuck as 'low' | 'medium' | 'high') || 'medium',
      initialMood: a.initialMood || 0,
    }));

  // Generate articles in parallel with Promise.allSettled to handle failures gracefully
  const articlePromises = eventsTocover.map(async (event: {
    id: string;
    eventType: string;
    description: string;
    actors: unknown;
    relatedQuestion: number | null;
    visibility: string;
    dayNumber: number | null;
  }) => {
    // Check deadline before starting each article
    if (Date.now() > deadlineMs) {
      logger.debug('Skipping article due to deadline', { eventId: event.id }, 'GameTick');
      return 0;
    }

    try {
      const worldEvent: WorldEvent = {
        id: event.id,
        type: event.eventType as WorldEvent['type'],
        description: event.description,
        actors: event.actors as string[] || [],
        relatedQuestion: event.relatedQuestion || undefined,
        visibility: event.visibility as WorldEvent['visibility'],
        day: event.dayNumber || 0,
      };

      const articles = await articleGen.generateArticlesForEvent(
        worldEvent,
        organizations,
        actorList,
        []
      );

      let created = 0;
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
          id: await generateSnowflakeId(),
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
        created++;
      }
      
      return created;
    } catch (error) {
      logger.error(
        'Failed to generate article from event',
        { error, eventId: event.id },
        'GameTick'
      );
      return 0;
    }
  });

  // Wait for all article generation to complete
  const results = await Promise.allSettled(articlePromises);
  
  // Count successful articles
  const articlesCreated = results.reduce((sum, result) => {
    if (result.status === 'fulfilled') {
      return sum + result.value;
    }
    return sum;
  }, 0);

  logger.info(`Parallel article generation complete`, { 
    articlesCreated,
    attempted: articlesToGenerate,
    successful: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  }, 'GameTick');

  return articlesCreated;
}

/**
 * Generate baseline articles in parallel (optimized version)
 */
async function generateBaselineArticlesParallel(
  newsOrgs: Array<{ id: string; name: string | null; description: string | null }>,
  timestamp: Date,
  llm: BabylonLLMClient,
  deadlineMs: number
): Promise<number> {
  const baselineTopics = [
    { topic: "the current state of prediction markets", category: "finance" },
    { topic: "upcoming trends in tech and politics", category: "tech" },
    { topic: "volatility in crypto markets", category: "finance" },
    { topic: "major developments to watch this week", category: "business" },
    { topic: "the state of global markets", category: "finance" },
  ];
  
  const articlesToGenerate = Math.min(5, newsOrgs.length);
  
  logger.info(`Generating ${articlesToGenerate} baseline articles in parallel`, {}, 'GameTick');

  // Generate all articles in parallel
  const articlePromises = Array.from({ length: articlesToGenerate }, async (_, i) => {
    if (Date.now() > deadlineMs) {
      logger.debug('Skipping baseline article due to deadline', { index: i }, 'GameTick');
      return 0;
    }
    
    const org = newsOrgs[i];
    if (!org || !org.name) return 0;
    
    const topicData = baselineTopics[i % baselineTopics.length];
    if (!topicData) return 0;
    
    try {
      const prompt = `You are ${org.name}, a news organization. Write a detailed news article about ${topicData.topic}.

Your article should include:
- A compelling headline (max 100 chars)
- A 2-3 sentence summary for the article listing (max 400 chars)
- A full article body of at least 4 paragraphs with clear context, quotes or sourced details where appropriate, and a professional newsroom tone
- Be professional and informative
- Match the tone of a ${org.description || 'news organization'}
- Separate paragraphs with \\n\\n (two newlines)

Return your response as XML in this exact format:
<response>
  <title>compelling headline here</title>
  <summary>2-3 sentence summary here</summary>
  <article>full article body here with \\n\\n between paragraphs</article>
</response>`;
      
      const response = await llm.generateJSON<{ title: string; summary: string; article: string } | { response: { title: string; summary: string; article: string } }>(
        prompt,
        { properties: { title: { type: 'string' }, summary: { type: 'string' }, article: { type: 'string' } }, required: ['title', 'summary', 'article'] },
        { temperature: 0.7, maxTokens: 1100, model: 'moonshotai/kimi-k2-instruct-0905', format: 'xml' }
      );
      
      // Handle XML structure
      const baselineArticle = 'response' in response && response.response 
        ? response.response as { title: string; summary: string; article: string }
        : response as { title: string; summary: string; article: string };
      
      if (!baselineArticle.title || !baselineArticle.summary || !baselineArticle.article) return 0;

      const summary = baselineArticle.summary.trim();
      const articleTitle = baselineArticle.title.trim();
      const articleBody = baselineArticle.article.trim();

      if (articleBody.length < 400) {
        logger.warn('Baseline article body too short', { orgId: org.id, length: articleBody.length }, 'GameTick');
        return 0;
      }
      
      // Calculate timestamp with jitter
      const timeSlotMs = 60000 / articlesToGenerate;
      const slotOffset = i * timeSlotMs;
      const randomJitter = Math.random() * timeSlotMs * 0.8;
      const timestampWithOffset = new Date(timestamp.getTime() + slotOffset + randomJitter);
      
      await db.createPostWithAllFields({
        id: await generateSnowflakeId(),
        type: 'article',
        content: summary,
        fullContent: articleBody,
        articleTitle: articleTitle,
        category: topicData.category,
        authorId: org.id,
        gameId: 'continuous',
        dayNumber: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
        timestamp: timestampWithOffset,
      });
      
      logger.debug('Created baseline article', { org: org.name, topic: topicData.topic }, 'GameTick');
      return 1;
    } catch (error) {
      logger.warn('Failed to generate baseline article', { error, orgId: org.id }, 'GameTick');
      return 0;
    }
  });
  
  // Wait for all baseline articles to complete
  const results = await Promise.allSettled(articlePromises);
  
  const articlesCreated = results.reduce((sum, result) => {
    if (result.status === 'fulfilled') {
      return sum + result.value;
    }
    return sum;
  }, 0);
  
  logger.info('Parallel baseline article generation complete', { 
    articlesCreated,
    attempted: articlesToGenerate 
  }, 'GameTick');
  
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
    const question = questions[i];

    if (!question || !question.text) {
      logger.warn(
        'Missing question data for event',
        { questionIndex: i },
        'GameTick'
      );
      continue;
    }

    // Validate integer fields to prevent overflow
    const questionNum = typeof question.questionNumber === 'number' && 
      Number.isFinite(question.questionNumber) && 
      question.questionNumber >= 0 && 
      question.questionNumber <= 2147483647 
      ? question.questionNumber 
      : undefined;
      
    const dayNum = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const safeDayNumber = dayNum >= 0 && dayNum <= 2147483647 ? dayNum : undefined;

    await prisma.worldEvent.create({
      data: {
        id: await generateSnowflakeId(),
        eventType: 'announcement',
        description: `Development regarding: ${question.text}`,
        actors: [],
        relatedQuestion: questionNum,
        visibility: 'public',
        gameId: 'continuous',
        dayNumber: safeDayNumber,
        timestamp: timestamp,
      },
    });
    eventsCreated++;
  }

  return eventsCreated;
}


/**
 * Update market prices based on NPC trading activity
 * 
 * Prices are derived from total NPC holdings (investment-based pricing):
 * - More NPCs buying/holding = higher price
 * - NPCs selling = lower price
 * - Price reflects actual capital deployed, not just sentiment
 */
async function updateMarketPricesFromTrades(
  _timestamp: Date,
  executionResult: ExecutionResult
): Promise<number> {
  if (!executionResult.executedTrades.length) {
    return 0;
  }

  // Get all companies with current holdings
  const companies = await prisma.organization.findMany({
    where: { type: 'company' },
    select: {
      id: true,
      name: true,
      currentPrice: true,
      initialPrice: true,
    },
  });

  type CompanyData = typeof companies[0];
  // Use raw org IDs as keys since positions now store raw IDs
  const companyMap = new Map<string, CompanyData>(
    companies.map((c: CompanyData) => [c.id, c])
  );

  // Calculate total holdings for each company from ALL positions
  const holdingsByTicker = new Map<string, number>();
  
  const allPositions = await prisma.poolPosition.findMany({
    where: {
      marketType: 'perp',
      closedAt: null,
      ticker: { not: null },
    },
    select: {
      ticker: true,
      side: true,
      size: true,
    },
  });

  for (const pos of allPositions) {
    if (!pos.ticker) continue;
    
    const current = holdingsByTicker.get(pos.ticker) || 0;
    // Long positions add to holdings, short positions subtract
    const delta = pos.side === 'long' ? pos.size : -pos.size;
    holdingsByTicker.set(pos.ticker, current + delta);
  }

  let updates = 0;

  // Update prices based on total capital deployed
  // Market cap = initialPrice × syntheticSupply + totalDeployed
  // ticker is now a raw org ID, not a transformed ticker
  for (const [ticker, netHoldings] of holdingsByTicker) {
    const company = companyMap.get(ticker);
    if (!company) continue;

    const initialPrice = company.initialPrice ?? 100;
    const currentPrice = company.currentPrice ?? initialPrice;
    
    // Fixed synthetic supply per company
    const syntheticSupply = 10000;
    const baseMarketCap = initialPrice * syntheticSupply; // e.g. $100 × 10k = $1M
    
    // Market cap increases with net long holdings
    const newMarketCap = baseMarketCap + netHoldings;
    
    // Price = marketCap / supply, with floor and ceiling
    const rawPrice = newMarketCap / syntheticSupply;
    const minPrice = initialPrice * 0.1; // Floor: 90% max drop
    const maxPrice = currentPrice * 2.0; // Cap: 100% max gain per tick
    const newPrice = Math.max(minPrice, Math.min(rawPrice, maxPrice));
    
    const change = newPrice - currentPrice;
    const changePercent = currentPrice > 0 ? (change / currentPrice) * 100 : 0;

    // Only update if price actually changed
    if (Math.abs(change) < 0.01) continue;

    await prisma.organization.update({
      where: { id: company.id },
      data: { currentPrice: newPrice },
    });

    await db.recordPriceUpdate(company.id, newPrice, change, changePercent);

    logger.info(
      `Price update for ${ticker}: ${currentPrice.toFixed(2)} -> ${newPrice.toFixed(2)} (${changePercent.toFixed(2)}%) [holdings: $${netHoldings.toFixed(0)}]`,
      { ticker, currentPrice, newPrice, netHoldings, marketCap: newMarketCap },
      'GameTick'
    );

    updates++;
  }

  return updates;
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

  // Get world facts context once for all questions
  const worldFactsContext = await worldFactsService.generatePromptContext();

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

${worldFactsContext}

Use the world context above to make relevant, timely questions that reflect current reality (in our satirical universe).

Return your response as XML in this exact format:
<response>
  <question>Will X happen?</question>
  <resolutionCriteria>Clear criteria for resolution</resolutionCriteria>
</response>`;

    let response: { question: string; resolutionCriteria: string } | { response: { question: string; resolutionCriteria: string } } | null = null;
    let questionData: { question: string; resolutionCriteria: string } | null = null;
    
    try {
      response = await llm.generateJSON<{
        question: string;
        resolutionCriteria: string;
      } | { response: { question: string; resolutionCriteria: string } }>(
        prompt,
        {
          properties: {
            question: { type: 'string' },
            resolutionCriteria: { type: 'string' },
          },
          required: ['question', 'resolutionCriteria'],
        },
        { temperature: 0.8, maxTokens: 300, model: 'moonshotai/kimi-k2-instruct-0905', format: 'xml' }
      );
      
      // Handle XML structure - extract question data from response
      questionData = response && 'response' in response && response.response
        ? response.response as { question: string; resolutionCriteria: string }
        : response as { question: string; resolutionCriteria: string };
    } catch (error) {
      logger.warn(
        'Failed to generate new question via LLM',
        { error },
        'GameTick'
      );
      continue;
    }

    if (!questionData?.question) {
      continue;
    }

    const resolutionDate = new Date();
    resolutionDate.setDate(resolutionDate.getDate() + 3);

    const lastQuestion = await prisma.question.findFirst({
      orderBy: { questionNumber: 'desc' },
    });
    const nextQuestionNumber = (lastQuestion?.questionNumber || 0) + 1;

    const scenarioId = 1; // TODO: replace with dynamic scenario selection when schema supports it

    const now = new Date();
    const question = await prisma.question.create({
      data: {
        id: await generateSnowflakeId(),
        questionNumber: nextQuestionNumber,
        text: questionData.question,
        scenarioId,
        outcome: Math.random() > 0.5,
        rank: 1,
        resolutionDate,
        status: 'active',
        updatedAt: now,
      },
    });

    const market = await prisma.market.create({
      data: {
        id: question.id,
        question: questionData.question,
        description: questionData.resolutionCriteria,
        liquidity: 1000,
        endDate: resolutionDate,
        gameId: 'continuous',
        updatedAt: now,
      },
    });

    // Create market on-chain if it doesn't have onChainMarketId
    if (!market.onChainMarketId) {
      const { ensureMarketOnChain } = await import('./services/onchain-market-service');
      await ensureMarketOnChain(market.id).catch((error) => {
        logger.warn('Failed to create market on-chain (non-blocking)', { error, marketId: market.id }, 'GameTick');
      });
    }

    questionsCreated++;
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

  // Resolve market on-chain if onChainMarketId exists
  let onChainResolutionTxHash: string | null = null;
  if (market.onChainMarketId && !market.onChainResolved) {
    try {
      onChainResolutionTxHash = await resolveMarketOnChain(
        market.onChainMarketId,
        question.outcome ? 1 : 0 // Binary market: true = 1, false = 0
      );
    } catch (error) {
      logger.error(
        'Failed to resolve market on-chain',
        {
          error: error instanceof Error ? error.message : String(error),
          marketId: market.id,
          onChainMarketId: market.onChainMarketId,
          questionNumber,
        },
        'GameTick'
      );
      // Continue with database resolution even if on-chain fails
    }
  }

  // Mark market as resolved
  await prisma.market.update({
    where: { id: market.id },
    data: {
      resolved: true,
      resolution: question.outcome,
      onChainResolved: onChainResolutionTxHash !== null,
      onChainResolutionTxHash: onChainResolutionTxHash,
    },
  });
}

/**
 * Resolve market on-chain via PredictionMarketFacet
 */
async function resolveMarketOnChain(
  onChainMarketId: string,
  winningOutcome: number
): Promise<string> {
  const diamondAddress = process.env.NEXT_PUBLIC_DIAMOND_ADDRESS;
  const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

  if (!diamondAddress || !deployerPrivateKey || !rpcUrl) {
    throw new Error('Missing blockchain configuration');
  }

  const { createPublicClient, createWalletClient, http } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { baseSepolia } = await import('viem/chains');
  const { PREDICTION_MARKET_ABI } = await import('@/lib/web3/abis');

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  const account = privateKeyToAccount(deployerPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  // Resolve market on-chain
  // Note: winningOutcome must be uint8 (0 or 1 for binary markets)
  const txHash = await walletClient.writeContract({
    address: diamondAddress as `0x${string}`,
    abi: PREDICTION_MARKET_ABI,
    functionName: 'resolveMarket',
    args: [onChainMarketId as `0x${string}`, winningOutcome as number],
  });

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });

  return txHash;
}

/**
 * Publish question commitments to blockchain oracle
 */
async function publishOracleCommitments(
  questions: Array<{ id: string; questionNumber: number; text: string; outcome: boolean }>
): Promise<{ committed: number; errors: number }> {
  let committed = 0;
  let errors = 0;

  // Check if oracle is configured
  if (!process.env.NEXT_PUBLIC_BABYLON_ORACLE || !process.env.ORACLE_PRIVATE_KEY) {
    logger.info('Oracle not configured, skipping commitments', undefined, 'GameTick');
    return { committed: 0, errors: 0 };
  }

  try {
    const oracleService = getOracleService();

    // Health check
    const health = await oracleService.healthCheck();
    if (!health.healthy) {
      logger.error(`Oracle health check failed: ${health.error}`, undefined, 'GameTick');
      return { committed: 0, errors: questions.length };
    }

    // Batch commit games
    const batch = questions.map(q => ({
      questionId: q.id,
      questionNumber: q.questionNumber,
      question: q.text,
      category: 'general', // Could extract from question text
      outcome: q.outcome
    }));

    const result = await oracleService.batchCommitGames(batch);

    // Update questions with oracle data
    for (const success of result.successful) {
      try {
        await prisma.question.update({
          where: { id: success.questionId },
          data: {
            oracleSessionId: success.sessionId,
            oracleCommitment: success.commitment,
            oracleCommitTxHash: success.txHash,
            oracleCommitBlock: success.blockNumber || null
          }
        });
        committed++;
      } catch (error) {
        logger.error(
          'Failed to update question with oracle data',
          { error, questionId: success.questionId },
          'GameTick'
        );
      }
    }

    errors = result.failed.length;

    if (errors > 0) {
      logger.warn(
        `${errors} oracle commits failed`,
        { failures: result.failed },
        'GameTick'
      );
    }

    logger.info(
      `Oracle commits: ${committed} successful, ${errors} failed`,
      undefined,
      'GameTick'
    );
  } catch (error) {
    logger.error('Oracle batch commit failed', { error }, 'GameTick');
    errors = questions.length;
  }

  return { committed, errors };
}

/**
 * Publish question reveals to blockchain oracle
 */
async function publishOracleReveals(
  questions: Array<{ id: string; outcome: boolean }>
): Promise<{ revealed: number; errors: number }> {
  let revealed = 0;
  let errors = 0;

  // Check if oracle is configured
  if (!process.env.NEXT_PUBLIC_BABYLON_ORACLE || !process.env.ORACLE_PRIVATE_KEY) {
    logger.info('Oracle not configured, skipping reveals', undefined, 'GameTick');
    return { revealed: 0, errors: 0 };
  }

  try {
    const oracleService = getOracleService();

    // Health check
    const health = await oracleService.healthCheck();
    if (!health.healthy) {
      logger.error(`Oracle health check failed: ${health.error}`, undefined, 'GameTick');
      return { revealed: 0, errors: questions.length };
    }

    // Batch reveal games
    const batch = questions.map(q => ({
      questionId: q.id,
      outcome: q.outcome,
      winners: [], // Could get from positions
      totalPayout: BigInt(0) // Could calculate from positions
    }));

    const result = await oracleService.batchRevealGames(batch);

    // Update questions with oracle data
    for (const success of result.successful) {
      try {
        await prisma.question.update({
          where: { id: success.questionId },
          data: {
            oracleRevealTxHash: success.txHash,
            oracleRevealBlock: success.blockNumber || null,
            oraclePublishedAt: new Date()
          }
        });
        revealed++;
      } catch (error) {
        logger.error(
          'Failed to update question with reveal data',
          { error, questionId: success.questionId },
          'GameTick'
        );
      }
    }

    errors = result.failed.length;

    if (errors > 0) {
      logger.warn(
        `${errors} oracle reveals failed`,
        { failures: result.failed },
        'GameTick'
      );
    }

    logger.info(
      `Oracle reveals: ${revealed} successful, ${errors} failed`,
      undefined,
      'GameTick'
    );
  } catch (error) {
    logger.error('Oracle batch reveal failed', { error }, 'GameTick');
    errors = questions.length;
  }

  return { revealed, errors };
}
/**
 * Update widget caches
 * This pre-generates and caches widget data to improve performance
 */
async function updateWidgetCaches(): Promise<number> {
  let cachesUpdated = 0;

  const companies = await db.getCompanies();

  if (!companies || companies.length === 0) {
    logger.warn('No companies found for widget cache update', {}, 'GameTick');
    return 0;
  }

  const perpMarketsWithStats = await Promise.all(
    companies
      .filter((company: typeof companies[number]) => company && company.id && company.name) // Filter out invalid companies
      .map(async (company: typeof companies[number]) => {
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
        Actor: {
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

        // Safely extract Actor name with multiple fallbacks
        let npcActorName = 'Unknown';
        try {
          if (
            pool.Actor &&
            typeof pool.Actor === 'object' &&
            'name' in pool.Actor
          ) {
            npcActorName = pool.Actor.name || 'Unknown';
          }
        } catch (e) {
          logger.warn(
            'Failed to extract Actor name',
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
        id: market.id, // Keep as Snowflake string, don't convert to int
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
    const cacheData = {
      topPerpGainers,
      topPoolGainers,
      topVolumeQuestions,
      lastUpdated: new Date().toISOString(),
    };

  await prisma.widgetCache.upsert({
    where: { widget: 'markets' },
    create: {
      widget: 'markets',
      data: cacheData as object,
    },
    update: {
      data: cacheData as object,
      updatedAt: new Date(),
    },
  });

  cachesUpdated++;
  logger.info('Updated markets widget cache', {}, 'GameTick');

  return cachesUpdated;
}

/**
 * Force trending calculation (for first tick with baseline posts)
 * Waits a few seconds for tags to be generated from posts, then calculates trending
 */
async function forceTrendingCalculation(): Promise<boolean> {
  logger.info('Forcing trending calculation (first tick)', {}, 'GameTick');
  
  // Wait 3 seconds for tag generation to complete (tags are generated async)
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Import and call trending calculation directly
  const { calculateTrendingTags } = await import('./services/trending-calculation-service');
  await calculateTrendingTags();
  
  logger.info('Forced trending calculation complete', {}, 'GameTick');
  return true;
}
