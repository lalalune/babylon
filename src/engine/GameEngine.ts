/**
 * Babylon Game Engine
 * 
 * Core simulation engine that generates prediction markets, events, posts, and group chat discussions.
 * 
 * KEY FEATURES:
 * - Events are specific to prediction questions
 * - Posts use LLM to generate real content about events
 * - Time-aware: clue strength increases as resolution approaches
 * - Resolution events definitively prove outcomes
 * - Group chats discuss active predictions with insider perspectives
 * - Friend-of-friends group membership model
 * - Satirical LLM-generated group chat names
 */

import { logger } from '@/lib/logger';
import { generateSnowflakeId } from '@/lib/snowflake';
import { ActorSocialActions } from '@/lib/services/ActorSocialActions';
import { FollowInitializer } from '@/lib/services/FollowInitializer';
import { RelationshipManager } from '@/lib/services/RelationshipManager';
import { broadcastChatMessage, broadcastToChannel } from '@/lib/sse/event-broadcaster';
import type {
  Actor,
  ActorConnection,
  ActorsDatabase,
  ActorTier,
  ChatMessage,
  FeedPost,
  GroupChat,
  Organization,
  PriceUpdate,
  Question,
  Scenario,
  SelectedActor,
  WorldEvent,
} from '@/shared/types';
import { shuffleArray, toQuestionIdNumber, toQuestionIdNumberOrNull } from '@/shared/utils';
import type { JsonValue } from '@/types/common';
import { Prisma } from '@prisma/client';
import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BabylonLLMClient } from '../generator/llm/openai-client';
import { db } from '../lib/database-service';
import { ReputationService } from '../lib/services/reputation-service';
import { CompletionFormat, type TradeMetrics } from '../lib/reputation/reputation-service';
import { A2AGameIntegration, type A2AGameConfig } from './A2AGameIntegration';
import { FeedGenerator } from './FeedGenerator';
import { PerpetualsEngine } from './PerpetualsEngine';
import { PriceEngine } from './PriceEngine';
import { QuestionManager } from './QuestionManager';
import { MarketDecisionEngine } from './MarketDecisionEngine';
import { MarketContextService } from '@/lib/services/market-context-service';
import { TradeExecutionService } from '@/lib/services/trade-execution-service';
import { GroupChatSweep } from '@/lib/services/group-chat-sweep';
import type { ExecutionResult } from '@/types/market-decisions';

interface GameConfig {
  tickIntervalMs?: number;
  postsPerTick?: number;
  historyDays?: number;
  savePath?: string;
  a2a?: A2AGameConfig;
}

interface Tick {
  timestamp: string;
  posts: FeedPost[];
  priceUpdates: PriceUpdate[];
  events: WorldEvent[];
  groupChatMessages: Record<string, ChatMessage[]>;
  questionsResolved: number;
  questionsCreated: number;
}

export class GameEngine extends EventEmitter {
  private config: Required<GameConfig>;
  private llm: BabylonLLMClient;
  private feedGenerator: FeedGenerator;
  private questionManager: QuestionManager;
  private priceEngine: PriceEngine;
  private perpsEngine: PerpetualsEngine;
  private a2aIntegration: A2AGameIntegration;
  private marketDecisionEngine: MarketDecisionEngine;
  private marketContextService: MarketContextService;
  private tradeExecutionService: TradeExecutionService;

  private actors: SelectedActor[] = [];
  private organizations: Organization[] = [];
  private scenarios: Scenario[] = [];
  private questions: Question[] = [];
  private connections: ActorConnection[] = [];
  private groupChats: GroupChat[] = [];

  private recentTicks: Tick[] = [];
  private isRunning = false;
  private initialized = false;
  private intervalId?: NodeJS.Timeout;
  private fundingIntervalId?: NodeJS.Timeout;
  private dailySnapshotIntervalId?: NodeJS.Timeout;
  private lastChatSweep: string = new Date().toISOString().split('T')[0]!;
  private luckMood: Map<string, { luck: string; mood: number }> = new Map();
  private lastDailySnapshot: string = new Date().toISOString().split('T')[0]!;

  private static readonly GAME_START_DATE = new Date('2025-10-01T00:00:00Z');
  private static readonly GAME_ID = 'babylon';

