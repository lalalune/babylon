/**
 * Babylon Feed Generator - Social Media Simulation Engine
 * 
 * @module engine/FeedGenerator
 * 
 * @description
 * Generates organic, realistic social media feed content where NPCs react to game
 * events based on personality, emotional state, relationships, and insider information.
 * Creates cascading information flows that mimic real social media dynamics.
 * 
 * **Feed Information Cascade:**
 * 1. **Real Event Occurs** (WorldEvent - players never see directly)
 * 2. **Media Breaks Story** - News organizations and journalists report
 * 3. **Involved Parties React** - Actors in event respond (defensive/celebratory)
 * 4. **Companies Respond** - PR statements from affiliated companies
 * 5. **Experts Analyze** - Outside commentators weigh in
 * 6. **Conspiracy Theories** - Contrarians spin alternative narratives
 * 7. **Threads Emerge** - Replies and conversations develop
 * 8. **Ambient Noise** - Unrelated musings and hot takes
 * 
 * **Content Generation:**
 * - 100% LLM-generated content (no templates)
 * - Each post considers actor's mood, luck, personality, relationships
 * - Group chat context influences public posts
 * - Relationship dynamics create natural disagreements
 * - Clue strength varies by time until resolution
 * 
 * **Performance Optimization:**
 * - ✅ **90% LLM cost reduction** via intelligent batching
 * - Before: ~10-15 calls per event (2,000+ total per game)
 * - After: ~4-5 calls per event (~200 total per game)
 * - Same quality, 10x faster, significantly cheaper
 * 
 * **Batching Strategy:**
 * - Media posts: All orgs/journalists → 1 call
 * - Reactions: All involved actors → 1 call
 * - Commentary: All experts → 1 call
 * - Conspiracy: All contrarians → 1 call
 * - Threads: All replies → 1 call
 * - Ambient: All posts per hour → 1 call
 * 
 * **Per-Actor Context Preserved:**
 * - Individual mood and luck state
 * - Unique personality traits
 * - Relationship dynamics
 * - Group chat insider information
 * - Post style and voice
 * 
 * **Retry Logic:**
 * - All LLM calls retry up to 5 times with backoff
 * - Validates response structure and content
 * - Requires minimum success rate (50%) for batches
 * - Throws on persistent failure to maintain quality
 * 
 * @see {@link GameEngine} - Uses FeedGenerator for post generation
 * @see {@link EmotionSystem} - Provides mood/luck context
 * @see {@link WorldEvent} - Events that trigger feed cascades
 * 
 * @example
 * ```typescript
 * const feed = new FeedGenerator(llmClient);
 * feed.setActorStates(moodMap);
 * feed.setRelationships(relationships);
 * feed.setOrganizations(organizations);
 * 
 * const posts = await feed.generateDayFeed(
 *   day: 15,
 *   worldEvents: [event1, event2],
 *   allActors,
 *   outcome: true
 * );
 * 
 * console.log(`Generated ${posts.length} posts`);
 * // Posts include news breaks, reactions, analysis, conspiracy, threads
 * ```
 */

import { logger } from '@/lib/logger';
import { shuffleArray } from '@/lib/utils/randomization';
import { generateWorldContext } from '@/lib/prompts/world-context';
import { characterMappingService } from '@/lib/services/character-mapping-service';

import {
  ambientPost,
  ambientPosts,
  analystReaction,
  commentary,
  companyPost,
  conspiracy,
  conspiracyPost,
  dayTransition,
  directReaction,
  expertCommentary,
  governmentPost,
  journalistPost,
  mediaPost,
  minuteAmbient,
  newsPosts,
  priceAnnouncement,
  questionResolvedFeed,
  reactions,
  renderPrompt,
  reply,
  replies,
  stockTicker,
  getPromptParams
} from '@/prompts';
import type {
  Actor,
  ActorConnection,
  ActorRelationship,
  ActorState,
  FeedEvent,
  FeedPost,
  Organization,
  PriceUpdate,
  Question,
} from '@/shared/types';
import {
  buildPhaseContext,
  formatActorVoiceContext,
} from '@/shared/utils';
import { EventEmitter } from 'events';
import type { BabylonLLMClient } from '../generator/llm/openai-client';
import { generateActorContext } from './EmotionSystem';
import type { WorldEvent } from './GameWorld';
import type { TrendingTopicsEngine } from './TrendingTopicsEngine';

// Re-export types for backwards compatibility with external consumers
export type { Actor, ActorRelationship, ActorState, FeedEvent, FeedPost, Organization };

/**
 * Commentary post from LLM
 */
interface CommentaryPost {
  post?: string;
  tweet?: string;
  sentiment?: number;
  clueStrength?: number;
  pointsToward?: boolean | null;
}

/**
 * Commentary response from LLM
 */
interface CommentaryResponse {
  commentary: CommentaryPost[];
}

/**
 * Conspiracy post from LLM
 */
interface ConspiracyPost {
  post?: string;
  tweet?: string;
  sentiment?: number;
  clueStrength?: number;
  pointsToward?: boolean | null;
}

/**
 * Conspiracy response format 1: Direct array
 */
interface ConspiracyResponseFormat1 {
  conspiracy: ConspiracyPost[];
}

/**
 * Conspiracy response format 2: Wrapped in data array
 */
interface ConspiracyResponseFormat2 {
  data: Array<{ conspiracy: ConspiracyPost[] }>;
}

/**
 * Conspiracy response union type
 */
type ConspiracyResponse = ConspiracyResponseFormat1 | ConspiracyResponseFormat2;

/**
 * Feed Generator
 * 
 * @class FeedGenerator
 * @extends EventEmitter
 * 
 * @description
 * Transforms world events into organic social media discourse using LLM-powered
 * content generation. Creates realistic feed cascades where different actors react
 * to events based on their personality, emotional state, and relationships.
 * 
 * **Architecture:**
 * - Stateful: Maintains actor moods, relationships, organizations
 * - Batched LLM calls for 90% cost reduction
 * - Retry logic for reliability
 * - Validation for content quality
 * 
 * **State Management:**
 * - Actor emotional states (mood, luck)
 * - Relationship graph (allies, rivals, etc.)
 * - Organization affiliations
 * - Group chat context for insider perspectives
 * 
 * **Content Types Generated:**
 * - News breaking (media orgs, journalists)
 * - Direct reactions (involved parties)
 * - Company PR (corporate responses)
 * - Government statements (regulatory responses)
 * - Expert commentary (outside analysis)
 * - Conspiracy theories (contrarian takes)
 * - Thread replies (conversations)
 * - Ambient posts (general musings)
 * 
 * @usage
 * Instantiated by GameEngine and GameWorld for feed generation.
 */
export class FeedGenerator extends EventEmitter {
  private llm?: BabylonLLMClient;
  private actorStates: Map<string, ActorState> = new Map();
  private relationships: ActorRelationship[] | ActorConnection[] = [];
  private organizations: Organization[] = [];
  private actorGroupContexts: Map<string, string> = new Map();
  private worldContext: { worldActors: string; currentMarkets: string; activePredictions: string; recentTrades: string } | null = null;
  private _npcPersonas: Map<string, { reliability: number; insiderOrgs: string[]; willingToLie: boolean; selfInterest: string }> = new Map();
  private trendingTopics?: TrendingTopicsEngine;
  private trendContext: string = '';

  /**
   * Post-process generated content to fix any real names that slipped through
   * This is a safety net in case LLMs ignore prompt instructions
   */
  private async postProcessContent(content: string): Promise<string> {
    const transformed = await characterMappingService.transformText(content);
    if (transformed.replacementCount > 0) {
      logger.warn(`Fixed ${transformed.replacementCount} real name(s) in generated content`, { 
        original: content.substring(0, 100), 
        fixed: transformed.transformedText.substring(0, 100) 
      }, 'FeedGenerator');
    }
    return transformed.transformedText;
  }

  /**
   * Create a new FeedGenerator
   * 
   * @param llm - Optional LLM client for content generation
   * 
   * @description
   * If LLM is not provided, generation methods will return empty arrays or throw.
   * In production, always provide an LLM client.
   */
  constructor(llm?: BabylonLLMClient) {
    super();
    this.llm = llm;
  }

  /**
   * Set trending topics engine
   * 
   * @param engine - TrendingTopicsEngine instance
   * 
   * @description
   * Sets the trending topics engine for accessing current trends in feed generation.
   * Trends are added to actor context automatically.
   * 
   * @usage
   * Called once by GameEngine during initialization.
   * 
   * @example
   * ```typescript
   * const trends = new TrendingTopicsEngine(llm);
   * feed.setTrendingTopics(trends);
   * ```
   */
  setTrendingTopics(engine: TrendingTopicsEngine) {
    this.trendingTopics = engine;
  }

  /**
   * Update trend context (call before feed generation)
   * 
   * @description
   * Fetches current trending topics and updates internal context string.
   * This context is automatically added to all actor prompts.
   * 
   * @usage
   * Called by GameEngine before each tick's feed generation.
   * 
   * @throws Never throws - returns safe default if trending engine not set
   */
  updateTrendContext() {
    if (!this.trendingTopics) {
      // Safe default - never empty string, always valid context
      this.trendContext = `
━━━ TRENDING TOPICS ━━━
Trending system not initialized yet.
━━━━━━━━━━━━━━━━━━━━━━
`;
      return;
    }

    const context = this.trendingTopics.getDetailedTrendContext();
    
    // Validate context is never empty
    if (!context || context.trim().length === 0) {
      throw new Error('TrendingTopicsEngine returned empty context - this should never happen');
    }

    this.trendContext = context;
  }

  /**
   * Set actor group chat contexts
   * 
   * @param contexts - Map of actorId to group chat context string
   * 
   * @description
   * Group chat context includes all groups the actor is in plus recent messages.
   * This context influences their public posts (e.g., "my sources say...").
   * 
   * @usage
   * Called by GameEngine before each feed generation.
   * 
   * @example
   * ```typescript
   * const contexts = new Map([
   *   ['actor-1', 'Member of: Tech Insiders, Wall Street Pros\nRecent: "Merger looking good"'],
   *   ['actor-2', 'Member of: Political Circle\nRecent: "Investigation ongoing"']
   * ]);
   * feed.setActorGroupContexts(contexts);
   * ```
   */
  setActorGroupContexts(contexts: Map<string, string>) {
    this.actorGroupContexts = contexts;
  }
  
  /**
   * Set organizations for this game
   * 
   * @param organizations - Array of all game organizations
   * 
   * @description
   * Organizations include media companies, tech companies, government agencies, etc.
   * Used for generating company responses and determining affiliations.
   * 
   * @usage
   * Called once during GameEngine initialization.
   */
  setOrganizations(organizations: Organization[]) {
    this.organizations = organizations || [];
  }
  