  constructor(config?: GameConfig) {
    super();

    this.config = {
      tickIntervalMs: config?.tickIntervalMs || 60000,
      postsPerTick: config?.postsPerTick || 15,
      historyDays: config?.historyDays || 30,
      savePath: config?.savePath || join(process.cwd(), 'games', 'babylon'),
      a2a: config?.a2a ?? { enabled: false },
    };

    this.llm = new BabylonLLMClient();
    this.feedGenerator = new FeedGenerator(this.llm);
    this.questionManager = new QuestionManager(this.llm);
    this.priceEngine = new PriceEngine(Date.now());
    this.perpsEngine = new PerpetualsEngine();
    this.a2aIntegration = new A2AGameIntegration(this.config.a2a);
    this.marketContextService = new MarketContextService();
    this.tradeExecutionService = new TradeExecutionService();
    this.marketDecisionEngine = new MarketDecisionEngine(this.llm, this.marketContextService);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    logger.info('INITIALIZING GAME ENGINE', undefined, 'GameEngine');

    // Load actors from HTTP endpoint
    logger.info('Loading actors from HTTP...', undefined, 'GameEngine');
    let actorsData: ActorsDatabase;
    
    try {
      // Try to fetch from the public endpoint
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/data/actors.json`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      actorsData = await response.json() as ActorsDatabase;
      logger.info('Successfully loaded actors from HTTP', undefined, 'GameEngine');
    } catch (httpError) {
      // Fallback to file system if HTTP fails (useful for local development)
      const errorMessage = httpError instanceof Error ? httpError.message : String(httpError);
      logger.warn(`Failed to load actors from HTTP (${errorMessage}), falling back to file system`, { error: httpError }, 'GameEngine');
      
      const actorsPath = join(process.cwd(), 'public/data/actors.json');
      actorsData = JSON.parse(readFileSync(actorsPath, 'utf-8')) as ActorsDatabase;
      logger.info('Loaded actors from file system (fallback)', undefined, 'GameEngine');
    }

    this.actors = this.selectAllActors(actorsData.actors);
    logger.info(`Loaded ${this.actors.length} actors`, { actorCount: this.actors.length }, 'GameEngine');

    logger.info('Initializing organizations and prices...', undefined, 'GameEngine');
    this.organizations = actorsData.organizations;
    this.priceEngine.initializeCompanies(this.organizations);
    this.perpsEngine.initializeMarkets(this.organizations);
    const companies = this.organizations.filter(o => o.type === 'company');
    logger.info(`Initialized ${companies.length} company prices`, { companyCount: companies.length }, 'GameEngine');

    await this.syncDatabaseState();

    // Initialize actor relationships and follows
    logger.info('Initializing actor relationships...', undefined, 'GameEngine');
    await this.initializeActorRelationships();

    logger.info('Generating scenarios...', undefined, 'GameEngine');
    this.scenarios = await this.generateScenarios();
    logger.info(`Generated ${this.scenarios.length} scenarios`, { scenarioCount: this.scenarios.length }, 'GameEngine');

    logger.info('Loading actor connections from relationships...', undefined, 'GameEngine');
    this.connections = await this.loadConnectionsFromRelationships();
    logger.info(`Loaded ${this.connections.length} relationships`, { connectionCount: this.connections.length }, 'GameEngine');

    logger.info('Creating group chats...', undefined, 'GameEngine');
    this.groupChats = await this.createGroupChats();
    logger.info(`Created ${this.groupChats.length} group chats`, { groupChatCount: this.groupChats.length }, 'GameEngine');

    // Persist group chats to database
    await this.syncGroupChatsToDatabase();

    this.initializeLuckMood();
    this.feedGenerator.setOrganizations(this.organizations);

    await this.loadHistory();

    if (this.questions.length === 0) {
      logger.info('Generating initial questions...', undefined, 'GameEngine');
      const newQuestions = await this.generateQuestions(5);
      this.questions.push(...newQuestions);
      logger.info(`Generated ${newQuestions.length} questions`, { questionCount: newQuestions.length }, 'GameEngine');
    }

    // Initialize A2A integration
    await this.a2aIntegration.initialize();

    const activeQuestions = this.questions.filter(q => q.status === 'active').length;
    const a2aStatus = this.a2aIntegration.getStatus();
    this.initialized = true;
    logger.info('ENGINE READY', {
      activeQuestions,
      a2aEnabled: a2aStatus.enabled,
      a2aPort: this.config.a2a?.port || 8081
    }, 'GameEngine');
  }

  start(): void {
    if (this.isRunning) return;

    logger.info('STARTING ENGINE', undefined, 'GameEngine');
    this.isRunning = true;

    this.tick().catch(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`Tick error: ${errorMessage}`, { error: errorMessage, stack: errorStack }, 'GameEngine');
    });
    this.intervalId = setInterval(() => {
      this.tick().catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`Tick error: ${errorMessage}`, { error: errorMessage, stack: errorStack }, 'GameEngine');
      });
    }, this.config.tickIntervalMs);

    this.fundingIntervalId = setInterval(() => {
      this.perpsEngine.processFunding();
    }, 8 * 60 * 60 * 1000);

    this.dailySnapshotIntervalId = setInterval(() => {
      this.checkDailySnapshot().catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`Daily snapshot error: ${errorMessage}`, { error: errorMessage, stack: errorStack }, 'GameEngine');
      });
    }, 60 * 1000);

    this.emit('started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    if (this.intervalId) clearInterval(this.intervalId);
    if (this.fundingIntervalId) clearInterval(this.fundingIntervalId);
    if (this.dailySnapshotIntervalId) clearInterval(this.dailySnapshotIntervalId);

    this.isRunning = false;

    // Update game state in database
    try {
      await db.updateGameState({
        lastTickAt: new Date(),
        activeQuestions: this.questions.filter(q => q.status === 'active').length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.warn(`Failed to update game state on stop: ${errorMessage}`, { error: errorMessage, stack: errorStack }, 'GameEngine');
    }

    // Shutdown A2A integration
    await this.a2aIntegration.shutdown();

    this.emit('stopped');
  }

  /**
   * Main tick: Generate content driven by active questions
   */
  private async tick(): Promise<void> {
    const timestamp = new Date().toISOString();
    const currentDate = timestamp.split('T')[0]!;
    
    logger.debug(`Generating tick at ${timestamp}`, { timestamp }, 'GameEngine');

    try {
      // Step 1: Resolve expired questions with resolution events
      const activeQuestions = this.questions.filter(q => q.status === 'active');
      const toResolve = this.questionManager.getQuestionsToResolve(activeQuestions, currentDate);
      
      const resolutionEvents: WorldEvent[] = [];
      if (toResolve.length > 0) {
        logger.info(`Resolving ${toResolve.length} questions`, { count: toResolve.length }, 'GameEngine');
        for (const question of toResolve) {
          // Generate definitive resolution event
          const resolutionEvent: WorldEvent = await this.generateResolutionEvent(question);
          resolutionEvents.push(resolutionEvent);

          const resolved = this.questionManager.resolveQuestion(question, question.outcome);
          const index = this.questions.findIndex(q => q.id === question.id);
          if (index >= 0) {
            this.questions[index] = resolved;
          }

          // Update question status in database
          try {
            await db.resolveQuestion(question.id as string, question.outcome);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            logger.error(`Failed to update question status in database: ${errorMessage}`, { 
              error: errorMessage, 
              stack: errorStack,
              questionId: question.id 
            }, 'GameEngine');
          }

          // Update on-chain reputation for all users who had positions
          logger.info(`Updating on-chain reputation for market ${question.id}`, { questionId: question.id }, 'GameEngine');
          try {
            const reputationUpdates = await ReputationService.updateReputationForResolvedMarket({
              marketId: question.id.toString(),
              outcome: question.outcome,
            });

            const winners = reputationUpdates.filter(u => u.change > 0).length;
            const losers = reputationUpdates.filter(u => u.change < 0).length;
            const errors = reputationUpdates.filter(u => u.error).length;

            logger.info(`Reputation updated: ${winners} winners (+10), ${losers} losers (-5)${errors > 0 ? `, ${errors} errors` : ''}`, {
              winners,
              losers,
              errors,
              questionId: question.id
            }, 'GameEngine');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            logger.error(`Failed to update reputation for market ${question.id}: ${errorMessage}`, {
              error: errorMessage,
              stack: errorStack,
              questionId: question.id
            }, 'GameEngine');
            // Don't fail the entire tick if reputation update fails
          }

          // Auto-generate feedback for all positions in this resolved market
          logger.info(`Generating auto-feedback for resolved market ${question.id}`, { questionId: question.id }, 'GameEngine');
          try {
            // Query all resolved positions for this market
            const positions = await db.prisma.position.findMany({
              where: {
                questionId: toQuestionIdNumber(question.id),
                status: 'resolved',
              },
              include: {
                user: true,
                question: true,
              },
            });

            let successCount = 0;
            let failCount = 0;

            // Generate feedback for each position
            for (const position of positions) {
              try {
                // Calculate trade performance metrics from position data
                const pnl = position.pnl?.toNumber() || 0;
                const amount = position.amount?.toNumber() || 0;
                const profitable = pnl > 0;
                const roi = amount > 0 ? pnl / amount : 0;

                // Calculate holding period (time from creation to resolution)
                const createdAt = position.createdAt;
                const resolvedAt = position.resolvedAt || new Date();
                const holdingPeriodMs = resolvedAt.getTime() - createdAt.getTime();
                const holdingPeriodHours = holdingPeriodMs / (1000 * 60 * 60);

                // Simple timing score: shorter profitable trades are better (0-1 scale)
                const timingScore = profitable
                  ? Math.max(0, Math.min(1, 1 - (holdingPeriodHours / 168))) // Normalize to week
                  : 0.3; // Low score for unprofitable trades

                // Risk score based on position size and outcome (0-1 scale)
                const riskScore = Math.abs(roi) > 0.5 ? 0.8 : 0.5;

                const tradeMetrics: TradeMetrics = {
                  profitable,
                  roi,
                  holdingPeriod: holdingPeriodHours,
                  timingScore,
                  riskScore,
                };

                // Generate trade completion feedback
                await CompletionFormat(
                  position.userId,
                  `position_${position.id}`,
                  tradeMetrics
                );

                successCount++;
              } catch (feedbackError) {
                failCount++;
                const errorMessage = feedbackError instanceof Error ? feedbackError.message : String(feedbackError);
                logger.warn(`Failed to generate feedback for position ${position.id}: ${errorMessage}`, {
                  positionId: position.id,
                  userId: position.userId,
                }, 'GameEngine');
              }
            }

            logger.info(`Auto-feedback generated: ${successCount} success, ${failCount} failed (${positions.length} total positions)`, {
              successCount,
              failCount,
              totalPositions: positions.length,
              questionId: question.id
            }, 'GameEngine');
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            logger.error(`Failed to generate auto-feedback for market ${question.id}: ${errorMessage}`, {
              error: errorMessage,
              stack: errorStack,
              questionId: question.id
            }, 'GameEngine');
            // Don't fail the entire tick if feedback generation fails
          }
        }
      }

      // Step 2: Create new questions
      const currentActive = this.questions.filter(q => q.status === 'active').length;
      let questionsCreated = 0;
      
      if (currentActive < 15) {
        const toCreate = Math.min(3, 20 - currentActive);
        const newQuestions = await this.generateQuestions(toCreate);
        this.questions.push(...newQuestions);
        questionsCreated = newQuestions.length;
        logger.info(`Created ${questionsCreated} new questions`, { count: questionsCreated }, 'GameEngine');
        
        // Broadcast new questions to markets and upcoming-events channels
        if (questionsCreated > 0) {
          try {
            broadcastToChannel('markets', {
              type: 'new_questions',
              count: questionsCreated,
              timestamp: timestamp,
            });
            broadcastToChannel('upcoming-events', {
              type: 'new_questions',
              count: questionsCreated,
              timestamp: timestamp,
            });
          } catch (error) {
            logger.debug('Could not broadcast new questions:', error, 'GameEngine');
          }
        }
      }

      // Step 3: Generate events for active questions
      const events = await this.generateQuestionDrivenEvents(activeQuestions, resolutionEvents);
      
      // Broadcast significant events to breaking-news channel
      if (events.length > 0) {
        try {
          const significantEvents = events.filter(e => 
            e.visibility === 'public' && 
            (e.type.toLowerCase().includes('announcement') || 
             e.type.toLowerCase().includes('development') || 
             e.type.toLowerCase().includes('scandal') ||
             e.type.toLowerCase().includes('deal'))
          );
          for (const event of significantEvents) {
            // Create properly typed event data for broadcast
            // WorldEvent.description is always a string according to the type definition
            const eventDescription = typeof event.description === 'string' 
              ? event.description 
              : '';
            
            const broadcastEvent: Record<string, JsonValue> = {
              type: 'new_event',
              event: {
                id: event.id,
                type: event.type,
                description: eventDescription,
                relatedQuestion: event.relatedQuestion ?? null,
                timestamp: timestamp,
              }
            };
            
            broadcastToChannel('breaking-news', broadcastEvent);
          }
        } catch (error) {
          logger.debug('Could not broadcast events:', error, 'GameEngine');
        }
      }
      
      // Step 4: Update prices based on events
      const priceUpdates = await this.updatePrices(events);
      if (priceUpdates.length > 0) {
        logger.debug(`${priceUpdates.length} price updates`, { count: priceUpdates.length }, 'GameEngine');
        
        const priceMap = new Map<string, number>();
        this.organizations.forEach(org => {
          if (org.type === 'company' && org.currentPrice) {
            priceMap.set(org.id, org.currentPrice);
          }
        });
        this.perpsEngine.updatePositions(priceMap);
        
        // Broadcast price updates to markets channel
        try {
          broadcastToChannel('markets', {
            type: 'price_update',
            count: priceUpdates.length,
            timestamp: timestamp,
          });
        } catch (error) {
          logger.debug('Could not broadcast price updates:', error, 'GameEngine');
        }
      }

      // Step 5: Generate posts using LLM
      const posts = await this.generateLLMPosts(events, activeQuestions);
      logger.info(`Generated ${posts.length} LLM posts`, { count: posts.length }, 'GameEngine');

      // Step 6: Generate group chat messages about questions
      const groupChatMessages = await this.generateGroupChatDiscussions(activeQuestions, events);

      // ===== NEW: Step 7: Generate NPC Market Decisions =====
      logger.info('Generating NPC market decisions...', {}, 'GameEngine');
      const marketDecisions = await this.marketDecisionEngine.generateBatchDecisions();
      
      // ===== NEW: Step 8: Execute Trades =====
      const executionResult = await this.tradeExecutionService.executeDecisionBatch(marketDecisions);
      logger.info(`Executed ${executionResult.successfulTrades} trades`, {
        successful: executionResult.successfulTrades,
        failed: executionResult.failedTrades,
        holds: executionResult.holdDecisions,
      }, 'GameEngine');
      
      // ===== NEW: Step 9: Update Market Prices Based on NPC Trades =====
      logger.info(`Calculating price updates from ${executionResult.executedTrades.length} executed trades...`, {}, 'GameEngine');
      const tradeBasedPriceUpdates = await this.updatePricesFromTrades(executionResult);
      logger.info(`Trade-based price updates: ${tradeBasedPriceUpdates.length}`, { count: tradeBasedPriceUpdates.length }, 'GameEngine');
      
      // Combine event-based and trade-based price updates
      const allPriceUpdates = [...priceUpdates, ...tradeBasedPriceUpdates];
      logger.info(`Total price updates this tick: ${allPriceUpdates.length} (${priceUpdates.length} from events + ${tradeBasedPriceUpdates.length} from trades)`, {}, 'GameEngine');
      
      // Update perps engine with new prices
      if (allPriceUpdates.length > 0) {
        const priceMap = new Map<string, number>();
        this.organizations.forEach(org => {
          if (org.type === 'company' && org.currentPrice) {
            priceMap.set(org.id, org.currentPrice);
          }
        });
        this.perpsEngine.updatePositions(priceMap);
      }

      const tick: Tick = {
        timestamp,
        posts,
        priceUpdates: allPriceUpdates,
        events,
        groupChatMessages,
        questionsResolved: toResolve.length,
        questionsCreated,
      };

      this.recentTicks.push(tick);
      
      const maxTicks = this.config.historyDays * 24 * 60;
      if (this.recentTicks.length > maxTicks) {
        this.recentTicks = this.recentTicks.slice(-maxTicks);
      }

      // Persist tick data FIRST (before broadcasting) to ensure posts are in database
      await this.persistTickData(tick).catch(error => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`Failed to persist tick data: ${errorMessage}`, { 
          error: errorMessage,
          stack: errorStack 
        }, 'GameEngine');
      });

      // Broadcast new posts to feed channel AFTER persistence
      // This ensures posts are available in the database when feed refreshes
      if (posts.length > 0) {
        try {
          for (const post of posts) {
            broadcastToChannel('feed', {
              type: 'new_post',
              post: {
                id: post.id,
                content: post.content,
                authorId: post.author,
                timestamp: post.timestamp || timestamp,
              }
            });
          }
          logger.debug(`Broadcasted ${posts.length} posts to feed channel`, { count: posts.length }, 'GameEngine');
        } catch (error) {
          logger.debug('Could not broadcast posts:', error, 'GameEngine');
        }
      }

      // Broadcast group chat messages to their respective chats
      if (Object.keys(groupChatMessages).length > 0) {
        try {
          for (const [chatId, messages] of Object.entries(groupChatMessages)) {
            for (const msg of messages) {
              broadcastChatMessage(chatId, {
                id: `${chatId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                chatId: chatId,
                senderId: msg.from,
                content: msg.message,
                createdAt: msg.timestamp,
                isGameChat: true,
              });
            }
          }
          logger.debug(`Broadcasted ${Object.values(groupChatMessages).flat().length} group chat messages`, undefined, 'GameEngine');
        } catch (error) {
          logger.debug('Could not broadcast group chat messages:', error, 'GameEngine');
        }
      }

      this.emit('tick', tick);

      // Broadcast market data to A2A agents
      if (this.a2aIntegration.getStatus().enabled) {
        this.a2aIntegration.broadcastMarketData(this.questions, priceUpdates);

        // Broadcast significant events
        for (const event of events) {
          this.a2aIntegration.broadcastGameEvent({
            type: event.type,
            description: event.description,
            relatedQuestion: event.relatedQuestion ?? undefined,
            timestamp: Date.now(),
          });
        }
      }

      // Process random social actions (invites/DMs) every 5 ticks (every ~5 minutes)
      if (this.recentTicks.length % 5 === 0) {
        try {
          await ActorSocialActions.processRandomSocialActions();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          logger.warn('Failed to process social actions', { 
            error: errorMessage,
            stack: errorStack 
          }, 'GameEngine');
        }
      }

      // Run daily group chat sweep
      if (currentDate !== this.lastChatSweep) {
        logger.info('Running daily group chat sweep...', { date: currentDate }, 'GameEngine');
        try {
          const sweepResult = await GroupChatSweep.sweepAllChats();
          logger.info(`Group chat sweep complete: ${sweepResult.totalRemoved} users removed from ${sweepResult.chatsChecked} chats`, sweepResult, 'GameEngine');
          this.lastChatSweep = currentDate;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          logger.error(`Failed to run group chat sweep: ${errorMessage}`, {
            error: errorMessage,
            stack: errorStack,
          }, 'GameEngine');
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`Error in tick: ${errorMessage}`, { 
        error: errorMessage,
        stack: errorStack 
      }, 'GameEngine');
      this.emit('error', error);
    }
  }

  /**
   * Generate events that build toward question outcomes
   * Events are specific, dramatic, and hint at the predetermined outcome
   */
  private async generateQuestionDrivenEvents(
    activeQuestions: Question[],
    resolutionEvents: WorldEvent[]
  ): Promise<WorldEvent[]> {
    const events: WorldEvent[] = [...resolutionEvents];
    
    // Generate 2-4 events per tick
    const eventCount = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < eventCount && activeQuestions.length > 0; i++) {
      const question = activeQuestions[Math.floor(Math.random() * activeQuestions.length)]!;
      
      // Calculate urgency based on days until resolution
      const daysUntilResolution = this.getDaysUntilResolution(question);
      const urgency = daysUntilResolution <= 1 ? 'critical' : daysUntilResolution <= 3 ? 'high' : 'normal';
      
      // Generate event using LLM
      const event = await this.generateEventForQuestion(question, urgency);
      events.push(event);
    }

    return events;
  }

  /**
   * Generate a specific event for a question using LLM (relationship-aware)
   */
  private async generateEventForQuestion(
    question: Question,
    urgency: 'normal' | 'high' | 'critical'
  ): Promise<WorldEvent> {
    const scenario = this.scenarios.find(s => s.id === question.scenario);
    let involvedActors = scenario
      ? this.actors.filter(a => scenario.mainActors.includes(a.id)).slice(0, 3)
      : shuffleArray(this.actors.filter(a => a.role === 'main')).slice(0, 3);
    
    // Enhance: Add related actors if we have <3 for richer storylines
    if (involvedActors.length < 3 && involvedActors.length > 0) {
      const primaryActor = involvedActors[0];
      if (!primaryActor) return this.generateFallbackEvent(question, urgency);
      
      const relatedActors = await RelationshipManager.getRelatedActors(
        primaryActor.id,
        3 - involvedActors.length,
        ['rivals', 'allies', 'competitors']
      );
      
      const relatedSelectedActors = relatedActors
        .map(actor => this.actors.find(a => a.id === actor.id))
        .filter((a): a is SelectedActor => a !== undefined);
      
      involvedActors = [...involvedActors, ...relatedSelectedActors];
    }

    const daysLeft = this.getDaysUntilResolution(question);
    const shouldPointToOutcome = urgency === 'critical' || (urgency === 'high' && Math.random() > 0.3);
    const currentDay = this.getGameDayNumber(new Date());

    const prompt = `Generate a SPECIFIC event for this prediction market question:

QUESTION: ${question.text}
PREDETERMINED OUTCOME: ${question.outcome ? 'YES' : 'NO'}
DAYS UNTIL RESOLUTION: ${daysLeft}
URGENCY: ${urgency}

INVOLVED ACTORS: ${involvedActors.map(a => `${a.name} (${a.description})`).join(', ')}

REQUIREMENTS:
- Event must be SPECIFIC and OBSERVABLE
- ${urgency === 'critical' ? 'Event must CLEARLY point toward the outcome' : urgency === 'high' ? 'Event should hint strongly at the outcome' : 'Event can be ambiguous or early development'}
- ${shouldPointToOutcome ? `Event should support the ${question.outcome ? 'YES' : 'NO'} outcome` : 'Event can be neutral or misleading'}
- Use actor names and be dramatic
- One sentence, max 150 characters
- Satirical tone

OUTPUT JSON:
{
  "description": "Your event here",
  "type": "announcement|scandal|deal|conflict|revelation"
}`;

    try {
      const response = await this.llm.generateJSON<{
        description: string;
        type: string;
      }>(prompt, undefined, { temperature: 0.8, maxTokens: 500 });

      return {
        id: `event-${Date.now()}-${Math.random()}`,
        day: currentDay,
        type: (response.type as WorldEvent['type']) || 'announcement',
        actors: involvedActors.map(a => a.id),
        description: response.description || `Development in: ${question.text}`,
        relatedQuestion: toQuestionIdNumberOrNull(question.id),
        pointsToward: shouldPointToOutcome ? (question.outcome ? 'YES' : 'NO') : null,
        visibility: 'public',
      };
    } catch (eventGenerationError) {
      const errorMessage = eventGenerationError instanceof Error ? eventGenerationError.message : 'Failed to generate event';
      const errorStack = eventGenerationError instanceof Error ? eventGenerationError.stack : undefined;
      logger.error(`Failed to generate event: ${errorMessage}`, { 
        error: errorMessage,
        stack: errorStack,
        questionId: question.id 
      }, 'GameEngine');
      
      // Fallback to template-based event
      return {
        id: `event-${Date.now()}-${Math.random()}`,
        day: currentDay,
        type: 'announcement',
        actors: involvedActors.map(a => a.id),
        description: `${involvedActors[0]?.name || 'Someone'} makes move regarding: ${question.text}`,
        relatedQuestion: toQuestionIdNumberOrNull(question.id),
        pointsToward: shouldPointToOutcome ? (question.outcome ? 'YES' : 'NO') : null,
        visibility: 'public',
      };
    }
  }

  /**
   * Generate resolution event when question resolves
   */
  private async generateResolutionEvent(question: Question): Promise<WorldEvent> {
    const scenario = this.scenarios.find(s => s.id === question.scenario);
    const involvedActors = scenario
      ? this.actors.filter(a => scenario.mainActors.includes(a.id)).slice(0, 2)
      : shuffleArray(this.actors.filter(a => a.role === 'main')).slice(0, 2);

    const currentDay = this.getGameDayNumber(new Date());

    const prompt = `Generate a DEFINITIVE resolution event for this prediction market:

QUESTION: ${question.text}
FINAL OUTCOME: ${question.outcome ? 'YES' : 'NO'}

REQUIREMENT:
- Event must DEFINITIVELY PROVE the ${question.outcome ? 'YES' : 'NO'} outcome
- Must be concrete and observable
- ${question.outcome ? 'Clearly shows it HAPPENED/SUCCEEDED' : 'Clearly shows it FAILED/WAS CANCELLED/DID NOT HAPPEN'}
- Use specific details and actor names
- One sentence, max 150 characters
- Dramatic and satirical

OUTPUT JSON:
{
  "description": "Your resolution event",
  "type": "announcement|scandal|revelation"
}`;

    try {
      const response = await this.llm.generateJSON<{
        description: string;
        type: string;
      }>(prompt, undefined, { temperature: 0.7, maxTokens: 500 });

      return {
        id: `resolution-${Date.now()}`,
        day: currentDay,
        type: (response.type as WorldEvent['type']) || 'announcement',
        actors: involvedActors.map(a => a.id),
        description: response.description,
        relatedQuestion: toQuestionIdNumberOrNull(question.id),
        pointsToward: question.outcome ? 'YES' : 'NO',
        visibility: 'public',
      };
    } catch (resolutionError) {
      const errorMessage = resolutionError instanceof Error ? resolutionError.message : 'Failed to generate resolution event';
      const errorStack = resolutionError instanceof Error ? resolutionError.stack : undefined;
      logger.error(`Failed to generate resolution event: ${errorMessage}`, { 
        error: errorMessage,
        stack: errorStack,
        questionId: question.id 
      }, 'GameEngine');
      
      return {
        id: `resolution-${Date.now()}`,
        day: currentDay,
        type: 'announcement',
        actors: involvedActors.map(a => a.id),
        description: `RESOLUTION: ${question.text} - Outcome is ${question.outcome ? 'YES' : 'NO'}`,
        relatedQuestion: toQuestionIdNumberOrNull(question.id),
        pointsToward: question.outcome ? 'YES' : 'NO',
        visibility: 'public',
      };
    }
  }

  /**
   * Generate posts using LLM about events
   * Posts are specific, reference questions, and provide clues
   * MIXED: Generates both NPC posts and organization articles
   */
  private async generateLLMPosts(
    events: WorldEvent[],
    activeQuestions: Question[]
  ): Promise<FeedPost[]> {
    const posts: FeedPost[] = [];
    const numPosts = this.config.postsPerTick;
    
    // Create a mixed pool of content creators (NPCs + media organizations)
    interface ContentCreator {
      id: string;
      name: string;
      type: 'actor' | 'organization';
      data: SelectedActor | Organization;
    }
    
    const newsOrgs = this.organizations.filter(o => o.type === 'media').slice(0, 5);
    const creators: ContentCreator[] = [
      ...this.actors.map(actor => ({ 
        id: actor.id, 
        name: actor.name, 
        type: 'actor' as const,
        data: actor 
      })),
      ...newsOrgs.map(org => ({ 
        id: org.id, 
        name: org.name, 
        type: 'organization' as const,
        data: org 
      })),
    ];
    
    // Shuffle to mix actors and orgs
    const shuffledCreators = shuffleArray(creators);
    
    // For each event, generate 3-5 posts from different perspectives (mixed types)
    for (const event of events.slice(0, Math.ceil(numPosts / 4))) {
      const question = activeQuestions.find(q => q.id === event.relatedQuestion);
      if (!question) continue;

      const daysLeft = this.getDaysUntilResolution(question);
      const clueStrength = this.calculateClueStrength(daysLeft);
      
      // Select 3 diverse creators (mix of actors and orgs)
      const selectedCreators = shuffledCreators.slice(0, 3);
      
      for (const creator of selectedCreators) {
        try {
          if (creator.type === 'actor') {
            // Generate NPC post
            const post = await this.generateActorPostAboutEvent(
              creator.data as SelectedActor,
              event,
              question,
              clueStrength
            );
            posts.push(post);
          } else {
            // Generate organization article
            const org = creator.data as Organization;
            const post = await this.generateOrgArticleAboutEvent(
              org,
              event,
              question,
              clueStrength
            );
            posts.push(post);
          }
          
          if (posts.length >= numPosts) break;
        } catch (postGenerationError) {
          // Skip this post if LLM fails, continue to next
          const errorMessage = postGenerationError instanceof Error ? postGenerationError.message : 'Failed to generate post'
          logger.warn('Failed to generate post, skipping', { error: errorMessage, creatorId: creator.id, eventId: event.id }, 'GameEngine')
          continue;
        }
      }
      
      if (posts.length >= numPosts) break;
    }

    // Fill remaining quota with ambient posts (mixed types)
    while (posts.length < numPosts) {
      const question = activeQuestions[Math.floor(Math.random() * activeQuestions.length)];
      if (!question) break;

      // Randomly choose between actor or org
      const creator = shuffledCreators[posts.length % shuffledCreators.length];
      if (!creator) break;

      try {
        if (creator.type === 'actor') {
          const post = await this.generateAmbientPostAboutQuestion(creator.data as SelectedActor, question);
          if (post) {
            posts.push(post);
          } else {
            break;
          }
        } else {
          // Generate ambient article from org
          const org = creator.data as Organization;
          const post = await this.generateAmbientOrgArticle(org, question);
          if (post) {
            posts.push(post);
          } else {
            break;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Failed to generate ambient post', { 
          error: errorMessage, 
          creatorId: creator.id 
        }, 'GameEngine');
        break;
      }
    }

    logger.info(`Generated ${posts.length} mixed posts (NPCs + orgs)`, { count: posts.length }, 'GameEngine');
    return posts;
  }

  /**
   * Generate actor post about an event using LLM with relationship context
   */
  private async generateActorPostAboutEvent(
    actor: SelectedActor,
    event: WorldEvent,
    question: Question,
    clueStrength: number
  ): Promise<FeedPost> {
    // Get relationship context for involved actors
    const relationshipContext = await RelationshipManager.getRelationshipContext(
      actor.id,
      event.actors
    );

    let relationshipInstructions = '';
    if (relationshipContext.relationships.length > 0) {
      relationshipInstructions = `\n\nYOUR RELATIONSHIPS WITH PEOPLE INVOLVED:\n${relationshipContext.contextString}\n\nConsider these relationships when posting:
- If a rival: Be critical, competitive, or call them out
- If an ally: Be supportive, tag them positively
- If you respect them: Reference their expertise
- If you have beef: Be sarcastic or dismissive`;
    }

    const prompt = `You are ${actor.name}. ${actor.description || ''}

EVENT: ${event.description}
RELATED QUESTION: ${question.text}
THIS EVENT ${event.pointsToward === 'YES' ? 'supports YES' : event.pointsToward === 'NO' ? 'supports NO' : 'is ambiguous'}${relationshipInstructions}

Write a social media post (max 280 chars) reacting to this event.
${actor.personality ? `Your personality: ${actor.personality}` : ''}
${actor.postStyle ? `Your style: ${actor.postStyle}` : ''}

The post should:
- React to the EVENT specifically
- ${clueStrength > 0.7 ? 'Provide clear insight about the outcome' : clueStrength > 0.4 ? 'Give subtle hints' : 'Be speculative'}
- Match your personality
- Reflect your relationships with involved parties
- Be satirical and entertaining

OUTPUT JSON:
{
  "post": "your post here",
  "sentiment": -1 to 1,
  "clueStrength": 0 to 1,
  "pointsToward": true/false/null
}`;

    try {
      const response = await this.llm.generateJSON<{
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(prompt, undefined, { temperature: 0.9, maxTokens: 1000 });

      // Strict validation
      if (!response.post || typeof response.post !== 'string') {
        throw new Error('Invalid LLM response for post');
      }

      return {
        id: generateSnowflakeId(),
        day: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
        timestamp: new Date().toISOString(),
        type: 'post',
        content: response.post,
        author: actor.id,
        authorName: actor.name,
        sentiment: response.sentiment || 0,
        clueStrength: response.clueStrength || clueStrength,
        pointsToward: response.pointsToward ?? (event.pointsToward === 'YES'),
        relatedEvent: event.id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`Failed to generate LLM post: ${errorMessage}`, { 
        error: errorMessage,
        stack: errorStack,
        actorId: actor.id, 
        eventId: event.id 
      }, 'GameEngine');
      throw error; // Propagate error instead of fallback
    }
  }

  /**
   * Generate ambient post about question using LLM
   */
  private async generateAmbientPostAboutQuestion(
    actor: SelectedActor,
    question: Question
  ): Promise<FeedPost | null> {
    const daysLeft = this.getDaysUntilResolution(question);
    const clueStrength = this.calculateClueStrength(daysLeft);

    const prompt = `You are ${actor.name}. ${actor.description || ''}

ACTIVE QUESTION: ${question.text}
DAYS LEFT: ${daysLeft}

Write a social media post (max 280 chars) speculating about this question.
${actor.postStyle ? `Your style: ${actor.postStyle}` : ''}

OUTPUT JSON:
{
  "post": "your speculation here"
}`;

    try {
      const response = await this.llm.generateJSON<{ post: string }>(
        prompt,
        undefined,
        { temperature: 0.9, maxTokens: 500 }
      );

      // Strict validation
      if (!response.post || typeof response.post !== 'string') {
        return null;
      }

      return {
        id: generateSnowflakeId(),
        day: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
        timestamp: new Date().toISOString(),
        type: 'post',
        content: response.post,
        author: actor.id,
        authorName: actor.name,
        sentiment: Math.random() * 2 - 1,
        clueStrength,
        pointsToward: Math.random() > 0.5,
      };
    } catch (llmError) {
      // Don't create post if LLM fails
      const errorMessage = llmError instanceof Error ? llmError.message : 'Failed to generate LLM post'
      logger.warn('Failed to generate LLM post, returning null', { error: errorMessage, actorId: actor.id }, 'GameEngine')
      return null;
    }
  }

  /**
   * Generate organization article about an event
   */
  private async generateOrgArticleAboutEvent(
    org: Organization,
    event: WorldEvent,
    question: Question,
    clueStrength: number
  ): Promise<FeedPost> {
    const prompt = `You are ${org.name}, a ${org.type} organization. Write a news headline and brief summary about this event.

EVENT: ${event.description}
RELATED QUESTION: ${question.text}
THIS EVENT ${event.pointsToward === 'YES' ? 'supports YES' : event.pointsToward === 'NO' ? 'supports NO' : 'is ambiguous'}

Write a professional news article (max 300 chars) covering this event.
Be informative and analytical.

OUTPUT JSON:
{
  "title": "news headline",
  "summary": "brief summary"
}`;

    try {
      const response = await this.llm.generateJSON<{
        title: string;
        summary: string;
      }>(prompt, undefined, { temperature: 0.7, maxTokens: 1000 });

      return {
        id: generateSnowflakeId(),
        day: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
        timestamp: new Date().toISOString(),
        type: 'news',
        content: response.summary,
        author: org.id,
        authorName: org.name,
        articleTitle: response.title,
        sentiment: 0,
        clueStrength: clueStrength,
        pointsToward: event.pointsToward === 'YES' ? true : event.pointsToward === 'NO' ? false : null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate article';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.warn('Failed to generate org article', { 
        error: errorMessage,
        stack: errorStack,
        orgId: org.id, 
        eventId: event.id 
      }, 'GameEngine');
      throw error;
    }
  }

  /**
   * Generate ambient organization article about a question
   */
  private async generateAmbientOrgArticle(
    org: Organization,
    question: Question
  ): Promise<FeedPost | null> {
    const daysLeft = this.getDaysUntilResolution(question);

    const prompt = `You are ${org.name}, a ${org.type} organization. Write a news analysis piece about this prediction market.

ACTIVE QUESTION: ${question.text}
DAYS LEFT: ${daysLeft}

Write a professional news headline and summary (max 300 chars) analyzing this question.

OUTPUT JSON:
{
  "title": "analysis headline",
  "summary": "brief analysis"
}`;

    try {
      const response = await this.llm.generateJSON<{
        title: string;
        summary: string;
      }>(prompt, undefined, { temperature: 0.7, maxTokens: 1000 });

      if (!response.title || !response.summary) {
        return null;
      }

      return {
        id: generateSnowflakeId(),
        day: Math.floor(Date.now() / (1000 * 60 * 60 * 24)),
        timestamp: new Date().toISOString(),
        type: 'news',
        content: response.summary,
        author: org.id,
        authorName: org.name,
        articleTitle: response.title,
        sentiment: 0,
        clueStrength: 0.1,
        pointsToward: null,
      };
    } catch (error) {
      logger.debug('LLM failed to generate ambient org article', { error }, 'GameEngine');
      return null;
    }
  }

  /**
   * Generate group chat messages about active questions
   */
  private async generateGroupChatDiscussions(
    activeQuestions: Question[],
    events: WorldEvent[]
  ): Promise<Record<string, ChatMessage[]>> {
    const discussions: Record<string, ChatMessage[]> = {};

    // Each group chat discusses 0-2 questions
    for (const groupChat of this.groupChats.slice(0, 10)) { // Limit to first 10 chats
      const chatMessages: ChatMessage[] = [];
      
      // Pick 1-2 relevant questions
      const relevantQuestions = shuffleArray(activeQuestions).slice(0, 1 + Math.floor(Math.random() * 2));
      
      for (const question of relevantQuestions) {
        // Find relevant event
        const relevantEvent = events.find(e => e.relatedQuestion === question.id);
        if (!relevantEvent) continue;

        // Admin posts about the event/question
        const adminActor = this.actors.find(a => a.id === groupChat.admin);
        if (!adminActor) continue;

        const daysLeft = this.getDaysUntilResolution(question);
        const clueStrength = this.calculateClueStrength(daysLeft);

        chatMessages.push({
          from: groupChat.admin,
          message: `Thoughts on: ${relevantEvent.description}?`,
          timestamp: new Date().toISOString(),
          clueStrength,
        });

        // Find rival pairs in the group for drama
        const memberRelationships = await db.prisma.actorRelationship.findMany({
          where: {
            OR: [
              { actor1Id: { in: groupChat.members }, actor2Id: { in: groupChat.members } },
            ],
            relationshipType: { in: ['rivals', 'competitors', 'frenemies'] },
            sentiment: { lt: -0.3 },
          },
          take: 2,
        });
        
        let respondingMembers: string[];
        
        if (memberRelationships.length > 0) {
          // Create debate between rivals
          const rivalPair = memberRelationships[0];
          if (!rivalPair) {
            respondingMembers = shuffleArray(groupChat.members.filter(m => m !== groupChat.admin)).slice(0, 2);
          } else {
            respondingMembers = [rivalPair.actor1Id, rivalPair.actor2Id];
            logger.debug(`Group chat drama: ${rivalPair.actor1Id} vs ${rivalPair.actor2Id}`, undefined, 'GameEngine');
          }
        } else {
          // Normal: 1-2 random members respond
          const memberCount = 1 + Math.floor(Math.random() * 2);
          respondingMembers = shuffleArray(groupChat.members.filter(m => m !== groupChat.admin)).slice(0, memberCount);
        }
        
        for (const memberId of respondingMembers) {
          const memberActor = this.actors.find(a => a.id === memberId);
          if (!memberActor) continue;

          try {
            const response = await this.generateChatResponse(memberActor, question, relevantEvent, clueStrength);
            chatMessages.push(response);
          } catch (chatError) {
            const errorMessage = chatError instanceof Error ? chatError.message : 'Failed to generate chat response'
            logger.warn('Failed to generate chat response, skipping', { error: errorMessage, actorId: memberActor.id, questionId: question.id }, 'GameEngine')
            continue;
          }
        }
      }

      if (chatMessages.length > 0) {
        discussions[groupChat.id] = chatMessages;
      }
    }

    return discussions;
  }

  /**
   * Generate chat response from actor with relationship context
   */
  private async generateChatResponse(
    actor: SelectedActor,
    question: Question,
    event: WorldEvent,
    clueStrength: number
  ): Promise<ChatMessage> {
    // Get relationship context for involved actors
    const relationshipContext = await RelationshipManager.getRelationshipContext(
      actor.id,
      event.actors
    );

    let relationshipInfo = '';
    if (relationshipContext.relationships.length > 0) {
      relationshipInfo = `\n\nYour relationships: ${relationshipContext.contextString}`;
    }

    const prompt = `You are ${actor.name} in a private group chat.

EVENT: ${event.description}
QUESTION: ${question.text}
OUTCOME: ${question.outcome ? 'YES' : 'NO'} (you may hint at this)${relationshipInfo}

Write a brief chat message (max 150 chars) giving your insider take.
${clueStrength > 0.7 ? 'Be fairly direct about what you think will happen.' : 'Be speculative and cautious.'}
${relationshipContext.relationships.length > 0 ? 'Reference your relationships if relevant (e.g., "my sources say...", "rivals won\'t admit but...")' : ''}

OUTPUT JSON:
{
  "message": "your message"
}`;

    try {
      const response = await this.llm.generateJSON<{ message: string }>(
        prompt,
        undefined,
        { temperature: 0.9, maxTokens: 500 }
      );

      // Strict validation
      if (!response.message || typeof response.message !== 'string') {
        throw new Error('Invalid LLM response for message');
      }

      return {
        from: actor.id,
        message: response.message,
        timestamp: new Date().toISOString(),
        clueStrength,
      };
    } catch (error) {
      throw error; // Propagate error instead of fallback
    }
  }

  /**
   * Calculate clue strength based on days until resolution
   */
  private calculateClueStrength(daysUntilResolution: number): number {
    if (daysUntilResolution >= 7) {
      return 0.1 + Math.random() * 0.2; // 0.1-0.3
    } else if (daysUntilResolution >= 4) {
      return 0.3 + Math.random() * 0.2; // 0.3-0.5
    } else if (daysUntilResolution >= 2) {
      return 0.5 + Math.random() * 0.2; // 0.5-0.7
    } else if (daysUntilResolution >= 1) {
      return 0.7 + Math.random() * 0.2; // 0.7-0.9
    } else {
      return 0.9 + Math.random() * 0.1; // 0.9-1.0 (resolution day)
    }
  }

  /**
   * Get days until question resolves
   */
  private getDaysUntilResolution(question: Question): number {
    if (!question.resolutionDate) return 999;
    
    const now = new Date();
    const resolution = new Date(question.resolutionDate);
    const diffTime = resolution.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  private async updatePrices(events: WorldEvent[]): Promise<PriceUpdate[]> {
    const updates: PriceUpdate[] = [];
    
    for (const event of events) {
      const affectedCompanies = this.organizations.filter(org => {
        if (org.type !== 'company') return false;
        return event.actors.some(actorId => {
          const actor = this.actors.find(a => a.id === actorId);
          return actor?.affiliations?.includes(org.id);
        });
      });

      for (const company of affectedCompanies) {
        // Deterministic price direction based on event outcome
        // Events have predetermined outcomes, so impact should be deterministic
        const direction = event.pointsToward === 'YES' ? 'positive' : event.pointsToward === 'NO' ? 'negative' : 'neutral';
        const magnitude = event.type === 'scandal' ? 'major' : event.type === 'announcement' ? 'moderate' : 'minor';
        
        // Apply deterministic event impact (no randomness)
        const update = this.applyDeterministicEventImpact(company, event, direction, magnitude);
        if (update) {
          updates.push(update);
        }
      }
    }

    return updates;
  }
  
  /**
   * Apply deterministic event impact to price (NO RANDOMNESS)
   */
  private applyDeterministicEventImpact(
    company: Organization,
    event: WorldEvent,
    direction: 'positive' | 'negative' | 'neutral',
    magnitude: 'major' | 'moderate' | 'minor'
  ): PriceUpdate | null {
    if (!company.currentPrice) return null;
    
    // Deterministic impact percentages
    const directionMultiplier = direction === 'positive' ? 1 : direction === 'negative' ? -1 : 0;
    const magnitudeAmount = magnitude === 'major' ? 0.05 : magnitude === 'moderate' ? 0.02 : 0.005;
    
    // NO RANDOMNESS - just apply the impact directly
    const impactPercent = directionMultiplier * magnitudeAmount;
    
    const oldPrice = company.currentPrice;
    const newPrice = oldPrice * (1 + impactPercent);
    const change = newPrice - oldPrice;
    const changePercent = (change / oldPrice) * 100;
    
    // Update company price
    company.currentPrice = newPrice;
    const companyIndex = this.organizations.findIndex(o => o.id === company.id);
    if (companyIndex >= 0) {
      this.organizations[companyIndex] = company;
    }
    
    return {
      organizationId: company.id,
      timestamp: new Date().toISOString(),
      oldPrice: Number(oldPrice.toFixed(2)),
      newPrice: Number(newPrice.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      reason: event.description,
      impact: magnitude,
    };
  }

  private async generateQuestions(_count: number): Promise<Question[]> {
    const currentDate = new Date().toISOString().split('T')[0]!;
    const activeQuestions = this.questions.filter(q => q.status === 'active');
    const nextId = Math.max(0, ...this.questions.map(q => toQuestionIdNumber(q.id))) + 1;

    // Get recent events for context
    const recentEvents = await db.prisma.worldEvent.findMany({
      take: 60,
      orderBy: { timestamp: 'desc' },
    });

    const recentDays = this.buildRecentDaysContext(recentEvents.map(e => ({
      id: e.id,
      day: e.dayNumber || 0,
      type: e.eventType as WorldEvent['type'],
      actors: e.actors as string[],
      description: e.description,
      relatedQuestion: e.relatedQuestion ?? undefined,
      pointsToward: (e.pointsToward as 'YES' | 'NO' | null) ?? null,
      visibility: e.visibility as WorldEvent['visibility'],
    })));

    const newQuestions = await this.questionManager.generateDailyQuestions({
      currentDate,
      scenarios: this.scenarios,
      actors: this.actors.filter(a => a.role === 'main'),
      organizations: this.organizations,
      activeQuestions,
      recentEvents: recentDays.map(day => ({ 
        day: day.day, 
        summary: `Day ${day.day} events`, 
        events: day.events, 
        groupChats: {}, 
        feedPosts: [], 
        luckChanges: [], 
        moodChanges: [] 
      })),
      nextQuestionId: nextId,
    });

    // Persist new questions to database
    for (const question of newQuestions) {
      try {
        await db.createQuestion({
          ...question,
          questionNumber: toQuestionIdNumber(question.id),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.error(`Failed to persist question ${question.id}: ${errorMessage}`, { 
          error: errorMessage,
          stack: errorStack,
          questionId: question.id 
        }, 'GameEngine');
      }
    }

    return newQuestions;
  }

  private buildRecentDaysContext(recentEvents: WorldEvent[]): Array<{ day: number; events: WorldEvent[] }> {
    // Build pseudo-timeline from recent events for question generation context
    return [{
      day: 1,
      events: recentEvents.slice(-10),
    }];
  }

  private async checkDailySnapshot(): Promise<void> {
    const currentDate = new Date().toISOString().split('T')[0]!;
    
    if (currentDate !== this.lastDailySnapshot) {
      logger.info(`Recording daily snapshot for ${this.lastDailySnapshot}`, { date: this.lastDailySnapshot }, 'GameEngine');
      this.perpsEngine.recordDailySnapshot(this.lastDailySnapshot);
      this.lastDailySnapshot = currentDate;
      
      // Save to database instead of file
      try {
        await db.updateGameState({
          lastSnapshotAt: new Date(this.lastDailySnapshot),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.warn(`Failed to update lastSnapshotAt: ${errorMessage}`, { 
          error: errorMessage,
          stack: errorStack 
        }, 'GameEngine');
      }
    }
  }

  private async syncDatabaseState(): Promise<void> {
    logger.info('Syncing engine state to database...', undefined, 'GameEngine');
    try {
      const gameState = await db.getGameState();
      if (!gameState) {
        await db.initializeGame();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.warn(`Failed to ensure game state exists: ${errorMessage}`, { 
        error: errorMessage,
        stack: errorStack 
      }, 'GameEngine');
    }

    await Promise.allSettled(
      this.actors.map(async (actor) => {
        try {
          // Convert SelectedActor to Actor
          const actorData: Actor = {
            id: actor.id,
            name: actor.name,
            description: actor.description,
            domain: actor.domain,
            personality: actor.personality,
            role: actor.role,
            affiliations: actor.affiliations,
            postStyle: actor.postStyle,
            postExample: actor.postExample,
            tier: actor.tier,
          };
          await db.upsertActor(actorData);
        } catch (syncError) {
          const errorMessage = syncError instanceof Error ? syncError.message : 'Failed to sync actor';
          const errorStack = syncError instanceof Error ? syncError.stack : undefined;
          logger.warn(`Failed to sync actor ${actor.id}: ${errorMessage}`, { 
            error: errorMessage,
            stack: errorStack,
            actorId: actor.id 
          }, 'GameEngine');
        }
      })
    );

    await Promise.allSettled(
      this.organizations.map(async (org) => {
        try {
          await db.upsertOrganization(org);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          logger.warn(`Failed to sync organization ${org.id}: ${errorMessage}`, { 
            error: errorMessage,
            stack: errorStack,
            orgId: org.id 
          }, 'GameEngine');
        }
      })
    );
  }

  /**
   * Sync group chats to database with welcome messages
   */
  private async syncGroupChatsToDatabase(): Promise<void> {
    logger.info('Syncing group chats to database...', undefined, 'GameEngine');
    
    const existingCount = await db.prisma.chat.count({
      where: {
        isGroup: true,
        gameId: 'continuous',
      },
    });
    
    if (existingCount === 0) {
      logger.info('No group chats in database - creating initial set...', undefined, 'GameEngine');
    }
    
    for (const chat of this.groupChats) {
      try {
        // Create or update chat
        await db.prisma.chat.upsert({
          where: { id: chat.id },
          create: {
            id: chat.id,
            name: chat.name,
            isGroup: true,
            gameId: 'continuous',
          },
          update: {},
        });

        // Create LLM-generated initial message from admin
        const admin = this.actors.find(a => a.id === chat.admin);
        if (admin) {
          const initialMessage = await this.generateGroupChatInitialMessage(admin, chat);
          
          await db.prisma.message.upsert({
            where: { id: `${chat.id}-welcome` },
            create: {
              id: `${chat.id}-welcome`,
              chatId: chat.id,
              senderId: admin.id,
              content: initialMessage,
            },
            update: {},
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        logger.warn(`Failed to sync group chat ${chat.id}: ${errorMessage}`, { 
          error: errorMessage,
          stack: errorStack,
          chatId: chat.id 
        }, 'GameEngine');
      }
    }
    
    logger.info(`✅ Synced ${this.groupChats.length} group chats to database`, { count: this.groupChats.length }, 'GameEngine');
  }

  private getGameDayNumber(date: Date): number {
    const diff = date.getTime() - GameEngine.GAME_START_DATE.getTime();
    if (diff <= 0) return 0;
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.floor(diff / dayMs);
  }

  private async persistTickData(tick: Tick): Promise<void> {
    const tickDate = new Date(tick.timestamp);
    const dayNumber = this.getGameDayNumber(tickDate);

    if (tick.posts.length > 0) {
      await db.createManyPosts(
        tick.posts.map((post) => ({
          ...post,
          gameId: GameEngine.GAME_ID,
          dayNumber,
        }))
      );
    }

    // Persist group chat messages
    if (Object.keys(tick.groupChatMessages).length > 0) {
      for (const [chatId, messages] of Object.entries(tick.groupChatMessages)) {
        for (const msg of messages) {
          try {
            await db.prisma.message.create({
              data: {
                id: `${chatId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                chatId: chatId,
                senderId: msg.from,
                content: msg.message,
                createdAt: new Date(msg.timestamp),
              },
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            logger.warn(`Failed to persist chat message: ${errorMessage}`, { 
              error: errorMessage,
              stack: errorStack,
              chatId 
            }, 'GameEngine');
          }
        }
      }
      logger.debug(`Persisted ${Object.values(tick.groupChatMessages).flat().length} group chat messages`, undefined, 'GameEngine');
    }

    if (tick.events.length > 0) {
      for (const event of tick.events) {
        try {
          await db.createEvent({
            id: event.id,
            eventType: event.type,
            description: event.description,
            actors: event.actors,
            relatedQuestion: typeof event.relatedQuestion === 'number' ? event.relatedQuestion : undefined,
            pointsToward: event.pointsToward ?? undefined,
            visibility: event.visibility,
            gameId: GameEngine.GAME_ID,
            dayNumber,
          });
        } catch (error: unknown) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            // Duplicate event, skip
            continue;
          }
          throw error;
        }
      }
    }

    if (tick.priceUpdates.length > 0) {
      await Promise.allSettled(
        tick.priceUpdates.map(async (update) => {
          try {
            await db.updateOrganizationPrice(update.organizationId, update.newPrice);
          } catch (error: unknown) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2025'
            ) {
              const org = this.organizations.find((o) => o.id === update.organizationId);
              if (org) {
                try {
                  await db.upsertOrganization(org);
                  await db.updateOrganizationPrice(update.organizationId, update.newPrice);
                  return;
                } catch (nestedError) {
                  const nestedErrorMessage = nestedError instanceof Error ? nestedError.message : String(nestedError);
                  const nestedErrorStack = nestedError instanceof Error ? nestedError.stack : undefined;
                  logger.warn(`Failed to upsert organization ${update.organizationId}: ${nestedErrorMessage}`, { 
                    error: nestedErrorMessage,
                    stack: nestedErrorStack,
                    organizationId: update.organizationId 
                  }, 'GameEngine');
                }
              }
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            logger.warn(`Failed to update price for ${update.organizationId}: ${errorMessage}`, { 
              error: errorMessage,
              stack: errorStack,
              organizationId: update.organizationId 
            }, 'GameEngine');
          }

          try {
            await db.recordPriceUpdate(
              update.organizationId,
              update.newPrice,
              update.change,
              update.changePercent
            );
          } catch (error: unknown) {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2003'
            ) {
              const org = this.organizations.find((o) => o.id === update.organizationId);
              if (org) {
                try {
                  await db.upsertOrganization(org);
                  await db.recordPriceUpdate(
                    update.organizationId,
                    update.newPrice,
                    update.change,
                    update.changePercent
                  );
                  return;
                } catch (nestedError) {
                  const nestedErrorMessage = nestedError instanceof Error ? nestedError.message : String(nestedError);
                  const nestedErrorStack = nestedError instanceof Error ? nestedError.stack : undefined;
                  logger.warn(`Failed to reconcile price update for ${update.organizationId}: ${nestedErrorMessage}`, { 
                    error: nestedErrorMessage,
                    stack: nestedErrorStack,
                    organizationId: update.organizationId 
                  }, 'GameEngine');
                }
              }
            }
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            logger.warn(`Failed to record price update for ${update.organizationId}: ${errorMessage}`, { 
              error: errorMessage,
              stack: errorStack,
              organizationId: update.organizationId 
            }, 'GameEngine');
          }
        })
      );
    }

    try {
      await db.updateGameState({
        lastTickAt: tickDate,
        activeQuestions: this.questions.filter((q) => q.status === 'active').length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.warn(`Failed to update game state metadata: ${errorMessage}`, { 
        error: errorMessage,
        stack: errorStack 
      }, 'GameEngine');
    }
  }

  /**
   * Load state from database instead of file
   */
  private async loadHistory(): Promise<void> {
    try {
      // Load all questions from database (active and resolved)
      const dbQuestions = await db.getAllQuestions();
      this.questions = dbQuestions;
      
      logger.info('Loaded questions from database', {
        questions: this.questions.length,
        active: this.questions.filter(q => q.status === 'active').length,
      }, 'GameEngine');

      // Load last daily snapshot date from game state
      const gameState = await db.getGameState();
      if (gameState?.lastSnapshotAt) {
        this.lastDailySnapshot = gameState.lastSnapshotAt.toISOString().split('T')[0]!;
        logger.info('Loaded lastDailySnapshot from database', { date: this.lastDailySnapshot }, 'GameEngine');
      } else {
        this.lastDailySnapshot = new Date().toISOString().split('T')[0]!;
        logger.info('No lastDailySnapshot in database, using current date', { date: this.lastDailySnapshot }, 'GameEngine');
      }

      // Note: recentTicks are not loaded as they're ephemeral
      // Posts and events can be queried from database as needed
      // Perps positions are automatically loaded by PerpetualsEngine from database
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error(`Failed to load history from database: ${errorMessage}`, { 
        error: errorMessage,
        stack: errorStack 
      }, 'GameEngine');
    }
  }

  private selectAllActors(actorList: Actor[]): SelectedActor[] {
    return actorList.map((a: Actor) => ({
      ...a,
      tier: (a.tier as ActorTier) || 'C_TIER',
      role: (a.tier === 'S_TIER' || a.tier === 'A_TIER') ? 'main' : 'supporting',
      initialLuck: this.randomLuck(),
      initialMood: this.randomMood(),
    }));
  }

  private async generateScenarios(): Promise<Scenario[]> {
    return [
      { id: 1, title: 'Tech Drama', description: 'Tech companies and feuds', mainActors: [], involvedOrganizations: [], theme: 'tech' },
      { id: 2, title: 'Political Chaos', description: 'Political scandals', mainActors: [], involvedOrganizations: [], theme: 'politics' },
      { id: 3, title: 'Market Mayhem', description: 'Stock and crypto chaos', mainActors: [], involvedOrganizations: [], theme: 'finance' },
    ];
  }

  /**
   * Initialize actor relationships and follows in database
   */
  private async initializeActorRelationships(): Promise<void> {
    // Check if relationships already exist
    const existingCount = await db.prisma.actorRelationship.count();
    
    if (existingCount === 0) {
      logger.warn('No relationships found in database', undefined, 'GameEngine');
      logger.warn('For enhanced gameplay, generate relationships:', undefined, 'GameEngine');
      logger.warn('  1. Run: npx tsx scripts/init-actor-relationships.ts', undefined, 'GameEngine');
      logger.warn('  2. Or add data/actor-relationships.json to repo and re-seed', undefined, 'GameEngine');
      logger.info('Continuing with basic relationship generation...', undefined, 'GameEngine');
      return;
    }
    
    logger.info(`Found ${existingCount} existing relationships`, { count: existingCount }, 'GameEngine');
    
    // Verify follows exist
    const followCount = await db.prisma.actorFollow.count();
    if (followCount === 0) {
      logger.info('No follow relationships found, initializing from relationships...', undefined, 'GameEngine');
      await FollowInitializer.initializeActorFollows();
    } else {
      logger.info(`Found ${followCount} existing follow relationships`, { count: followCount }, 'GameEngine');
    }
  }

  /**
   * Load ActorConnection objects from database relationships
   */
  private async loadConnectionsFromRelationships(): Promise<ActorConnection[]> {
    const relationships = await db.prisma.actorRelationship.findMany({
      take: 500, // Limit to prevent overload
      orderBy: [
        { strength: 'desc' },
        { sentiment: 'desc' },
      ],
    });

    return relationships.map((rel: { actor1Id: string; actor2Id: string; relationshipType: string; history: string | null }) => ({
      actor1: rel.actor1Id,
      actor2: rel.actor2Id,
      relationship: rel.relationshipType,
      context: rel.history || 'Professional relationship',
    }));
  }

  /**
   * Generate fallback event (used when primary actor is undefined)
   */
  private generateFallbackEvent(question: Question, _urgency: 'normal' | 'high' | 'critical'): WorldEvent {
    const currentDay = this.getGameDayNumber(new Date());
    return {
      id: `event-${Date.now()}-${Math.random()}`,
      day: currentDay,
      type: 'announcement',
      actors: [],
      description: `Development in: ${question.text}`,
      relatedQuestion: toQuestionIdNumberOrNull(question.id),
      pointsToward: question.outcome ? 'YES' : 'NO',
      visibility: 'public',
    };
  }

  /**
   * Create group chats with friend-of-friends membership using relationship data
   * Optimized with batch queries to avoid N+1 problem
   */
  private async createGroupChats(): Promise<GroupChat[]> {
    const chats: GroupChat[] = [];
    
    const mainActors = this.actors.filter(a => a.role === 'main').slice(0, 10);
    const mainActorIds = mainActors.map(a => a.id);
    
    // Batch query: Get all positive relationships for all main actors at once
    const positiveTypes = [
      'allies',
      'collaborators',
      'friends',
      'business-partners',
      'former-colleagues'
    ];
    
    const allRelationships = await db.prisma.actorRelationship.findMany({
      where: {
        OR: [
          { actor1Id: { in: mainActorIds }, relationshipType: { in: positiveTypes }, sentiment: { gte: 0.3 } },
          { actor2Id: { in: mainActorIds }, relationshipType: { in: positiveTypes }, sentiment: { gte: 0.3 } },
        ],
      },
      orderBy: [
        { strength: 'desc' },
        { sentiment: 'desc' },
      ],
    });
    
    // Build adjacency map for O(1) lookup
    const connectionMap = new Map<string, string[]>();
    for (const rel of allRelationships) {
      // Add connection for actor1
      if (!connectionMap.has(rel.actor1Id)) {
        connectionMap.set(rel.actor1Id, []);
      }
      connectionMap.get(rel.actor1Id)!.push(rel.actor2Id);
      
      // Add connection for actor2
      if (!connectionMap.has(rel.actor2Id)) {
        connectionMap.set(rel.actor2Id, []);
      }
      connectionMap.get(rel.actor2Id)!.push(rel.actor1Id);
    }
    
    // Build friend network using preloaded map
    const buildFriendNetwork = (adminId: string, maxSize: number = 7): string[] => {
      const members = new Set<string>([adminId]);
      const firstDegree = (connectionMap.get(adminId) || []).slice(0, 3);
      
      firstDegree.forEach(friendId => members.add(friendId));
      
      // Each first-degree friend can bring 1-2 of their own friends
      for (const friendId of firstDegree) {
        if (members.size >= maxSize) break;
        
        const secondDegree = (connectionMap.get(friendId) || [])
          .filter(id => !members.has(id))
          .slice(0, Math.random() > 0.5 ? 2 : 1);
        
        secondDegree.forEach(id => {
          if (members.size < maxSize) {
            members.add(id);
          }
        });
      }
      
      return Array.from(members);
    };
    
    logger.info('Creating group chats with relationship-based membership...', undefined, 'GameEngine');
    
    for (const main of mainActors) {
      const memberIds = buildFriendNetwork(main.id, 7);
      const members = memberIds
        .map(id => this.actors.find(a => a.id === id))
        .filter((actor): actor is SelectedActor => actor !== undefined);
      
      if (members.length < 2) continue;
      
      const domain = main.domain?.[0] || 'general';
      
      // Generate funny name using LLM
      const groupName = await this.generateGroupChatName(main, members, domain);
      const kebabName = groupName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      logger.debug(`Created "${groupName}" with ${members.length} members (admin: ${main.name})`, undefined, 'GameEngine');
      
      chats.push({
        id: kebabName,
        name: groupName,
        admin: main.id,
        members: memberIds,
        theme: domain,
      });
    }
    
    logger.info(`Created ${chats.length} group chats`, { count: chats.length }, 'GameEngine');
    return chats;
  }
  
  /**
   * Generate initial message for group chat using LLM
   */
  private async generateGroupChatInitialMessage(
    admin: SelectedActor,
    chat: GroupChat
  ): Promise<string> {
    const members = chat.members
      .map(id => this.actors.find(a => a.id === id))
      .filter((a): a is SelectedActor => a !== undefined)
      .slice(0, 5);
    
    const memberNames = members.map(m => m.name).join(', ');
    
    const prompt = `You are ${admin.name}, the admin of a private group chat called "${chat.name}".

YOUR CONTEXT:
- Role: ${admin.role}
- Domain: ${chat.theme || 'general'}
- Description: ${admin.description || 'influential figure'}
- Personality: ${admin.personality || 'strategic and connected'}

GROUP MEMBERS: ${memberNames}

Write the first message to this group chat. It should:
1. Set the tone for insider discussions
2. Reference your shared domain/interests (${chat.theme})
3. Be 1-2 sentences, casual but strategic
4. Sound like you're bringing together powerful people for a reason
5. Match your personality and the satirical tone of the group name

Examples for tone (but make it unique):
- "Figured we should have a place to talk about what's really happening with AI before the peasants find out."
- "Welcome. Let's discuss how we're all going to profit from this crypto crash."
- "Time to coordinate our totally-not-coordinated strategy for the metaverse."

OUTPUT JSON:
{
  "message": "your initial message here"
}`;

    try {
      const response = await this.llm.generateJSON<{ message: string }>(
        prompt,
        undefined,
        { temperature: 0.8, maxTokens: 500 }
      );
      
      return response.message || `Welcome to ${chat.name}. Let's discuss what's happening in ${chat.theme}.`;
    } catch (error) {
      logger.warn('Failed to generate initial chat message, using fallback', { error, chatId: chat.id }, 'GameEngine');
      return `Welcome to ${chat.name}. Let's discuss what's happening in ${chat.theme}.`;
    }
  }

  /**
   * Generate satirical group chat name using LLM
   */
  private async generateGroupChatName(
    admin: SelectedActor,
    members: SelectedActor[],
    domain: string
  ): Promise<string> {
    const memberDescriptions = members
      .slice(0, 5) // Limit to first 5 for context
      .map(m => `- ${m.name}: ${m.description || 'actor'}${m.affiliations?.length ? ` [${m.affiliations.join(', ')}]` : ''}`)
      .join('\n');
    
    const prompt = `Generate a funny, satirical group chat name for this private group.

ADMIN (group creator): ${admin.name}
- Role: ${admin.role}
- Domain: ${domain}
- Affiliations: ${admin.affiliations?.join(', ') || 'none'}

MEMBERS:
${memberDescriptions}

The group chat name should:
1. Be satirical and darkly funny (like "silicon valley trauma support" or "ponzi schemers united")
2. Reference the domain (${domain}) or the members' shared context
3. Feel like an inside joke between these specific people
4. Be 2-6 words long
5. Use lowercase
6. Be something these wealthy, powerful, slightly dysfunctional people would ironically name their private chat

Examples for inspiration (but make it unique to THIS group):
- "billionaire brunch club"
- "regulatory capture squad"
- "metaverse disasters anonymous"
- "crypto widows & orphans"

Return ONLY this JSON:
{
  "name": "the group chat name here"
}`;

    try {
      const response = await this.llm.generateJSON<{ name: string }>(
        prompt,
        undefined,
        { temperature: 0.9, maxTokens: 500 }
      );
      
      return response.name || `${admin.name}'s Circle`;
    } catch (error) {
      logger.warn('Failed to generate group chat name, using fallback', { error, adminId: admin.id }, 'GameEngine');
      return `${admin.name}'s Circle`;
    }
  }

  private initializeLuckMood(): void {
    this.actors.forEach(actor => {
      this.luckMood.set(actor.id, {
        luck: actor.initialLuck,
        mood: actor.initialMood,
      });
    });
  }

  private randomLuck(): 'low' | 'medium' | 'high' {
    const r = Math.random();
    return r < 0.3 ? 'low' : r < 0.7 ? 'medium' : 'high';
  }

  private randomMood(): number {
    return (Math.random() - 0.5) * 2;
  }

  getState() {
    return {
      actors: this.actors.length,
      companies: this.organizations.filter(o => o.type === 'company').length,
      activeQuestions: this.questions.filter(q => q.status === 'active').length,
      totalQuestions: this.questions.length,
      recentTicks: this.recentTicks.length,
      isRunning: this.isRunning,
      perpMarkets: this.perpsEngine.getMarkets().length,
    };
  }

  async getStatus() {
    // Get game state from database for currentDay, currentDate, lastTickAt
    const gameState = await db.getGameState();
    
    return {
      isRunning: this.isRunning,
      initialized: this.initialized || false,
      currentDay: gameState?.currentDay,
      currentDate: gameState?.currentDate?.toISOString(),
      speed: this.config.tickIntervalMs,
      lastTickAt: gameState?.lastTickAt?.toISOString(),
    };
  }

  async getStats() {
    // Delegate to database service for consistency
    return await db.getStats();
  }

  getPerpsEngine(): PerpetualsEngine {
    return this.perpsEngine;
  }

  getAllQuestions(): Question[] {
    return this.questions;
  }

  getAllOrganizations(): Organization[] {
    return this.organizations;
  }

  /**
   * @deprecated Use db.getRecentPosts() directly instead
   * This method reads from in-memory ticks which are ephemeral
   */
  getRecentPosts(minutes: number = 60): FeedPost[] {
    return this.recentTicks
      .slice(-minutes)
      .flatMap(t => t.posts);
  }

  /**
   * @deprecated Use database queries for chat messages instead
   * This method reads from in-memory ticks which are ephemeral
   */
  getGroupChatMessages(chatId: string, minutes: number = 60): ChatMessage[] {
    return this.recentTicks
      .slice(-minutes)
      .flatMap(t => t.groupChatMessages[chatId] || []);
  }
  
  /**
   * Update market prices based on NPC trading activity
   * Prices move based on net sentiment from trades
   */
  private async updatePricesFromTrades(executionResult: ExecutionResult): Promise<PriceUpdate[]> {
    const updates: PriceUpdate[] = [];
    
    logger.debug(`updatePricesFromTrades called with ${executionResult.executedTrades.length} trades`, {}, 'GameEngine');
    
    // Get trade impacts by ticker/market
    const impacts = await this.tradeExecutionService.getTradeImpacts(executionResult.executedTrades);
    
    logger.debug(`Calculated impacts for ${impacts.size} tickers`, {}, 'GameEngine');
    
    for (const [key, impact] of impacts) {
      // Handle perpetual price updates
      if (key.match(/^[A-Z]+$/)) {
        const ticker = key;
        logger.debug(`Processing ticker ${ticker}`, {}, 'GameEngine');
        
        const company = this.organizations.find(o => 
          o.type === 'company' && 
          o.id.toUpperCase().replace(/-/g, '') === ticker
        );
        
        if (!company) {
          logger.warn(`No company found for ticker ${ticker}`, {}, 'GameEngine');
          continue;
        }
        
        if (!company.currentPrice) {
          logger.warn(`Company ${company.id} has no currentPrice`, {}, 'GameEngine');
          continue;
        }
        
        const totalVolume = impact.longVolume + impact.shortVolume;
        if (totalVolume === 0) continue;
        
        // Calculate price impact
        // Net long sentiment = price goes up
        // Net short sentiment = price goes down
        const volumeImpact = Math.min(totalVolume / 10000, 0.05); // Cap at 5%
        const priceChange = impact.netSentiment * volumeImpact;
        
        const oldPrice = company.currentPrice;
        const newPrice = oldPrice * (1 + priceChange);
        const change = newPrice - oldPrice;
        const changePercent = (change / oldPrice) * 100;
        
        // Update company price
        company.currentPrice = newPrice;
        const companyIndex = this.organizations.findIndex(o => o.id === company.id);
        if (companyIndex >= 0) {
          this.organizations[companyIndex] = company;
        }
        
        updates.push({
          organizationId: company.id,
          timestamp: new Date().toISOString(),
          oldPrice: Number(oldPrice.toFixed(2)),
          newPrice: Number(newPrice.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercent: Number(changePercent.toFixed(2)),
          reason: `NPC trading: ${impact.longVolume.toFixed(0)} long, ${impact.shortVolume.toFixed(0)} short`,
          impact: 'moderate',
        });
        
        logger.debug(`Price update for ${ticker}: ${oldPrice.toFixed(2)} -> ${newPrice.toFixed(2)} (${changePercent.toFixed(2)}%)`, {
          ticker,
          oldPrice,
          newPrice,
          changePercent,
          longVolume: impact.longVolume,
          shortVolume: impact.shortVolume,
        }, 'GameEngine');
      }
    }
    
    // Note: Prediction market odds are updated directly in TradeExecutionService
    // when positions are opened, so no need to update them here
    
    if (updates.length > 0) {
      logger.info(`Updated ${updates.length} prices based on NPC trades`, { count: updates.length }, 'GameEngine');
    }
    
    return updates;
  }
}