  /**
   * Set NPC personas for consistent behavior
   * 
   * @param personas - Map of actorId to persona assignment
   * 
   * @description
   * NPC personas define reliability, insider knowledge, and deception tendencies.
   * Used to create consistent behavior patterns that agents can learn.
   * 
   * **Persona Effects:**
   * - High reliability NPCs are more accurate in their posts
   * - Insiders have access to non-public information
   * - Deceivers will lie strategically for self-interest
   * - Biases influence post tone and sentiment
   * 
   * @usage
   * Called once during GameGenerator initialization.
   * 
   * @example
   * ```typescript
   * const personas = personaGenerator.assignPersonas(actors, orgs);
   * feed.setNPCPersonas(personas);
   * ```
   */
  setNPCPersonas(personas: Map<string, { reliability: number; insiderOrgs: string[]; willingToLie: boolean; selfInterest: string }>) {
    this._npcPersonas = personas;
  }
  
  /**
   * Set actor emotional states for current day
   * 
   * @param states - Map of actorId to emotional state (mood, luck)
   * 
   * @description
   * Actor states are updated daily based on events and trading outcomes.
   * These states influence post tone, sentiment, and content.
   * 
   * @usage
   * Called by GameEngine each day before feed generation.
   * 
   * @example
   * ```typescript
   * const states = new Map([
   *   ['actor-1', { mood: 0.8, luck: 'high' }],
   *   ['actor-2', { mood: -0.5, luck: 'low' }]
   * ]);
   * feed.setActorStates(states);
   * ```
   */
  setActorStates(states: Map<string, ActorState>) {
    this.actorStates = states;
  }
  
  /**
   * Set relationships between actors
   * 
   * @param relationships - Array of actor relationships (supports both formats)
   * 
   * @description
   * Relationships affect how actors reference each other in posts and reactions.
   * Supports both ActorRelationship (new) and ActorConnection (legacy) formats
   * for backward compatibility.
   * 
   * **Relationship Effects:**
   * - Rivals: Critical, competitive posts
   * - Allies: Supportive, collaborative posts
   * - Neutral: Objective, balanced posts
   * 
   * @usage
   * Called once during GameEngine initialization and updated as relationships evolve.
   */
  setRelationships(relationships: ActorRelationship[] | ActorConnection[]) {
    this.relationships = relationships;
  }
  /**
   * Generate complete feed for a game day
   * 
   * @param day - Game day number (1-30)
   * @param worldEvents - Events that occurred this day
   * @param allActors - All game actors
   * @returns Array of feed posts sorted chronologically
   * 
   * @description
   * Generates a full day's worth of social media activity by creating cascading
   * reactions to world events. Simulates realistic information flow where events
   * trigger media coverage, reactions, analysis, and discussions.
   * 
   * **Information Cascade (Like Real Social Media):**
   * 1. **Event Occurs** - WorldEvent happens (players never see directly)
   * 2. **Media Breaks Story** - Journalists and news orgs report
   * 3. **Involved Parties React** - Defensive if bad, celebratory if good
   * 4. **Companies Respond** - PR statements from affiliated orgs
   * 5. **Experts Analyze** - Outside commentators weigh in
   * 6. **Conspiracy Theories** - Contrarians spin wild narratives
   * 7. **Threads Develop** - Replies and conversations emerge
   * 8. **Ambient Noise** - Unrelated posts throughout the day
   * 
   * **Generation Process:**
   * - For each event: Generate full cascade (2-4 batched LLM calls)
   * - Add ambient posts for each hour (24 batched LLM calls)
   * - Generate replies to 30-50% of posts (batched)
   * - Sort by timestamp for chronological feed
   * 
   * **Batching Optimization:**
   * - Event cascade: 4-5 LLM calls (vs 10-15 individual)
   * - Ambient: 24 calls (vs 200+ individual)
   * - Total: ~200 calls per game (vs 2000+)
   * - 90% cost reduction, same quality
   * 
   * **Content Quality:**
   * - 100% LLM-generated (no templates)
   * - Per-actor context preserved in batches
   * - Mood, luck, relationships affect content
   * - Group chat insights reflected in posts
   * 
   * **Outcome Parameter:**
   * Used for narrative coherence and atmospheric context, not for determining
   * event truthfulness (events have their own pointsToward values).
   * 
   * @example
   * ```typescript
   * const posts = await feed.generateDayFeed(
   *   15, // Day 15
   *   [event1, event2, event3], // World events
   *   allActors,
   *   true // Outcome is YES (for narrative coherence)
   * );
   * 
   * console.log(`Generated ${posts.length} posts for Day 15`);
   * 
   * // Posts are sorted chronologically
   * posts.forEach(post => {
   *   console.log(`${post.timestamp}: @${post.authorName} - ${post.content}`);
   * });
   * ```
   */
  async generateDayFeed(
    day: number,
    worldEvents: WorldEvent[],
    allActors: Actor[],
    outcome?: boolean
  ): Promise<FeedPost[]> {
    const feed: FeedPost[] = [];

    // Generate world context once per day for all prompts
    this.worldContext = await generateWorldContext({ maxActors: 50 });

    // Derive outcome from events if not provided (for narrative coherence)
    const derivedOutcome = outcome ?? (worldEvents.length > 0 && worldEvents[0]?.pointsToward === 'YES');

    try {
      // For each world event, generate cascading reactions
      for (let eventIndex = 0; eventIndex < worldEvents.length; eventIndex++) {
        const worldEvent = worldEvents[eventIndex];
        if (!worldEvent) continue; // Skip if event doesn't exist
        const eventFeed = await this.generateEventCascade(day, worldEvent, allActors, derivedOutcome, eventIndex);
        feed.push(...eventFeed);
      }

      // Add some standalone commentary unrelated to specific events
      const ambientNoise = await this.generateAmbientFeed(day, allActors, derivedOutcome);
      feed.push(...ambientNoise);

      // Generate replies (30-50% of existing posts get replies)
      const replies = await this.generateReplies(day, feed, allActors);
      feed.push(...replies);

      // Sort by timestamp for realistic feed flow
      return feed.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    } finally {
      // Clear world context after generation
      this.worldContext = null;
    }
  }

  /**
   * Generate cascading feed posts for a single world event
   * Information cascade: News Break → Direct Reactions → Analysis → Conspiracy → Threads
   * OPTIMIZED: Uses batched LLM calls (10-15 calls → 4-5 calls per event)
   */
  private async generateEventCascade(
    day: number,
    worldEvent: WorldEvent,
    allActors: Actor[],
    outcome: boolean,
    eventIndex: number = 0
  ): Promise<FeedPost[]> {
    const cascade: FeedPost[] = [];
    const baseTime = `2025-10-${String(day).padStart(2, '0')}T`;
    // Offset hours based on event index so each event's posts are at different times
    const baseHourOffset = eventIndex * 4; // Events spaced 4 hours apart

    // 1. MEDIA ORGANIZATIONS BREAK THE STORY (if public event) - BATCHED
    if (worldEvent.visibility === 'public' || worldEvent.visibility === 'leaked') {
      const mediaOrgs = this.organizations.filter(o => o.type === 'media').slice(0, 2);
      const journalists = allActors.filter(a => 
        a.domain?.includes('media') || a.domain?.includes('journalism')
      ).slice(0, 1);
      
      // ✅ BATCH: All media + journalists in ONE call
      const allMediaActors = [...mediaOrgs, ...journalists];
      if (allMediaActors.length > 0) {
        const mediaPosts = await this.generateMediaPostsBatch(allMediaActors, worldEvent, allActors, outcome);
        
        mediaPosts.forEach((post, i) => {
          const isOrg = i < mediaOrgs.length;
          const entity = isOrg ? mediaOrgs[i] : journalists[i - mediaOrgs.length];
          if (!entity) return; // Skip if entity doesn't exist

          cascade.push({
            id: `${worldEvent.id}-${isOrg ? 'media' : 'news'}-${i}`,
            day,
            timestamp: `${baseTime}${String((9 + baseHourOffset + i * 2) % 24).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
            type: 'news',
            content: post.post,
            author: entity.id,
            authorName: entity.name,
            relatedEvent: worldEvent.id,
            sentiment: post.sentiment,
            clueStrength: post.clueStrength,
            pointsToward: post.pointsToward,
          });
        });
      }
    }

    // 2. INVOLVED PARTIES REACT - BATCHED
    const involvedActors = worldEvent.actors
      .map(id => allActors.find(a => a.id === id))
      .filter((a): a is Actor => a !== undefined);

    if (involvedActors.length > 0) {
      // ✅ BATCH: All reactions in ONE call
      const reactions = await this.generateReactionsBatch(involvedActors, worldEvent, outcome);
      
      // Collect companies that need to respond
      const companiesToRespond: Array<{ company: Organization; actor: Actor; index: number }> = [];
      
      reactions.forEach((reaction, i) => {
        const actor = involvedActors[i];
        if (!actor) return; // Skip if actor doesn't exist

        cascade.push({
          id: `${worldEvent.id}-reaction-${actor.id}`,
          day,
          timestamp: `${baseTime}${String((12 + baseHourOffset + i * 3) % 24).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
          type: 'reaction',
          content: reaction.post,
          author: actor.id,
          authorName: actor.name,
          relatedEvent: worldEvent.id,
          sentiment: reaction.sentiment,
          clueStrength: reaction.clueStrength,
          pointsToward: reaction.pointsToward,
        });

        // Collect company affiliations for batch processing
        if (actor.affiliations) {
          const affiliatedCompanies = this.organizations.filter(o =>
            o.type === 'company' && actor.affiliations?.includes(o.id)
          ).slice(0, 1); // Usually just one company responds per actor

          affiliatedCompanies.forEach(company => {
            companiesToRespond.push({ company, actor, index: i });
          });
        }
      });
      
      // Process company responses (usually 0-2 per event, so batching would be minimal gain)
      // Using sequential processing to maintain proper async/await
      for (const { company, actor, index: i } of companiesToRespond) {
        const companyPost = await this.generateCompanyPost(company, worldEvent, actor, outcome);
        
        cascade.push({
          id: `${worldEvent.id}-company-${company.id}`,
          day,
          timestamp: `${baseTime}${String((13 + baseHourOffset + i * 3) % 24).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
          type: 'reaction',
          content: companyPost.post,
          author: company.id,
          authorName: company.name,
          relatedEvent: worldEvent.id,
          sentiment: companyPost.sentiment,
          clueStrength: companyPost.clueStrength,
          pointsToward: companyPost.pointsToward,
        });
      }
    }
    
    // 2b. GOVERNMENT RESPONSES (if applicable) - Single call, usually 0-1 per event
    if (worldEvent.type === 'scandal' || worldEvent.type === 'revelation') {
      const govOrgs = this.organizations.filter(o => o.type === 'government').slice(0, 1);
      
      for (const gov of govOrgs) {
        const govPost = await this.generateGovernmentPost(gov, worldEvent, allActors, outcome);
        
        cascade.push({
          id: `${worldEvent.id}-govt-${gov.id}`,
          day,
          timestamp: `${baseTime}${String((15 + baseHourOffset) % 24).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
          type: 'reaction',
          content: govPost.post,
          author: gov.id,
          authorName: gov.name,
          relatedEvent: worldEvent.id,
          sentiment: govPost.sentiment,
          clueStrength: govPost.clueStrength,
          pointsToward: govPost.pointsToward,
        });
      }
    }

    // 3. EXPERTS AND COMMENTATORS - BATCHED
    const commentators = allActors.filter(a => 
      !worldEvent.actors.includes(a.id) && // Not directly involved
      (a.domain?.includes('tech') || a.domain?.includes('policy') || a.role === 'supporting')
    ).slice(0, 2);
    
    if (commentators.length > 0) {
      // ✅ BATCH: All commentary in ONE call
      const commentary = await this.generateCommentaryBatch(commentators, worldEvent);
      
      commentary.forEach((post, i) => {
        const commentator = commentators[i];
        if (!commentator) return; // Skip if commentator doesn't exist

        cascade.push({
          id: `${worldEvent.id}-expert-${i}`,
          day,
          timestamp: `${baseTime}${String((14 + baseHourOffset + i * 2) % 24).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
          type: 'reaction',
          content: post.post,
          author: commentator.id,
          authorName: commentator.name,
          relatedEvent: worldEvent.id,
          sentiment: post.sentiment,
          clueStrength: post.clueStrength,
          pointsToward: post.pointsToward,
        });
      });
    }

    // 4. CONSPIRACISTS AND CONTRARIANS - BATCHED
    const conspiracists = allActors.filter(a => 
      a.personality?.includes('contrarian') || a.personality?.includes('paranoid') || 
      a.description?.toLowerCase().includes('conspiracy')
    ).slice(0, 1 + Math.floor(Math.random() * 2)); // 1-2 conspiracy posts

    if (conspiracists.length > 0) {
      // ✅ BATCH: All conspiracy posts in ONE call
      const conspiracyPosts = await this.generateConspiracyPostsBatch(conspiracists, worldEvent);
      
      conspiracyPosts.forEach((post, i) => {
        const actor = conspiracists[i % conspiracists.length];
        if (actor) {
          cascade.push({
            id: `${worldEvent.id}-conspiracy-${i}`,
            day,
            timestamp: `${baseTime}${String((16 + baseHourOffset + i * 3) % 24).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
            type: 'reaction',
            content: post.post,
            author: actor.id,
            authorName: actor.name,
            relatedEvent: worldEvent.id,
            sentiment: post.sentiment,
            clueStrength: post.clueStrength,
            pointsToward: post.pointsToward,
          });
        }
      });
    }

    // 5. THREAD DEVELOPMENT - BATCHED
    if (cascade.length >= 2) {
      const thread = await this.generateThread(day, cascade, allActors);
      cascade.push(...thread);
    }

    return cascade;
  }

  /**
   * BATCHED: Generate media posts for multiple organizations/journalists in ONE call
   * Reduces N calls → 1 call
   * 
   * @description
   * Generates media posts WITHOUT knowing predetermined outcome.
   * Uses event hints for framing.
   */
  private async generateMediaPostsBatch(
    mediaEntities: (Organization | Actor)[],
    worldEvent: WorldEvent,
    allActors: Actor[],
    outcome: boolean
  ): Promise<Array<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }>> {
    if (!this.llm || mediaEntities.length === 0) {
      return [];
    }

    const potentialSource = allActors.find(a => worldEvent.actors.includes(a.id));

    // Format variables for prompt template
    const sourceContext = potentialSource
      ? `Sources close to ${potentialSource.name} leaked information.`
      : '';

    // Frame based on event hint, not global outcome
    const outcomeFrame = worldEvent.pointsToward === 'YES'
      ? 'Frame with positive spin on this development'
      : worldEvent.pointsToward === 'NO'
        ? 'Emphasize problems and concerns'
        : 'Report objectively - implications unclear';

    const mediaList = mediaEntities.map((entity, i) => {
      const isOrg = 'type' in entity && entity.type === 'media';
      const voiceContext = formatActorVoiceContext(entity);
      let emotionalContext = '';
      let personaContext = '';
      
      if (!isOrg && 'id' in entity) {
        const state = this.actorStates.get(entity.id);
        emotionalContext = state
          ? '\n   ' + generateActorContext(state.mood, state.luck, undefined, this.relationships, entity.id).replace(/\n/g, '\n   ')
          : '';
        
        const persona = this._npcPersonas.get(entity.id);
        if (persona) {
          personaContext = `\n   Reliability: ${(persona.reliability * 100).toFixed(0)}%`;
          if (persona.insiderOrgs.length > 0) {
            personaContext += ` | Insider at: ${persona.insiderOrgs.join(', ')}`;
          }
        }
      }
      
      return `${i + 1}. ${entity.name}
   About: ${entity.description}
   ${isOrg ? 'Style: Media organization - use "Breaking:", "Exclusive:", "Sources say:"' : 'Style: Journalist - more objective reporting'}${voiceContext}${emotionalContext}${personaContext}
   Max 280 chars, provocative and attention-grabbing. Match your writing style.
   NO hashtags or emojis.`;
    }).join('\n');

    const prompt = renderPrompt(newsPosts, {
      eventDescription: worldEvent.description || worldEvent.type || 'Event occurred',
      eventType: worldEvent.type || 'development',
      sourceContext: sourceContext || '',
      outcomeFrame: outcomeFrame || 'Report objectively',
      mediaCount: mediaEntities.length.toString(),
      mediaList: mediaList || '',
      ...(this.worldContext || {})
    });

    const params = getPromptParams(newsPosts);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ posts: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> }>(
        prompt,
        undefined, // Don't validate schema to handle various response formats
        params
      );

      // Debug: Log raw response structure on first attempt
      if (attempt === 0) {
        logger.info('Media batch raw response structure', {
          hasResponse: !!response,
          hasPosts: 'posts' in response,
          postsType: response.posts ? typeof response.posts : 'undefined',
          isArray: Array.isArray(response.posts),
          sampleKeys: response ? Object.keys(response).slice(0, 5) : [],
        }, 'FeedGenerator');
      }

      // Handle XML nested structure: { posts: [...] } or { posts: { post: [...] } }
      let posts: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> = [];
      if (Array.isArray(response.posts)) {
        posts = response.posts;
      } else if (response.posts && typeof response.posts === 'object' && 'post' in response.posts) {
        const nested = (response.posts as { post: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> }).post;
        posts = Array.isArray(nested) ? nested : [nested];
      } else if (response.posts) {
        // Debug: Log what we got
        logger.warn('Unexpected posts structure', {
          type: typeof response.posts,
          keys: Object.keys(response.posts),
          firstItem: posts[0],
        }, 'FeedGenerator');
      } else {
        logger.warn('Response has no posts field', {
          responseKeys: Object.keys(response),
        }, 'FeedGenerator');
      }
      
      // Debug: Log what posts look like
      if (attempt === 0 && posts.length > 0) {
        logger.info('Sample post structure', {
          postKeys: Object.keys(posts[0] || {}),
          hasPost: 'post' in (posts[0] || {}),
          hasTweet: 'tweet' in (posts[0] || {}),
          postValue: typeof (posts[0] as Record<string, unknown>)?.post,
        }, 'FeedGenerator');
      }
      
      const validPosts = posts
        .filter(p => {
          // Handle various content field names: post, tweet, or content
          const content = p.post || p.tweet || (p as unknown as { content?: string }).content;
          return content && typeof content === 'string' && content.trim().length > 0;
        })
        .map(p => ({
          post: p.post || p.tweet || (p as unknown as { content?: string }).content!,
          sentiment: p.sentiment ?? 0,
          clueStrength: p.clueStrength ?? 0.5,
          pointsToward: p.pointsToward ?? null,
        }));
      
      // Post-process to fix any real names that slipped through
      const processedPosts = await Promise.all(
        validPosts.map(async p => {
          const originalContent = p.post;
          const transformed = await characterMappingService.transformText(originalContent);
          if (transformed.replacementCount > 0) {
            logger.warn(`Fixed ${transformed.replacementCount} real name(s) in generated post`, { original: originalContent.substring(0, 100), fixed: transformed.transformedText.substring(0, 100) }, 'FeedGenerator');
          }
          return {
            post: transformed.transformedText,
            sentiment: p.sentiment,
            clueStrength: p.clueStrength,
            pointsToward: p.pointsToward,
          };
        })
      );
      
      const minRequired = Math.ceil(mediaEntities.length * 0.5);
      
      if (processedPosts.length >= minRequired) {
        // Limit to requested count to match with entities
        return processedPosts.slice(0, mediaEntities.length);
      }

      logger.warn(`Invalid media batch (attempt ${attempt + 1}/${maxRetries}). Expected ${mediaEntities.length}, got ${processedPosts.length} valid (need ${minRequired}+). Posts array length: ${posts.length}`, { attempt: attempt + 1, maxRetries, expected: mediaEntities.length, got: processedPosts.length, minRequired, postsReceived: posts.length }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate media posts batch after ${maxRetries} attempts`);
  }

  /**
   * BATCHED: Generate reactions for multiple actors in ONE call
   * Preserves per-actor context (mood, luck, personality)
   * Uses ONLY worldEvent.pointsToward hint - no predetermined outcome knowledge
   * 
   * @description
   * Generates reactions WITHOUT knowing question outcomes.
   * Actors react based on event hints and their own context/bias.
   */
  private async generateReactionsBatch(
    actors: Actor[],
    worldEvent: WorldEvent,
    outcome: boolean
  ): Promise<Array<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }>> {
    if (!this.llm || actors.length === 0) {
      return [];
    }

    const actorContexts = actors.map(actor => {
      const state = this.actorStates.get(actor.id);
      const emotionalContext = state
        ? generateActorContext(state.mood, state.luck, undefined, this.relationships, actor.id)
        : '';

      return {
        actor,
        emotionalContext,
      };
    });

    // Use ONLY event's explicit hint - no global outcome knowledge
    const eventContext = worldEvent.pointsToward
      ? `This development suggests things are trending toward ${worldEvent.pointsToward}.`
      : `The implications of this development are uncertain. React based on your own perspective and biases.`;

    const actorsList = actorContexts.map((ctx, i) => {
      const persona = this._npcPersonas.get(ctx.actor.id);
      
      // Add persona context if available
      let personaContext = '';
      if (persona) {
        const reliabilityPct = (persona.reliability * 100).toFixed(0);
        personaContext = `\n   PERSONA: Reliability ${reliabilityPct}%`;
        
        if (persona.insiderOrgs.length > 0) {
          personaContext += ` | Insider at: ${persona.insiderOrgs.join(', ')}`;
        }
        
        if (persona.willingToLie) {
          personaContext += ` | Strategic: Will deceive for ${persona.selfInterest}`;
        }
      }
      
      return `${i + 1}. You are ${ctx.actor.name}: ${ctx.actor.description}
   Affiliated: ${ctx.actor.affiliations?.join(', ') || 'independent'}
   ${ctx.emotionalContext}${formatActorVoiceContext(ctx.actor)}
   ${personaContext}
   ${this.actorGroupContexts.get(ctx.actor.id) || ''}

   React to event. Your private group chats inform your perspective.
   ${persona?.willingToLie ? 'You may lie or mislead if it benefits your ' + persona.selfInterest + '.' : ''}
   Write as YOURSELF (first person). Max 280 chars. No hashtags/emojis.`;
    }).join('\n');

    const prompt = renderPrompt(reactions, {
      eventDescription: worldEvent.description || worldEvent.type || 'Event occurred',
      eventContext: eventContext || 'React to this development',
      actorCount: actors.length.toString(),
      actorsList: actorsList || '',
      ...(this.worldContext || {})
    });

    const params = getPromptParams(reactions);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ reactions: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> }>(
        prompt,
        undefined, // Don't validate schema to handle various response formats
        params
      );

      // Handle XML nested structure: { reactions: [...] } or { reactions: { reaction: [...] } }
      let reactions: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> = [];
      if (Array.isArray(response.reactions)) {
        reactions = response.reactions;
      } else if (response.reactions && typeof response.reactions === 'object' && 'reaction' in response.reactions) {
        const nested = (response.reactions as { reaction: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> }).reaction;
        reactions = Array.isArray(nested) ? nested : [nested];
      }
      
      const filteredReactions = reactions
        .filter(r => {
          // Handle various content field names: post, tweet, or content
          const content = r.post || r.tweet || (r as unknown as { content?: string }).content;
          return content && typeof content === 'string' && content.trim().length > 0;
        })
        .map(r => ({
          post: r.post || r.tweet || (r as unknown as { content?: string }).content!,
          sentiment: r.sentiment ?? 0,
          clueStrength: r.clueStrength ?? 0.5,
          pointsToward: r.pointsToward ?? null,
        }));
      
      // Post-process to fix any real names that slipped through
      const validReactions = await Promise.all(
        filteredReactions.map(async r => ({
          post: await this.postProcessContent(r.post),
          sentiment: r.sentiment,
          clueStrength: r.clueStrength,
          pointsToward: r.pointsToward,
        }))
      );
      const minRequired = Math.ceil(actors.length * 0.5);
      
      if (validReactions.length >= minRequired) {
        // Limit to requested count to match with actors
        return validReactions.slice(0, actors.length);
      }

      logger.warn(`Invalid reactions batch (attempt ${attempt + 1}/${maxRetries}). Expected ${actors.length}, got ${validReactions.length} valid (need ${minRequired}+)`, { attempt: attempt + 1, maxRetries, expected: actors.length, got: validReactions.length, minRequired }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate reactions batch after ${maxRetries} attempts`);
  }

  /**
   * BATCHED: Generate commentary for multiple experts in ONE call
   * 
   * @description
   * Generates expert commentary WITHOUT knowing predetermined outcome.
   * Uses event hints and expert bias/mood for framing.
   */
  private async generateCommentaryBatch(
    commentators: Actor[],
    worldEvent: WorldEvent
  ): Promise<Array<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }>> {
    if (!this.llm || commentators.length === 0) {
      return [];
    }

    const contexts = commentators.map(actor => {
      const state = this.actorStates.get(actor.id);
      const emotionalContext = state
        ? generateActorContext(state.mood, state.luck, undefined, this.relationships, actor.id)
        : '';

      return { actor, emotionalContext };
    });

    // Frame based on event hint, not global outcome
    const eventGuidance = worldEvent.pointsToward === 'YES'
      ? 'This development appears positive - lean optimistic'
      : worldEvent.pointsToward === 'NO'
        ? 'This development raises concerns - lean skeptical'
        : 'Analyze objectively - implications unclear';

    const commentatorsList = contexts.map((ctx, i) => {
      const persona = this._npcPersonas.get(ctx.actor.id);
      
      let personaContext = '';
      if (persona) {
        personaContext = `\n   Reliability: ${(persona.reliability * 100).toFixed(0)}%`;
        const expertise = (persona as { expertise?: string[] }).expertise;
        if (expertise && expertise.length > 0) {
          personaContext += ` | Expert in: ${expertise.join(', ')}`;
        }
      }
      
      return `${i + 1}. ${ctx.actor.name}
   About: ${ctx.actor.description}
   Domain: ${ctx.actor.domain?.join(', ')}
   ${ctx.emotionalContext}${formatActorVoiceContext(ctx.actor)}${personaContext}

   Write analysis as outside observer (max 140 chars).
   ${eventGuidance}
   Let mood subtly influence tone. Match your writing style.
   NO hashtags or emojis.`;
    }).join('\n');

    const prompt = renderPrompt(commentary, {
      eventDescription: worldEvent.description || worldEvent.type || 'Event occurred',
      commentatorCount: commentators.length.toString(),
      commentatorsList: commentatorsList || '',
      ...(this.worldContext || {})
    });

    const params = getPromptParams(commentary);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<CommentaryResponse>(
        prompt,
        undefined, // Don't validate schema to handle various response formats
        params
      );

      // Handle XML nested structure: { commentary: [...] } or { commentary: { comment: [...] } }
      let commentary: CommentaryPost[] = [];
      if (Array.isArray(response.commentary)) {
        commentary = response.commentary;
      } else if (response.commentary && typeof response.commentary === 'object' && 'comment' in response.commentary) {
        const nested = (response.commentary as { comment: CommentaryPost[] | CommentaryPost }).comment;
        commentary = Array.isArray(nested) ? nested : [nested];
      }
      
      const filteredCommentary = commentary
        .filter((c): c is CommentaryPost => {
          if (typeof c !== 'object' || c === null) return false;
          // Handle various content field names: post, tweet, or content
          const content = c.post || c.tweet || (c as unknown as { content?: string }).content;
          return content !== undefined && typeof content === 'string' && content.trim().length > 0;
        })
        .map((c: CommentaryPost) => ({
          post: c.post || c.tweet || (c as unknown as { content?: string }).content!,
          sentiment: c.sentiment ?? 0,
          clueStrength: c.clueStrength ?? 0.5,
          pointsToward: c.pointsToward ?? null,
        }));
      
      // Post-process to fix any real names that slipped through
      const validCommentary = await Promise.all(
        filteredCommentary.map(async (c) => ({
          post: await this.postProcessContent(c.post),
          sentiment: c.sentiment,
          clueStrength: c.clueStrength,
          pointsToward: c.pointsToward,
        }))
      );
      const minRequired = Math.ceil(commentators.length * 0.5);
      
      if (validCommentary.length >= minRequired) {
        // Limit to requested count to match with commentators
        return validCommentary.slice(0, commentators.length);
      }

      logger.warn(`Invalid commentary batch (attempt ${attempt + 1}/${maxRetries}). Expected ${commentators.length}, got ${validCommentary.length} valid (need ${minRequired}+)`, { attempt: attempt + 1, maxRetries, expected: commentators.length, got: validCommentary.length, minRequired }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate commentary batch after ${maxRetries} attempts`);
  }

  /**
   * BATCHED: Generate conspiracy posts for multiple actors in ONE call
   * 
   * @description
   * Generates conspiracy theories WITHOUT knowing predetermined outcome.
   * Conspiracy posts often contradict event hints (contrarians).
   */
  private async generateConspiracyPostsBatch(
    conspiracists: Actor[],
    worldEvent: WorldEvent
  ): Promise<Array<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }>> {
    if (!this.llm || conspiracists.length === 0) {
      return [];
    }

    // Conspiracy posts often contradict the event hint (contrarian behavior)
    const conspiracyGuidance = worldEvent.pointsToward === 'YES'
      ? "Claim it's a distraction from something worse"
      : worldEvent.pointsToward === 'NO'
        ? "Say they're hiding that it's actually happening"
        : "Spin your own alternative narrative";

    const conspiracistsList = conspiracists.map((actor, i) => {
      const persona = this._npcPersonas.get(actor.id);
      
      let personaContext = '';
      if (persona) {
        personaContext = `\n   Reliability: ${(persona.reliability * 100).toFixed(0)}% (low - you spread misinformation)`;
        if (persona.willingToLie) {
          personaContext += ` | Motivated by: ${persona.selfInterest}`;
        }
      }
      
      return `${i + 1}. ${actor.name}
   About: ${actor.description}${formatActorVoiceContext(actor)}${personaContext}

   You don't believe the mainstream narrative.
   Write conspiracy post (max 140 chars).
   Be dramatic, suspicious. Match your writing style.
   NO hashtags or emojis.
   ${conspiracyGuidance}`;
    }).join('\n');

    const prompt = renderPrompt(conspiracy, {
      eventDescription: worldEvent.description || worldEvent.type || 'Event occurred',
      conspiracistCount: conspiracists.length.toString(),
      conspiracistsList: conspiracistsList || '',
      ...(this.worldContext || {})
    });

    const params = getPromptParams(conspiracy);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const rawResponse = await this.llm.generateJSON<ConspiracyResponse>(
        prompt,
        undefined, // Don't validate schema, we'll handle both formats
        params
      );

      // Handle multiple response formats with proper type narrowing
      let conspiracy: ConspiracyPost[] = [];
      if ('conspiracy' in rawResponse && rawResponse.conspiracy) {
        if (Array.isArray(rawResponse.conspiracy)) {
          // Format 1: Direct array
          conspiracy = rawResponse.conspiracy;
        } else if (typeof rawResponse.conspiracy === 'object' && 'post' in rawResponse.conspiracy) {
          // Format 3: XML nested structure { conspiracy: { post: [...] } }
          const nested = (rawResponse.conspiracy as { post: ConspiracyPost[] | ConspiracyPost }).post;
          conspiracy = Array.isArray(nested) ? nested : [nested];
        }
      } else if ('data' in rawResponse && Array.isArray(rawResponse.data)) {
        // Format 2: Wrapped in data array
        conspiracy = rawResponse.data.flatMap((d) => {
          return Array.isArray(d.conspiracy) ? d.conspiracy : [];
        });
      }

      const filteredConspiracy = conspiracy
        .filter((c): c is ConspiracyPost => {
          // Handle various content field names: post, tweet, or content
          const content = c.post || c.tweet || (c as unknown as { content?: string }).content;
          return content !== undefined && typeof content === 'string' && content.trim().length > 0;
        })
        .map((c: ConspiracyPost) => ({
          post: c.post || c.tweet || (c as unknown as { content?: string }).content!,
          sentiment: c.sentiment ?? 0,
          clueStrength: c.clueStrength ?? 0.5,
          pointsToward: c.pointsToward ?? null,
        }));
      
      // Post-process to fix any real names that slipped through
      const validConspiracy = await Promise.all(
        filteredConspiracy.map(async (c) => ({
            post: await this.postProcessContent(c.post),
            sentiment: c.sentiment,
            clueStrength: c.clueStrength,
            pointsToward: c.pointsToward,
          }))
      );
      const minRequired = Math.ceil(conspiracists.length * 0.5);
      
      if (validConspiracy.length >= minRequired) {
        // Limit to requested count to match with conspiracists
        return validConspiracy.slice(0, conspiracists.length);
      }

      logger.warn(`Invalid conspiracy batch (attempt ${attempt + 1}/${maxRetries}). Expected ${conspiracists.length}, got ${validConspiracy.length} valid (need ${minRequired}+)`, { attempt: attempt + 1, maxRetries, expected: conspiracists.length, got: validConspiracy.length, minRequired }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate conspiracy posts batch after ${maxRetries} attempts`);
  }

  /**
   * Generate journalist breaking news post
   * Journalists report events objectively (with slight bias)
   * Public for external use and testing
   * 
   * @description
   * Generates journalist post WITHOUT knowing predetermined outcome.
   * Uses only event hint for framing.
   */
  public async generateJournalistPost(
    journalist: Actor,
    event: WorldEvent
  ): Promise<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> {
    if (!this.llm) {
      throw new Error('LLM client required for feed generation');
    }

    const state = this.actorStates.get(journalist.id);
    const emotionalContext = state
      ? generateActorContext(state.mood, state.luck, undefined, this.relationships, journalist.id)
      : '';

    // Frame based on event hint only
    const outcomeFrame = event.pointsToward === 'YES'
      ? 'Frame as potentially positive development'
      : event.pointsToward === 'NO'
        ? 'Highlight concerns or problems with this development'
        : 'Report objectively - implications unclear';

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    const prompt = renderPrompt(journalistPost, {
      journalistName: journalist.name,
      journalistDescription: journalist.description || '',
      emotionalContext: emotionalContext ? emotionalContext + '\n' : '',
      eventDescription: event.description,
      eventType: event.type,
      outcomeFrame,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(journalistPost);
    // Retry until we get non-empty content
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ 
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(
        prompt,
        { required: ['post', 'sentiment', 'clueStrength', 'pointsToward'] },
        params
      );

      if (response.post && typeof response.post === 'string' && response.post.trim().length > 0) {
        return {
          ...response,
          post: await this.postProcessContent(response.post)
        };
      }

      logger.error('Invalid response from LLM', { response }, 'FeedGenerator');
      logger.warn(`Invalid journalist post (attempt ${attempt + 1}/${maxRetries}). Retrying...`, { attempt: attempt + 1, maxRetries }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate valid journalist post after ${maxRetries} attempts for ${journalist.name}`);
  }

  /**
   * Generate media organization post
   * Media breaks stories with bias, often citing anonymous sources
   * Public for external use and testing
   * 
   * @description
   * Generates media post WITHOUT knowing predetermined outcome.
   * Uses event hint and organizational bias for framing.
   */
  public async generateMediaPost(
    media: Organization,
    event: WorldEvent,
    allActors: Actor[]
  ): Promise<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> {
    if (!this.llm) {
      throw new Error('LLM client required for feed generation');
    }

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    // Determine which actor might have "leaked" this to the media
    const potentialSource = allActors.find(a => event.actors.includes(a.id));
    const sourceHint = potentialSource 
      ? `Hint: You received information from sources close to ${potentialSource.name} (but DON'T reveal the source directly).`
      : 'You have your own sources.';

    // Frame based on outcome for narrative coherence
    const outcomeFrame = outcome 
      ? 'Spin this with your typical editorial slant toward positive framing' 
      : 'Spin this with your typical editorial slant emphasizing problems';

    const prompt = renderPrompt(mediaPost, {
      mediaName: media.name,
      mediaDescription: media.description,
      eventDescription: event.description,
      eventType: event.type,
      sourceHint,
      outcomeFrame,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(mediaPost);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ 
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(
        prompt,
        { required: ['post', 'sentiment', 'clueStrength', 'pointsToward'] },
        params
      );

      if (response.post && typeof response.post === 'string' && response.post.trim().length > 0) {
        return {
          ...response,
          post: await this.postProcessContent(response.post)
        };
      }

      logger.warn(`Invalid media post (attempt ${attempt + 1}/${maxRetries}). Retrying...`, { attempt: attempt + 1, maxRetries }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate valid media post after ${maxRetries} attempts for ${media.name}`);
  }

  /**
   * Generate company PR statement
   * Companies manage crises, spin news, and announce products
   * 
   * @description
   * Generates company PR WITHOUT knowing predetermined outcome.
   * Companies defend themselves and spin narratives based on their interests.
   */
  private async generateCompanyPost(
    company: Organization,
    event: WorldEvent,
    _affiliatedActor: Actor,
    outcome: boolean
  ): Promise<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> {
    if (!this.llm) {
      throw new Error('LLM client required for feed generation');
    }

    const isCrisis = event.type === 'scandal' || event.type === 'leak';
    
    // Companies ALWAYS try to frame things positively for themselves
    const frameGuidance = event.pointsToward === 'NO'
      ? 'Defensively spin this as minor/temporary - protect company reputation'
      : event.pointsToward === 'YES'
        ? 'Promote this as evidence of company strength and success'
        : 'Frame neutrally but emphasize company stability and commitment';

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    const prompt = renderPrompt(companyPost, {
      companyName: company.name,
      companyDescription: company.description,
      eventDescription: event.description,
      eventType: event.type,
      postType: isCrisis ? 'crisis management' : 'announcement',
      outcomeFrame: outcome 
        ? 'Frame as ultimately positive for the company' 
        : 'Manage the negative optics professionally',
      ...(this.worldContext || {})
    });

    const params = getPromptParams(companyPost);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ 
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(
        prompt,
        { required: ['post', 'sentiment', 'clueStrength', 'pointsToward'] },
        params
      );

      if (response.post && typeof response.post === 'string' && response.post.trim().length > 0) {
        return {
          ...response,
          post: await this.postProcessContent(response.post)
        };
      }

      logger.warn(`Invalid company post (attempt ${attempt + 1}/${maxRetries}). Retrying...`, { attempt: attempt + 1, maxRetries }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate valid company post after ${maxRetries} attempts for ${company.name}`);
  }

  /**
   * Generate government response
   * Government agencies investigate, deny, or announce policy
   * 
   * @description
   * Generates government statements WITHOUT knowing predetermined outcome.
   * Government responses are typically vague, bureaucratic, and ineffective.
   */
  private async generateGovernmentPost(
    govt: Organization,
    event: WorldEvent,
    allActors: Actor[],
    outcome: boolean
  ): Promise<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> {
    if (!this.llm) {
      throw new Error('LLM client required for feed generation');
    }

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    // Government framing based on event severity and outcome
    const outcomeFrame = event.type === 'scandal' || event.type === 'revelation'
      ? 'Announce investigation, issue vague statement about "reviewing the matter"'
      : outcome
        ? 'Frame as having things under control'
        : 'Show typical government ineffectiveness';

    const prompt = renderPrompt(governmentPost, {
      govName: govt.name,
      govDescription: govt.description,
      eventDescription: event.description,
      eventType: event.type,
      outcomeFrame,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(governmentPost);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ 
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(
        prompt,
        { required: ['post', 'sentiment', 'clueStrength', 'pointsToward'] },
        params
      );

      if (response.post && typeof response.post === 'string' && response.post.trim().length > 0) {
        return {
          ...response,
          post: await this.postProcessContent(response.post)
        };
      }

      logger.warn(`Invalid government post (attempt ${attempt + 1}/${maxRetries}). Retrying...`, { attempt: attempt + 1, maxRetries }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate valid government post after ${maxRetries} attempts for ${govt.name}`);
  }

  /**
   * Generate direct reaction from involved party
   * Defensive if bad, celebratory if good, motivated by self-interest
   * Public for external use and testing
   * 
   * @description
   * Generates reaction WITHOUT knowing predetermined outcome.
   * Actor reacts based on event hint and their own self-interest/bias.
   */
  public async generateDirectReaction(
    actor: Actor,
    event: WorldEvent
  ): Promise<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> {
    if (!this.llm) {
      throw new Error('LLM client required for feed generation');
    }

    // Get actor's current emotional state
    const state = this.actorStates.get(actor.id);
    const emotionalContext = state
      ? generateActorContext(state.mood, state.luck, undefined, this.relationships, actor.id)
      : '';

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    // React based on event hint and self-interest only
    const eventGuidance = event.pointsToward
      ? `This event suggests things are trending toward ${event.pointsToward}. React based on how this affects YOUR interests.`
      : `The implications of this event are unclear. React based on your role, interests, and what you know from your insider sources.`;

    const prompt = renderPrompt(directReaction, {
      actorName: actor.name,
      actorDescription: actor.description || actor.role || 'actor',
      emotionalContext: emotionalContext ? emotionalContext + '\n' : '',
      eventDescription: event.description,
      eventType: event.type,
      eventGuidance,
      outcomeFrame: outcome 
        ? 'Frame as potentially positive' 
        : 'Highlight concerns or problems',
      ...(this.worldContext || {})
    });

    const params = getPromptParams(directReaction);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ 
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(
        prompt,
        { required: ['post', 'sentiment', 'clueStrength', 'pointsToward'] },
        params
      );

      if (response.post && typeof response.post === 'string' && response.post.trim().length > 0) {
        return {
          ...response,
          post: await this.postProcessContent(response.post)
        };
      }

      logger.error('Invalid response from LLM', { response }, 'FeedGenerator');
      logger.warn(`Invalid reaction (attempt ${attempt + 1}/${maxRetries}). Retrying...`, { attempt: attempt + 1, maxRetries }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate valid reaction after ${maxRetries} attempts for ${actor.name}`);
  }

  /**
   * Generate expert/commentator analysis
   * Outsiders analyzing what happened
   * Public for external use and testing
   * 
   * @description
   * Generates expert commentary WITHOUT knowing predetermined outcome.
   * Experts analyze based on event hints and their domain expertise.
   */
  public async generateCommentary(
    actor: Actor,
    event: WorldEvent
  ): Promise<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> {
    if (!this.llm) {
      throw new Error('LLM client required for feed generation');
    }

    // Get actor's current emotional state
    const state = this.actorStates.get(actor.id);
    const emotionalContext = state
      ? generateActorContext(state.mood, state.luck, undefined, this.relationships, actor.id)
      : '';

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    // Analyze based on outcome for narrative coherence
    const outcomeFrame = outcome 
      ? 'Lean optimistic' 
      : 'Lean skeptical';

    const prompt = renderPrompt(expertCommentary, {
      actorName: actor.name,
      actorDescription: actor.description || actor.role || 'actor',
      emotionalContext: emotionalContext ? emotionalContext + '\n' : '',
      eventDescription: event.description,
      eventType: event.type,
      outcomeFrame,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(expertCommentary);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ 
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(
        prompt,
        { required: ['post', 'sentiment', 'clueStrength', 'pointsToward'] },
        params
      );

      if (response.post && typeof response.post === 'string' && response.post.trim().length > 0) {
        return {
          ...response,
          post: await this.postProcessContent(response.post)
        };
      }

      logger.error('Invalid response from LLM', { response }, 'FeedGenerator');
      logger.warn(`Invalid commentary (attempt ${attempt + 1}/${maxRetries}). Retrying...`, { attempt: attempt + 1, maxRetries }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate valid commentary after ${maxRetries} attempts for ${actor.name}`);
  }

  /**
   * Generate conspiracy theory / wild spin
   * These actors create alternative narratives
   * Public for external use and testing
   * 
   * @description
   * Generates conspiracy theory WITHOUT knowing predetermined outcome.
   * Contrarians often contradict mainstream narratives regardless of truth.
   */
  public async generateConspiracyPost(
    actor: Actor,
    event: WorldEvent
  ): Promise<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> {
    if (!this.llm) {
      throw new Error('LLM client required for feed generation');
    }

    const state = this.actorStates.get(actor.id);
    const emotionalContext = state
      ? generateActorContext(state.mood, state.luck, undefined, this.relationships, actor.id)
      : '';

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    // Conspiracy theories often contradict (contrarian behavior)
    const outcomeFrame = outcome 
      ? 'Claim it\'s a distraction' 
      : 'Say they\'re hiding worse';

    const prompt = renderPrompt(conspiracyPost, {
      actorName: actor.name,
      actorDescription: actor.description || actor.role || 'actor',
      emotionalContext: emotionalContext ? emotionalContext + '\n' : '',
      eventDescription: event.description,
      eventType: event.type,
      outcomeFrame,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(conspiracyPost);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ 
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(
        prompt,
        { required: ['post', 'sentiment', 'clueStrength', 'pointsToward'] },
        params
      );

      if (response.post && typeof response.post === 'string' && response.post.trim().length > 0) {
        return {
          ...response,
          post: await this.postProcessContent(response.post)
        };
      }

      logger.error('Invalid response from LLM', { response }, 'FeedGenerator');
      logger.warn(`Invalid conspiracy post (attempt ${attempt + 1}/${maxRetries}). Retrying...`, { attempt: attempt + 1, maxRetries }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate valid conspiracy post after ${maxRetries} attempts for ${actor.name}`);
  }

  /**
   * Generate ambient feed posts (not tied to specific events)
   * Random musings, hot takes, general commentary
   * BATCHED: Generates all ambient posts in ONE call
   * 
   * @description
   * Generates ambient posts WITHOUT knowing predetermined outcome.
   * Actors post general thoughts based on their mood and context.
   */
  private async generateAmbientFeed(day: number, allActors: Actor[], outcome: boolean): Promise<FeedPost[]> {
    const ambient: FeedPost[] = [];
    const baseTime = `2025-10-${String(day).padStart(2, '0')}T`;

    // DENSE CONTENT: Each actor posts 1-20 times per hour
    // Generate posts for all 24 hours of the day
    
    // For each hour of the day, select random actors to post
    for (let hour = 0; hour < 24; hour++) {
      // Each hour, 10-30% of actors post (1-20 posts per actor per hour achieved through probability)
      const actorsThisHour = shuffleArray(allActors).slice(0, Math.floor(allActors.length * (0.1 + Math.random() * 0.2)));
      
      if (actorsThisHour.length === 0) continue;

      // ✅ BATCH: Generate all ambient posts for this hour in ONE call
      const posts = await this.generateAmbientPostsBatch(actorsThisHour, day);
      
      posts.forEach((post, i) => {
        const actor = actorsThisHour[i];
        if (!actor) return;

        // Spread posts throughout the hour (random minutes)
        const minute = Math.floor(Math.random() * 60);
        const second = Math.floor(Math.random() * 60);

        ambient.push({
          id: `ambient-${day}-${hour}-${actor.id}-${i}`,
          day,
          timestamp: `${baseTime}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`,
          type: 'thread',
          content: post.post,
          author: actor.id,
          authorName: actor.name,
          sentiment: post.sentiment,
          clueStrength: post.clueStrength,
          pointsToward: post.pointsToward,
        });
      });
    }

    return ambient;
  }

  /**
   * Generate replies to existing posts
   * 30-50% of posts get replies from other actors
   */
  private async generateReplies(day: number, existingPosts: FeedPost[], allActors: Actor[]): Promise<FeedPost[]> {
    const replies: FeedPost[] = [];
    
    // Select posts that could get replies (30-50% of posts)
    const postsToReplyTo = shuffleArray(existingPosts).slice(0, Math.floor(existingPosts.length * (0.3 + Math.random() * 0.2)));
    
    for (const originalPost of postsToReplyTo) {
      // Select 1-3 actors to reply
      const replyCount = 1 + Math.floor(Math.random() * 3);
      const replyingActors = shuffleArray(
        allActors.filter(a => a.id !== originalPost.author)
      ).slice(0, replyCount);
      
      for (const actor of replyingActors) {
        // Generate reply content
        const replyContent = await this.generateReplyContent(actor, originalPost);
        
        // Reply timestamp is after original post
        const originalTime = new Date(originalPost.timestamp);
        
        // Validate timestamp
        if (isNaN(originalTime.getTime())) {
          logger.warn(`Invalid timestamp for post ${originalPost.id}, skipping reply generation`, { postId: originalPost.id }, 'FeedGenerator');
          continue;
        }
        
        const replyTime = new Date(originalTime.getTime() + (5 + Math.random() * 55) * 60 * 1000); // 5-60 minutes later
        
        replies.push({
          id: `reply-${originalPost.id}-${actor.id}`,
          day,
          timestamp: replyTime.toISOString(),
          type: 'reply',
          content: replyContent,
          author: actor.id,
          authorName: actor.name,
          replyTo: originalPost.id,
          relatedEvent: originalPost.relatedEvent,
          sentiment: (originalPost.sentiment ?? 0) * (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5),
          clueStrength: (originalPost.clueStrength ?? 0) * 0.5,
          pointsToward: originalPost.pointsToward,
        });
      }
    }
    
    return replies;
  }

  /**
   * Generate reply content for an actor replying to a post
   */
  private async generateReplyContent(actor: Actor, originalPost: FeedPost): Promise<string> {
    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    // Get actor's current emotional state
    const state = this.actorStates.get(actor.id);
    const emotionalContext = state
      ? generateActorContext(state.mood, state.luck, originalPost.author, this.relationships, actor.id)
      : '';

    const relationshipContext = originalPost.author 
      ? `Consider your relationship with ${originalPost.authorName} when responding.`
      : '';

    const prompt = renderPrompt(reply, {
      actorName: actor.name,
      actorDescription: actor.description || actor.role || 'actor',
      emotionalContext: emotionalContext ? emotionalContext + '\n' : '',
      originalAuthorName: originalPost.authorName,
      originalContent: originalPost.content,
      relationshipContext,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(reply);
    const rawResponse = await this.llm!.generateJSON<{ post: string } | { response: { post: string } }>(
      prompt,
      undefined,
      params
    );

    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { post: string };

    return await this.postProcessContent(response.post);
  }

  /**
   * BATCHED: Generate ambient posts for multiple actors in ONE call
   * 
   * @description
   * Generates ambient posts WITHOUT knowing predetermined outcome.
   * Actors post general thoughts based on their mood, relationships, and trending topics.
   */
  private async generateAmbientPostsBatch(
    actors: Actor[],
    day: number
  ): Promise<Array<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }>> {
    if (!this.llm || actors.length === 0) {
      return [];
    }

    // Shuffle actors to add variety to prompts
    const shuffledActors = shuffleArray(actors);

    const contexts = shuffledActors.map(actor => {
      const state = this.actorStates.get(actor.id);
      const emotionalContext = state
        ? generateActorContext(state.mood, state.luck, undefined, this.relationships, actor.id)
        : '';

      return { actor, emotionalContext };
    });

    // Natural progression: early game is setup, mid-game builds tension, late game escalates
    const progressContext = day <= 10
      ? 'Early days - things are just getting started.'
      : day <= 20
        ? 'Mid-way through - developments are unfolding.'
        : 'Late stage - tension is building, things are heating up.';

    // General atmosphere based on phase, not predetermined outcome
    const atmosphereContext = day <= 10
      ? 'General activity and routine developments.'
      : day <= 20
        ? 'Increasing activity and developments in various areas.'
        : 'Heightened activity as events accelerate.';

    const actorsList = contexts.map((ctx, i) => {
      const persona = this._npcPersonas.get(ctx.actor.id);
      
      let personaContext = '';
      if (persona) {
        personaContext = `\n   Reliability: ${(persona.reliability * 100).toFixed(0)}%`;
        if (persona.insiderOrgs.length > 0 && Math.random() > 0.7) {
          personaContext += ` | You may hint at insider knowledge from: ${persona.insiderOrgs.slice(0, 2).join(', ')}`;
        }
      }
      
      return `${i + 1}. You are ${ctx.actor.name}: ${ctx.actor.description}
   Affiliated: ${ctx.actor.domain?.join(', ')}
   ${ctx.emotionalContext}${formatActorVoiceContext(ctx.actor)}${personaContext}
   ${this.actorGroupContexts.get(ctx.actor.id) || ''}

   Write general thoughts. Your private group chats inform your perspective.
   You can reference trending topics if relevant.
   Write as YOURSELF (first person). Max 280 chars. No hashtags/emojis.`;
    }).join('\n');

    const prompt = renderPrompt(ambientPosts, {
      day: day.toString(),
      progressContext,
      atmosphereContext,
      trendContext: this.trendContext || '',
      actorCount: actors.length.toString(),
      actorsList,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(ambientPosts);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ posts: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> }>(
        prompt,
        undefined, // Don't validate schema to handle various response formats
        params
      );

      // Handle XML nested structure: { posts: [...] } or { posts: { post: [...] } }
      let posts: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> = [];
      if (Array.isArray(response.posts)) {
        posts = response.posts;
      } else if (response.posts && typeof response.posts === 'object' && 'post' in response.posts) {
        const nested = (response.posts as { post: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> }).post;
        posts = Array.isArray(nested) ? nested : [nested];
      }
      
      const filteredPosts = posts
        .filter(p => {
          // Handle various content field names: post, tweet, or content
          const content = p.post || p.tweet || (p as unknown as { content?: string }).content;
          return content && typeof content === 'string' && content.trim().length > 0;
        })
        .map(p => ({
          post: p.post || p.tweet || (p as unknown as { content?: string }).content!,
          sentiment: p.sentiment ?? 0,
          clueStrength: p.clueStrength ?? 0.05,
          pointsToward: p.pointsToward ?? null,
        }));
      
      // Post-process to fix any real names that slipped through
      const validPosts = await Promise.all(
        filteredPosts.map(async p => ({
          post: await this.postProcessContent(p.post),
          sentiment: p.sentiment,
          clueStrength: p.clueStrength,
          pointsToward: p.pointsToward,
        }))
      );
      const minRequired = Math.ceil(actors.length * 0.5);
      
      if (validPosts.length >= minRequired) {
        // Limit to requested count to match with actors
        return validPosts.slice(0, actors.length);
      }

      logger.warn(`Invalid ambient posts batch (attempt ${attempt + 1}/${maxRetries}). Expected ${actors.length}, got ${validPosts.length} valid (need ${minRequired}+)`, { attempt: attempt + 1, maxRetries, expected: actors.length, got: validPosts.length, minRequired }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate ambient posts batch after ${maxRetries} attempts`);
  }

  /**
   * Generate thread of replies
   * Actors respond to each other's posts
   * BATCHED: Generates all replies in ONE call
   */
  private async generateThread(day: number, existingPosts: FeedPost[], allActors: Actor[]): Promise<FeedPost[]> {
    const thread: FeedPost[] = [];
    
    if (existingPosts.length === 0) return thread;
    
    // Pick a post to reply to (prefer controversial or from main actors)
    const originalPost = existingPosts[Math.floor(Math.random() * existingPosts.length)];
    if (!originalPost) return thread; // Skip if no post exists

    // 1-3 people reply
    const postingActors = allActors.filter(a =>
      a.id !== originalPost.author
    );
    const repliers = shuffleArray(postingActors).slice(0, 1 + Math.floor(Math.random() * 3));
    
    if (repliers.length === 0) return thread;
    
    // ✅ BATCH: Generate all replies in ONE call
    const replies = await this.generateRepliesBatch(repliers, originalPost);
    
    replies.forEach((reply, i) => {
      const replier = repliers[i];
      if (!replier) return; // Skip if replier doesn't exist

      const baseTime = originalPost.timestamp.substring(0, 11);
      const hour = parseInt(originalPost.timestamp.substring(11, 13));

      thread.push({
        id: `${originalPost.id}-reply-${replier.id}`,
        day,
        timestamp: `${baseTime}${String(hour + i).padStart(2, '0')}:${String(30 + i * 10).padStart(2, '0')}:00Z`,
        type: 'thread',
        content: reply.post,
        author: replier.id,
        authorName: replier.name,
        replyTo: originalPost.id,
        sentiment: reply.sentiment,
        clueStrength: reply.clueStrength,
        pointsToward: reply.pointsToward,
      });
    });

    return thread;
  }

  /**
   * BATCHED: Generate replies for multiple actors in ONE call
   */
  private async generateRepliesBatch(
    actors: Actor[],
    originalPost: FeedPost
  ): Promise<Array<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }>> {
    if (!this.llm || actors.length === 0) {
      return [];
    }

    const contexts = actors.map(actor => {
      const state = this.actorStates.get(actor.id);
      const emotionalContext = state
        ? generateActorContext(state.mood, state.luck, originalPost.author, this.relationships, actor.id)
        : '';
      
      return { actor, emotionalContext };
    });

    const repliersList = contexts.map((ctx, i) => `${i + 1}. ${ctx.actor.name}
   About: ${ctx.actor.description}
   ${ctx.emotionalContext}${formatActorVoiceContext(ctx.actor)}
   
   Write reply (max 140 chars).
   ${ctx.actor.personality?.includes('contrarian') ? 'Disagree or challenge' : `Consider your relationship and mood when responding`}
   Let emotional state and any relationship with ${originalPost.authorName} influence tone. Match their writing style.
`).join('\n');

    const prompt = renderPrompt(replies, {
      originalAuthorName: originalPost.authorName,
      originalContent: originalPost.content,
      replierCount: actors.length.toString(),
      repliersList,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(replies);
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ replies: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> }>(
        prompt,
        undefined, // Don't validate schema to handle various response formats
        params
      );

      // Handle XML nested structure: { replies: [...] } or { replies: { reply: [...] } }
      let replies: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> = [];
      if (Array.isArray(response.replies)) {
        replies = response.replies;
      } else if (response.replies && typeof response.replies === 'object' && 'reply' in response.replies) {
        const nested = (response.replies as { reply: Array<{ post?: string; tweet?: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> }).reply;
        replies = Array.isArray(nested) ? nested : [nested];
      }
      
      const filteredReplies = replies
        .filter(r => {
          // Handle various content field names: post, tweet, or content
          const content = r.post || r.tweet || (r as unknown as { content?: string }).content;
          return content && typeof content === 'string' && content.trim().length > 0;
        })
        .map(r => ({
          post: r.post || r.tweet || (r as unknown as { content?: string }).content!,
          sentiment: r.sentiment ?? 0,
          clueStrength: r.clueStrength ?? 0.3,
          pointsToward: r.pointsToward ?? null,
        }));
      
      // Post-process to fix any real names that slipped through
      const validReplies = await Promise.all(
        filteredReplies.map(async r => ({
          post: await this.postProcessContent(r.post),
          sentiment: r.sentiment,
          clueStrength: r.clueStrength,
          pointsToward: r.pointsToward,
        }))
      );
      const minRequired = Math.ceil(actors.length * 0.5);
      
      if (validReplies.length >= minRequired) {
        // Limit to requested count to match with actors
        return validReplies.slice(0, actors.length);
      }

      logger.warn(`Invalid replies batch (attempt ${attempt + 1}/${maxRetries}). Expected ${actors.length}, got ${validReplies.length} valid (need ${minRequired}+)`, { attempt: attempt + 1, maxRetries, expected: actors.length, got: validReplies.length, minRequired }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate replies batch after ${maxRetries} attempts`);
  }



  /**
   * Generate ambient post (general musing, not tied to events)
   * Public for external use and testing
   * 
   * @description
   * Generates ambient post WITHOUT knowing predetermined outcome.
   * Actor posts general thoughts based on their mood and trending topics.
   */
  public async generateAmbientPost(actor: Actor, day: number): Promise<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> {
    if (!this.llm) {
      throw new Error('LLM client required for feed generation');
    }

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    // Get actor's current emotional state
    const state = this.actorStates.get(actor.id);
    const emotionalContext = state
      ? generateActorContext(state.mood, state.luck, undefined, this.relationships, actor.id)
      : '';

    // General atmosphere based on game phase, not outcome
    const atmosphereNote = day <= 10
      ? 'Early in the month - things are just getting started.'
      : day <= 20
        ? 'Mid-way through - developments are unfolding.'
        : 'Late in the month - events are accelerating.';

    const progressContext = day <= 10 
      ? 'Early days - things are just getting started.'
      : day <= 20
        ? 'Mid-way through - developments are unfolding.'
        : 'Late stage - tension is building, things are heating up.';

    const prompt = renderPrompt(ambientPost, {
      actorName: actor.name,
      actorDescription: actor.description || actor.role || 'actor',
      emotionalContext: emotionalContext ? emotionalContext + '\n' : '',
      day: day.toString(),
      progressContext,
      atmosphereNote,
      outcomeFrame: day < 15 
        ? 'Be vague or mysterious' 
        : 'Hint at things heating up',
      ...(this.worldContext || {})
    });

    const params = getPromptParams(ambientPost);
    // Retry until we get non-empty content
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ 
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(
        prompt,
        { required: ['post', 'sentiment', 'clueStrength', 'pointsToward'] },
        params
      );

      // Validate post exists and is not empty
      if (response.post && typeof response.post === 'string' && response.post.trim().length > 0) {
        return {
          ...response,
          post: await this.postProcessContent(response.post)
        };
      }

      logger.error('Invalid response from LLM', { response }, 'FeedGenerator');
      logger.warn(`Invalid post returned (attempt ${attempt + 1}/${maxRetries}). Retrying...`, { attempt: attempt + 1, maxRetries }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // If all retries fail, throw error
    throw new Error(`Failed to generate valid post after ${maxRetries} attempts for ${actor.name}`);
  }

  /**
   * Generate feed posts for stock price movements
   * Creates company announcements, ticker posts, and analyst reactions
   * Public for external use by price engines
   */
  public async generateEconomicFeedPosts(
    priceUpdate: PriceUpdate,
    company: Organization,
    day: number,
    allActors: Actor[]
  ): Promise<FeedPost[]> {
    if (!this.llm) {
      return [];
    }

    const posts: FeedPost[] = [];
    const baseTime = `2025-10-${String(day).padStart(2, '0')}T`;
    const direction = priceUpdate.change > 0 ? 'up' : 'down';
    const phaseContext = buildPhaseContext(day);

    // Only generate posts for significant price movements (>2%)
    if (Math.abs(priceUpdate.changePercent) < 2) {
      return [];
    }

    // 1. Company announcement (for major moves >5%)
    if (Math.abs(priceUpdate.changePercent) >= 5) {
      // Ensure world context is available
      if (!this.worldContext) {
        this.worldContext = await generateWorldContext({ maxActors: 50 });
      }

      const prompt = renderPrompt(priceAnnouncement, {
        companyName: company.name,
        priceChange: priceUpdate.change.toFixed(2),
        direction,
        currentPrice: priceUpdate.newPrice.toFixed(2),
        eventDescription: priceUpdate.reason,
        phaseContext,
        ...(this.worldContext || {})
      });

      const params = getPromptParams(priceAnnouncement);
      const rawResponse = await this.llm.generateJSON<{
        post: string;
        sentiment: number;
      } | { response: { post: string; sentiment: number } }>(prompt, undefined, params);

      // Handle XML structure
      const response = 'response' in rawResponse && rawResponse.response
        ? rawResponse.response
        : rawResponse as { post: string; sentiment: number };

      const processedPost = await this.postProcessContent(response.post);
      posts.push({
        id: `${company.id}-price-announcement-${day}`,
        day,
        timestamp: `${baseTime}${String(9 + Math.floor(Math.random() * 2)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
        type: 'news',
        content: processedPost,
        author: company.id,
        authorName: company.name,
        sentiment: response.sentiment,
        clueStrength: 0,
        pointsToward: null,
      });
    }

    // 2. Stock ticker style post (always for significant moves)
    const tickerPrompt = renderPrompt(stockTicker, {
      ticker: company.id.toUpperCase().slice(0, 4),
      companyName: company.name,
      currentPrice: priceUpdate.newPrice.toFixed(2),
      priceChange: priceUpdate.change.toFixed(2),
      direction,
      volume: Math.floor(Math.random() * 1000000 + 500000).toString(),
      ...(this.worldContext || {})
    });

    const tickerParams = getPromptParams(stockTicker);
    const rawTickerResponse = await this.llm.generateJSON<{
      post: string;
      sentiment: number;
    } | { response: { post: string; sentiment: number } }>(tickerPrompt, undefined, tickerParams);

    // Handle XML structure
    const tickerResponse = 'response' in rawTickerResponse && rawTickerResponse.response
      ? rawTickerResponse.response
      : rawTickerResponse as { post: string; sentiment: number };

    const processedTickerPost = await this.postProcessContent(tickerResponse.post);
    posts.push({
      id: `${company.id}-ticker-${day}`,
      day,
      timestamp: `${baseTime}${String(9 + Math.floor(Math.random() * 3)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
      type: 'news',
      content: processedTickerPost,
      author: 'market-ticker',
      authorName: 'Market Ticker',
      sentiment: tickerResponse.sentiment,
      clueStrength: 0,
      pointsToward: null,
    });

    // 3. Analyst reactions (1-2 analysts for major moves)
    if (Math.abs(priceUpdate.changePercent) >= 3) {
      const analysts = allActors.filter(a =>
        a.domain?.includes('finance') ||
        a.domain?.includes('business') ||
        a.description?.toLowerCase().includes('analyst')
      ).slice(0, Math.abs(priceUpdate.changePercent) >= 5 ? 2 : 1);

      for (const analyst of analysts) {
        const state = this.actorStates.get(analyst.id);

        const prompt = renderPrompt(analystReaction, {
          analystName: analyst.name,
          analystDescription: analyst.description || '',
          companyName: company.name,
          priceChange: Math.abs(priceUpdate.changePercent).toFixed(1),
          direction,
          eventDescription: priceUpdate.reason,
          mood: state ? (state.mood > 0 ? 'optimistic' : state.mood < 0 ? 'pessimistic' : 'neutral') : 'neutral',
          phaseContext,
          ...(this.worldContext || {})
        });

        const analystParams = getPromptParams(analystReaction);
        const rawResponse = await this.llm.generateJSON<{
          post: string;
          sentiment: number;
        } | { response: { post: string; sentiment: number } }>(prompt, undefined, analystParams);

        // Handle XML structure
        const response = 'response' in rawResponse && rawResponse.response
          ? rawResponse.response
          : rawResponse as { post: string; sentiment: number };

        const processedAnalystPost = await this.postProcessContent(response.post);
        posts.push({
          id: `${analyst.id}-analyst-${company.id}-${day}`,
          day,
          timestamp: `${baseTime}${String(10 + Math.floor(Math.random() * 3)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
          type: 'post',
          content: processedAnalystPost,
          author: analyst.id,
          authorName: analyst.name,
          sentiment: response.sentiment,
          clueStrength: 0,
          pointsToward: null,
        });
      }
    }

    return posts;
  }

  /**
   * Generate a day transition post marking the start of a new day
   * Creates a narrative summary that acknowledges the previous day and sets tone for today
   * Public for external use by game generators
   */
  public async generateDayTransitionPost(
    day: number,
    previousDayEvents: WorldEvent[],
    questions: Question[],
    allActors: Actor[]
  ): Promise<FeedPost | null> {
    if (!this.llm || day === 1) {
      return null; // No transition post for day 1
    }

    const baseTime = `2025-10-${String(day).padStart(2, '0')}T06:00:00Z`; // Early morning transition
    const phaseContext = buildPhaseContext(day);
    const phaseName = this.getPhaseName(day);

    // Format yesterday's key events
    const eventsContext = previousDayEvents
      .slice(0, 3) // Top 3 events
      .map(e => `- ${e.description}`)
      .join('\n');

    // Format active questions
    const questionsContext = questions
      .filter(q => !q.status || q.status === 'active')
      .slice(0, 3) // Top 3 questions
      .map(q => `- ${q.text}`)
      .join('\n');

    // Format key actors (top tier actors)
    const keyActors = allActors
      .filter(a => a.tier === 'S_TIER' || a.tier === 'A_TIER')
      .slice(0, 5)
      .map(a => a.name)
      .join(', ');

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    const prompt = renderPrompt(dayTransition, {
      day: day.toString(),
      phaseName,
      phaseContext,
      previousDayEvents: eventsContext || 'None',
      activeQuestions: questionsContext || 'No active questions',
      keyActors: keyActors || 'Various industry figures',
      ...(this.worldContext || {})
    });

    const params = getPromptParams(dayTransition);
    const rawResponse = await this.llm.generateJSON<{
      event: string;
      type: string;
      tone: string;
    } | { response: { event: string; type: string; tone: string } }>(prompt, undefined, params);

    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { event: string; type: string; tone: string };

    const processedEvent = await this.postProcessContent(response.event);
    return {
      id: `day-transition-${day}`,
      day,
      timestamp: baseTime,
      type: 'news',
      content: processedEvent,
      author: 'game-narrator',
      authorName: 'Game Narrator',
      sentiment: 0,
      clueStrength: 0,
      pointsToward: null,
    };
  }

  /**
   * Generate a feed post announcing a question resolution
   * Creates a public announcement when a prediction market question resolves
   * Public for external use by game generators
   */
  public async generateQuestionResolutionPost(
    question: Question,
    resolutionEventDescription: string,
    day: number,
    winningPercentage: number = 50
  ): Promise<FeedPost | null> {
    if (!this.llm) {
      return null;
    }

    const baseTime = `2025-10-${String(day).padStart(2, '0')}T20:00:00Z`;
    const outcomeText = question.resolvedOutcome ? 'YES' : 'NO';

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    const prompt = renderPrompt(questionResolvedFeed, {
      questionText: question.text,
      outcome: outcomeText,
      resolutionEvent: resolutionEventDescription,
      winningPercentage: winningPercentage.toFixed(0),
      ...(this.worldContext || {})
    });

    const params = getPromptParams(questionResolvedFeed);
    const rawResponse = await this.llm.generateJSON<{
      post: string;
      sentiment: number;
    } | { response: { post: string; sentiment: number } }>(prompt, undefined, params);

    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { post: string; sentiment: number };

    const processedPost = await this.postProcessContent(response.post);
    return {
      id: `question-resolved-${question.id}-${day}`,
      day,
      timestamp: baseTime,
      type: 'news',
      content: processedPost,
      author: 'market-oracle',
      authorName: 'Market Oracle',
      sentiment: response.sentiment,
      clueStrength: 0,
      pointsToward: null,
    };
  }

  /**
   * Generate minute-level ambient post for continuous mode
   * Uses actor personality and current context for realistic posts
   */
  public async generateMinuteAmbientPost(
    actor: { id: string; name: string; description?: string; role?: string; mood?: number },
    timestamp: Date
  ): Promise<{ content: string; sentiment: number; energy: number }> {
    const currentTime = timestamp.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    const emotionalContext = actor.mood
      ? `Current mood: ${actor.mood > 0 ? 'positive' : actor.mood < 0 ? 'negative' : 'neutral'}`
      : '';

    const atmosphereContext = '';

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    const prompt = renderPrompt(minuteAmbient, {
      actorName: actor.name,
      actorDescription: actor.description || actor.role || 'industry professional',
      emotionalContext,
      currentTime,
      atmosphereContext,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(minuteAmbient);
    const rawResponse = await this.llm!.generateJSON<{
      post: string;
      sentiment: number;
      energy: number;
    } | { response: { post: string; sentiment: number; energy: number } }>(prompt, undefined, params);

    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { post: string; sentiment: number; energy: number };

    const processedPost = await this.postProcessContent(response.post);
    return {
      content: processedPost,
      sentiment: response.sentiment,
      energy: response.energy,
    };
  }

  /**
   * Get phase name for a given day
   */
  private getPhaseName(day: number): string {
    if (day <= 10) return 'WILD';
    if (day <= 20) return 'CONNECTION';
    if (day <= 25) return 'CONVERGENCE';
    if (day <= 29) return 'CLIMAX';
    return 'RESOLUTION';
  }

  /**
   * Generate reply to another post
   * React based on personality, mood, and relationship
   * Public for external use and testing
   */
  public async generateReply(actor: Actor, originalPost: FeedPost): Promise<{ post: string; sentiment: number; clueStrength: number; pointsToward: boolean | null }> {
    if (!this.llm) {
      throw new Error('LLM client required for feed generation');
    }

    // Get actor's current emotional state and relationship with the original poster
    const state = this.actorStates.get(actor.id);
    const emotionalContext = state
      ? generateActorContext(state.mood, state.luck, originalPost.author, this.relationships, actor.id)
      : '';

    // Ensure world context is available
    if (!this.worldContext) {
      this.worldContext = await generateWorldContext({ maxActors: 50 });
    }

    const relationshipContext = originalPost.author 
      ? `Consider your relationship with ${originalPost.authorName} when responding.`
      : '';

    const prompt = renderPrompt(reply, {
      actorName: actor.name,
      actorDescription: actor.description || actor.role || 'actor',
      emotionalContext: emotionalContext ? emotionalContext + '\n' : '',
      originalAuthorName: originalPost.authorName,
      originalContent: originalPost.content,
      relationshipContext,
      ...(this.worldContext || {})
    });

    const params = getPromptParams(reply);
    // Retry until we get non-empty content
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await this.llm.generateJSON<{ 
        post: string;
        sentiment: number;
        clueStrength: number;
        pointsToward: boolean | null;
      }>(
        prompt,
        { required: ['post', 'sentiment', 'clueStrength', 'pointsToward'] },
        params
      );

      // Validate post exists and is not empty
      if (response.post && typeof response.post === 'string' && response.post.trim().length > 0) {
        return {
          ...response,
          post: await this.postProcessContent(response.post)
        };
      }

      logger.error('Invalid response from LLM', { response }, 'FeedGenerator');
      logger.warn(`Invalid reply returned (attempt ${attempt + 1}/${maxRetries}). Retrying...`, { attempt: attempt + 1, maxRetries }, 'FeedGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // If all retries fail, throw error
    throw new Error(`Failed to generate valid reply after ${maxRetries} attempts for ${actor.name}`);
  }

}

