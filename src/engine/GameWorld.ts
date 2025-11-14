/**
 * Babylon Game World Generator
 * 
 * @module engine/GameWorld
 * 
 * @description
 * Generates complete narrative worlds with NPCs, events, and predetermined outcomes
 * that agents observe and bet on. This is the "reality" of the game - agents don't
 * participate in or influence this world, they only observe and predict outcomes.
 * 
 * **What This Generates:**
 * - 30 days of narrative events and developments
 * - NPC conversations and private discussions
 * - Clues and information reveals (public and leaked)
 * - News reports, rumors, and expert analysis
 * - Social media feed posts and reactions
 * - Final outcome revelation
 * 
 * **World vs Betting:**
 * - GameWorld = what actually happens (predetermined narrative)
 * - Agents = observers who bet on outcomes (don't affect world)
 * - Feed = how agents learn about the world (filtered, biased)
 * - Markets = where agents bet on predictions
 * 
 * **Generation Phases:**
 * - **Early (Days 1-10)**: Rumors, leaks, initial reports
 * - **Mid (Days 11-20)**: Meetings, analysis, developments
 * - **Late (Days 21-30)**: Revelations, whistleblowers, final events
 * 
 * **LLM Integration:**
 * - Optional LLM for rich content generation
 * - Falls back to templates if LLM unavailable
 * - Uses prompts from @/prompts for consistency
 * 
 * **Event Types:**
 * - announcement, meeting, leak, development
 * - scandal, rumor, deal, conflict, revelation
 * 
 * @see {@link GameEngine} - Production system (not used in GameEngine)
 * @see {@link GameSimulator} - Uses similar patterns for autonomous simulation
 * @see {@link FeedGenerator} - Converts events to social media posts
 * 
 * @example
 * ```typescript
 * const world = new GameWorld({ outcome: true }, llmClient);
 * 
 * world.on('feed:post', (post) => {
 *   console.log(`${post.authorName}: ${post.content}`);
 * });
 * 
 * const finalWorld = await world.generate();
 * console.log(`Question: ${finalWorld.question}`);
 * console.log(`Outcome: ${finalWorld.outcome ? 'YES' : 'NO'}`);
 * console.log(`Events: ${finalWorld.events.length}`);
 * console.log(`Timeline: ${finalWorld.timeline.length} days`);
 * ```
 */

import { daySummary, expertAnalysis, newsReport, npcConversation, renderPrompt, rumor } from '@/prompts';
import type { JsonValue } from '@/types/common';
import { EventEmitter } from 'events';
import { generateSnowflakeId } from '@/lib/snowflake';
import type { BabylonLLMClient } from '../generator/llm/openai-client';
import { FeedGenerator, type FeedEvent } from './FeedGenerator';

/**
 * GameWorld Event Types
 */
export interface GameWorldEvents {
  'world:started': { data: { question: string; npcs: number } };
  'day:begins': { data: { day: number } };
  'npc:action': { npc: string; description: string };
  'npc:conversation': { description: string };
  'news:published': { npc: string; description: string };
  'rumor:spread': { description: string };
  'clue:revealed': { npc: string; description: string };
  'development:occurred': { description: string };
  'feed:post': FeedEvent;
  'outcome:revealed': { data: { outcome: boolean } };
  'event': { type: string; data: JsonValue };
}

/**
 * World generation configuration
 * 
 * @interface WorldConfig
 * 
 * @property outcome - Predetermined outcome (true = success/YES, false = failure/NO)
 * @property numNPCs - Number of NPCs in the world (default: 8)
 * @property duration - Game duration in days (default: 30)
 * @property verbosity - Content detail level (default: 'normal')
 */
export interface WorldConfig {
  outcome: boolean;
  numNPCs?: number;
  duration?: number;
  verbosity?: 'minimal' | 'normal' | 'detailed';
}

/**
 * World Event - Actual story events that occur in the game
 * 
 * @interface WorldEvent
 * 
 * @description
 * Canonical representation of events that happen in the game world. These are the
 * "actual events" that actors observe and react to via the social feed. Each event
 * can point toward a question outcome and has varying levels of visibility.
 * 
 * **This is THE WorldEvent:**
 * - Used throughout entire engine (GameWorld, FeedGenerator, GameEngine)
 * - Represents what "actually happened" (not just posts/reactions)
 * - Feed posts are reactions TO these events
 * 
 * @property id - Unique event identifier
 * @property day - Game day number (1-30) when event occurred
 * @property type - Event category (determines impact and reactions)
 * @property description - Event description (max 150 chars, dramatic and specific)
 * @property actors - Actor IDs involved in this event
 * @property visibility - Who can see this event
 * @property pointsToward - Optional hint toward question outcome
 * @property relatedQuestion - Optional prediction market question ID
 * 
 * **Event Types:**
 * - `announcement`: Official public statements
 * - `meeting`: Private meetings (may leak)
 * - `leak`: Information leaked to media
 * - `development`: Progress updates
 * - `scandal`: Negative revelations
 * - `rumor`: Unconfirmed reports
 * - `deal`: Business transactions
 * - `conflict`: Disputes or conflicts
 * - `revelation`: Major discoveries
 * - `development:occurred`: Internal development marker
 * - `news:published`: News article published marker
 * 
 * **Visibility Levels:**
 * - `public`: Everyone sees it
 * - `leaked`: Media has it, public soon
 * - `secret`: Only involved actors know
 * - `private`: Small group knows
 * - `group`: Group chat only
 */
export interface WorldEvent {
  id: string;
  day: number;
  type:
    | 'announcement'
    | 'meeting'
    | 'leak'
    | 'development'
    | 'scandal'
    | 'rumor'
    | 'deal'
    | 'conflict'
    | 'revelation'
    | 'development:occurred'
    | 'news:published';
  description: string;
  actors: string[];
  visibility: 'public' | 'leaked' | 'secret' | 'private' | 'group';
  pointsToward?: 'YES' | 'NO' | null;
  relatedQuestion?: number | null;
}

/**
 * EmitterEvent - Internal EventEmitter format for tracking world state changes
 * Used by GameWorld for event emission and logging
 */
interface EmitterEvent {
  type: EmitterEventType;
  day: number;
  timestamp: number;
  description: string;
  npc?: string;
  data: EmitterEventData;
}

type EmitterEventType =
  | 'world:started'
  | 'day:begins'
  | 'npc:action'
  | 'npc:conversation'
  | 'news:published'
  | 'rumor:spread'
  | 'clue:revealed'
  | 'development:occurred'
  | 'outcome:revealed'
  | 'world:ended';

interface EmitterEventData {
  question?: string | null;
  outcome?: boolean | null;
  npcs?: number | null;
  day?: number | null;
  totalEvents?: number | null;
  npcId?: string | null;
  description?: string | null;
  [key: string]: JsonValue | undefined;
}

export interface NPC {
  id: string;
  name: string;
  role: 'insider' | 'expert' | 'journalist' | 'whistleblower' | 'politician' | 'deceiver';
  knowsTruth: boolean; // Does this NPC know the real outcome?
  reliability: number; // 0-1, how often they tell truth
  personality: string;
}

export interface WorldState {
  id: string;
  question: string;
  outcome: boolean;
  currentDay: number;
  npcs: NPC[];
  events: WorldEvent[];
  timeline: DayEvent[];
  truthRevealed: boolean;
}

export interface GroupMessage {
  from: string;
  message: string;
  timestamp: string;
  clueStrength: number;
}

export interface DayEvent {
  day: number;
  summary: string;
  events: WorldEvent[];
  feedPosts?: FeedEvent[]; // Feed posts generated for this day
  groupChats?: Record<string, GroupMessage[]>; // Group chat messages for this day
  publicSentiment: number; // -1 to 1 (negative = NO, positive = YES)
}

/**
 * Game World Generator
 * 
 * @class GameWorld
 * @extends EventEmitter
 * 
 * @description
 * Creates autonomous game worlds with NPCs, events, and narratives that agents
 * observe and bet on. Generates complete 30-day story arcs with predetermined
 * outcomes that unfold naturally through events and social interactions.
 * 
 * **Architecture:**
 * - Extends EventEmitter for real-time event streaming
 * - Uses FeedGenerator for social media simulation
 * - Optional LLM for rich content (falls back to templates)
 * - Deterministic outcome with organic information reveals
 * 
 * **Events Emitted:**
 * - `world:started` - World generation begins
 * - `day:begins` - New day starts
 * - `npc:action` - NPC takes action
 * - `npc:conversation` - NPCs converse
 * - `news:published` - News article published
 * - `rumor:spread` - Rumor circulates
 * - `clue:revealed` - Information revealed
 * - `development:occurred` - Development happens
 * - `outcome:revealed` - Final outcome revealed
 * - `world:ended` - Generation complete
 * - `feed:post` - Social media post created
 * 
 * **NPC Roles:**
 * - insider: Knows truth, high reliability
 * - expert: Analytical, moderate reliability
 * - journalist: Reports news, moderate reliability
 * - whistleblower: Reveals secrets, high reliability
 * - politician: Public statements, low reliability
 * - deceiver: Spreads misinformation, very low reliability
 * 
 * @usage
 * Used for testing and simulation. GameEngine uses different architecture.
 * 
 * @example
 * ```typescript
 * const world = new GameWorld({ outcome: true, numNPCs: 10 }, llm);
 * 
 * world.on('feed:post', (post) => {
 *   console.log(`@${post.authorName}: ${post.content}`);
 * });
 * 
 * world.on('day:begins', (event) => {
 *   console.log(`--- Day ${event.data.day} ---`);
 * });
 * 
 * const result = await world.generate();
 * console.log(`Generated ${result.events.length} events over ${result.timeline.length} days`);
 * ```
 */

/**
 * Typed EventEmitter interface for GameWorld
 */
interface TypedGameWorldEmitter {
  on<K extends keyof GameWorldEvents>(event: K, listener: (data: GameWorldEvents[K]) => void): this;
  emit<K extends keyof GameWorldEvents>(event: K, data: GameWorldEvents[K]): boolean;
  off<K extends keyof GameWorldEvents>(event: K, listener: (data: GameWorldEvents[K]) => void): this;
}

export class GameWorld extends EventEmitter implements TypedGameWorldEmitter {
  private config: Required<WorldConfig>;
  private events: WorldEvent[] = [];
  private currentDay = 0;
  private npcs: NPC[] = [];
  private feedGenerator: FeedGenerator;
  private llm?: BabylonLLMClient;

  /**
   * Create a new GameWorld generator
   * 
   * @param config - World configuration options
   * @param llm - Optional LLM client for rich content generation
   * 
   * @description
   * Initializes world generator with configuration. If LLM is provided, generates
   * rich, contextual content. Otherwise falls back to template-based generation.
   * 
   * @example
   * ```typescript
   * // With LLM (rich content)
   * const world = new GameWorld({ outcome: true }, llmClient);
   * 
   * // Without LLM (template-based)
   * const world = new GameWorld({ outcome: false });
   * ```
   */
  constructor(config: WorldConfig, llm?: BabylonLLMClient) {
    super();

    this.config = {
      outcome: config.outcome,
      numNPCs: config.numNPCs || 8,
      duration: config.duration || 30,
      verbosity: config.verbosity || 'normal',
    };

    this.llm = llm;
    this.feedGenerator = new FeedGenerator(llm);
  }

  /**
   * Generate complete game world simulation
   * 
   * @returns Complete world state with 30-day timeline, events, and NPCs
   * @throws Never throws - handles errors internally and uses fallbacks
   * 
   * @description
   * Generates a complete 30-day narrative world from start to finish. This is the
   * "actual reality" that agents observe through the social feed and bet on.
   * 
   * **Generation Process:**
   * 1. **Setup**
   *    - Generate prediction question
   *    - Create NPCs with roles and reliability
   *    - Emit 'world:started' event
   * 
   * 2. **Daily Generation** (30 days)
   *    - Generate phase-appropriate events (early/mid/late)
   *    - Generate feed posts from events (via FeedGenerator)
   *    - Generate group chat messages
   *    - Generate day summary
   *    - Calculate public sentiment
   *    - Emit events for monitoring
   * 
   * 3. **Resolution**
   *    - Emit 'outcome:revealed' event
   *    - Finalize world state
   * 
   * **Event Generation:**
   * - Uses LLM for rich, contextual content
   * - Falls back to templates if LLM unavailable
   * - Events become more specific toward outcome as days progress
   * 
   * **Feed Generation:**
   * - NPCs react to events via FeedGenerator
   * - Posts include news, reactions, analysis, conspiracy theories
   * - Sentiment calculated from all posts
   * 
   * **What Agents See:**
   * - Feed posts (filtered view of events)
   * - Public events only (not secret meetings)
   * - NPC statements (may be misleading)
   * - News coverage (may be biased)
   * 
   * **What Agents DON'T See:**
   * - Predetermined outcome
   * - NPC reliability scores
   * - Truth values of statements
   * - Secret events
   * 
   * @usage
   * Used for testing, simulation, and offline world generation.
   * 
   * @example
   * ```typescript
   * const world = new GameWorld({ outcome: true, numNPCs: 10 }, llm);
   * 
   * const state = await world.generate();
   * 
   * console.log(`Question: ${state.question}`);
   * console.log(`Truth: ${state.outcome ? 'YES' : 'NO'}`);
   * console.log(`NPCs: ${state.npcs.length}`);
   * console.log(`Events: ${state.events.length}`);
   * console.log(`Days: ${state.timeline.length}`);
   * 
   * // Analyze sentiment progression
   * state.timeline.forEach(day => {
   *   console.log(`Day ${day.day}: ${day.summary}`);
   *   console.log(`  Sentiment: ${day.publicSentiment.toFixed(2)}`);
   *   console.log(`  Events: ${day.events.length}`);
   *   console.log(`  Posts: ${day.feedPosts?.length || 0}`);
   * });
   * ```
   */
  async generate(): Promise<WorldState> {
    const worldId = await generateSnowflakeId();
    
    // 1. Create the scenario
    const question = this.generateQuestion();
    this.npcs = this.createNPCs();
    
    this.emitEvent('world:started', {
      question,
      outcome: this.config.outcome,
      npcs: this.npcs.length,
    });

    const timeline: DayEvent[] = [];

    // 2. Generate all 30 days of events
    for (let day = 1; day <= this.config.duration; day++) {
      this.currentDay = day;
      
      this.emitEvent('day:begins', { day }, `Day ${day} begins`);

      // Generate real-world events (now async with LLM)
      const worldEvents: WorldEvent[] = [];

      if (day <= 10) {
        worldEvents.push(...await this.generateEarlyWorldEvents(day));
      } else if (day <= 20) {
        worldEvents.push(...await this.generateMidWorldEvents(day));
      } else {
        worldEvents.push(...await this.generateLateWorldEvents(day));
      }

      // Generate feed posts from world events (news, reactions, threads)
      const feedPosts = await this.feedGenerator.generateDayFeed(
        day,
        worldEvents,
        this.npcs,
        this.config.outcome
      );

      // Emit each feed post as it would appear
      feedPosts.forEach(post => {
        this.emit('feed:post', post);
      });

      // Generate group chat messages
      const groupChatMessages = this.generateGroupMessages(day, worldEvents);

      // Generate day summary (uses LLM if available, falls back to template)
      const daySummary = await this.generateDaySummary(day, worldEvents);

      timeline.push({
        day,
        summary: daySummary,
        events: worldEvents,
        feedPosts,
        groupChats: groupChatMessages,
        publicSentiment: this.calculateFeedSentiment(feedPosts),
      });
    }

    // 3. Reveal outcome
    this.emitEvent('outcome:revealed', { outcome: this.config.outcome }, 
      `The truth is revealed: The outcome is ${this.config.outcome ? 'SUCCESS' : 'FAILURE'}`);

    this.emitEvent('world:ended', { 
      outcome: this.config.outcome,
      totalEvents: this.events.length,
    });

    return {
      id: worldId,
      question,
      outcome: this.config.outcome,
      currentDay: this.config.duration,
      npcs: this.npcs,
      events: this.events,
      timeline,
      truthRevealed: true,
    };
  }

  /**
   * Generate early world events (Days 1-10)
   * Real things happening that people will react to
   * Uses LLM to generate rich, contextual event descriptions
   */
  private async generateEarlyWorldEvents(day: number): Promise<WorldEvent[]> {
    const events: WorldEvent[] = [];
    const allWorldEvents = this.events.filter(e => e.day < day); // Get previous events for context

    // Create actual world events that will trigger feed reactions
    if (day % 3 === 0) {
      // Generate rumor using LLM for richer content
      const rumorText = await this.generateRumor(day, allWorldEvents);

      const event = this.createEvent(
        `world-${day}-1`,
        day,
        'announcement',
        rumorText,
        this.npcs.filter(n => n.role === 'insider').map(n => n.id).slice(0, 1),
        'leaked'
      );
      this.emitWorldEvent(event);
      events.push(event);
    }

    if (day === 5) {
      const insider = this.npcs.find(n => n.role === 'insider');
      const journalist = this.npcs.find(n => n.role === 'journalist');

      // Generate news report using LLM
      const newsReport = journalist
        ? await this.generateNewsReport(day, journalist, allWorldEvents)
        : (this.config.outcome
            ? 'Internal memo shows project ahead of schedule'
            : 'Leaked documents reveal budget overruns');

      const event = this.createEvent(
        `world-${day}-2`,
        day,
        'leak',
        newsReport,
        insider ? [insider.id] : [],
        'leaked'
      );
      this.emitWorldEvent(event);
      events.push(event);
    }

    return events;
  }

  /**
   * Generate mid-game world events (Days 11-20)
   * Uses LLM for expert analysis and NPC conversations
   */
  private async generateMidWorldEvents(day: number): Promise<WorldEvent[]> {
    const events: WorldEvent[] = [];
    const allWorldEvents = this.events.filter(e => e.day < day);

    if (day === 15) {
      const expert = this.npcs.find(n => n.role === 'expert');

      // Generate expert analysis using LLM
      const expertAnalysisText = expert
        ? await this.generateExpertAnalysis(expert, allWorldEvents)
        : (this.config.outcome
            ? 'Major breakthrough achieved in critical testing phase'
            : 'Critical system failure discovered during final tests');

      const event = this.createEvent(
        `world-${day}-1`,
        day,
        'development',
        expertAnalysisText,
        this.npcs.filter(n => n.role === 'expert' || n.role === 'insider').map(n => n.id).slice(0, 2),
        'public',
        this.config.outcome ? 'YES' : 'NO'
      );
      this.emitWorldEvent(event);
      events.push(event);
    }

    if (day % 4 === 0) {
      // Generate NPC conversation using LLM
      const conversationText = await this.generateNPCConversation(day, this.npcs.slice(0, 3), allWorldEvents);

      const event = this.createEvent(
        `world-${day}-2`,
        day,
        'meeting',
        conversationText,
        this.npcs.slice(0, 3).map(n => n.id),
        'leaked'
      );
      this.emitWorldEvent(event);
      events.push(event);
    }

    return events;
  }

  /**
   * Generate late game world events (Days 21-30)
   * Uses LLM for dramatic reveals and final analysis
   */
  private async generateLateWorldEvents(day: number): Promise<WorldEvent[]> {
    const events: WorldEvent[] = [];
    const allWorldEvents = this.events.filter(e => e.day < day);

    if (day === 25) {
      const whistleblower = this.npcs.find(n => n.role === 'whistleblower');
      const journalist = this.npcs.find(n => n.role === 'journalist');

      // Generate whistleblower news report using LLM
      const whistleblowerReport = journalist
        ? await this.generateNewsReport(day, journalist, allWorldEvents)
        : (this.config.outcome
            ? 'Whistleblower leaks documents confirming project success'
            : 'Whistleblower reveals documents showing project failure');

      const event = this.createEvent(
        `world-${day}-1`,
        day,
        'scandal',
        whistleblowerReport,
        whistleblower ? [whistleblower.id] : [],
        'public',
        this.config.outcome ? 'YES' : 'NO'
      );
      this.emitWorldEvent(event);
      events.push(event);
    }

    if (day === 29) {
      const expert = this.npcs.find(n => n.role === 'expert');

      // Generate final expert analysis using LLM
      const finalAnalysis = expert
        ? await this.generateExpertAnalysis(expert, allWorldEvents)
        : (this.config.outcome
            ? 'Final test successful - all systems operational'
            : 'Final test failed - project officially cancelled');

      const event = this.createEvent(
        `world-${day}-1`,
        day,
        'development',
        finalAnalysis,
        this.npcs.filter(n => n.role === 'insider' || n.role === 'expert').map(n => n.id).slice(0, 2),
        'public',
        this.config.outcome ? 'YES' : 'NO'
      );
      this.emitWorldEvent(event);
      events.push(event);
    }

    return events;
  }

  /**
   * Create NPCs for the world
   */
  private createNPCs(): NPC[] {
    const npcTemplates = [
      { role: 'insider' as const, name: 'Insider Ian', knowsTruth: true, reliability: 0.9 },
      { role: 'expert' as const, name: 'Expert Emma', knowsTruth: false, reliability: 0.7 },
      { role: 'journalist' as const, name: 'Channel 7 News', knowsTruth: false, reliability: 0.6 },
      { role: 'whistleblower' as const, name: 'Whistleblower Wendy', knowsTruth: true, reliability: 0.95 },
      { role: 'politician' as const, name: 'Senator Smith', knowsTruth: false, reliability: 0.3 },
      { role: 'deceiver' as const, name: 'Conspiracy Carl', knowsTruth: false, reliability: 0.1 },
      { role: 'journalist' as const, name: 'TechJournal', knowsTruth: false, reliability: 0.6 },
      { role: 'insider' as const, name: 'Engineer Eve', knowsTruth: true, reliability: 0.85 },
    ];

    return npcTemplates.slice(0, this.config.numNPCs).map((template, i) => ({
      id: `npc-${i}`,
      name: template.name,
      role: template.role,
      knowsTruth: template.knowsTruth,
      reliability: template.reliability,
      personality: this.generatePersonality(),
    }));
  }

  private generateQuestion(): string {
    const questions = [
      "Will Project Omega's satellite launch succeed?",
      "Will the scandal force President Stump to resign?",
      "Will TechCorp announce the AI breakthrough?",
      "Will the climate summit reach an agreement?",
      "Will the merger between MegaCorp and TechGiant close?",
    ];
    const index = Math.floor(Math.random() * questions.length);
    return questions[index] ?? questions[0]!;
  }

  private generatePersonality(): string {
    const personalities = ['cautious', 'bold', 'analytical', 'emotional', 'contrarian'];
    const index = Math.floor(Math.random() * personalities.length);
    return personalities[index] ?? personalities[0]!;
  }

  private async generateNewsReport(day: number, journalist: NPC, events: WorldEvent[]): Promise<string> {
    if (!this.llm) {
      // Fallback to template-based generation
      return this.config.outcome
        ? `Day ${day} analysis: Sources suggest positive developments`
        : `Day ${day} investigation: Multiple concerns raised by experts`;
    }

    const reputationContext = journalist.reliability > 0.7 ? 'reliable' : 'questionable';
    const truthContext = journalist.knowsTruth ? 'hints at' : 'speculates about';

    const prompt = renderPrompt(newsReport, {
      day: day.toString(),
      question: this.generateQuestion(),
      outcome: this.config.outcome ? 'YES' : 'NO',
      journalistName: journalist.name,
      journalistRole: journalist.role,
      journalistReliability: journalist.reliability.toString(),
      recentEvents: events.map(e => e.description).join('; '),
      reputationContext,
      truthContext
    });

    const rawResponse = await this.llm.generateJSON<{ headline: string; report: string } | { response: { headline: string; report: string } }>(prompt);
    
    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { headline: string; report: string };
    
    return `${response.headline}\n\n${response.report}`;
  }

  private async generateRumor(day: number, events: WorldEvent[]): Promise<string> {
    if (!this.llm) {
      // Fallback to template-based generation
      const rumors = this.config.outcome
        ? ["Unconfirmed: Test results exceeding expectations", "Rumor: Key milestone reached ahead of schedule"]
        : ["Unconfirmed: Internal memos show concerns", "Rumor: Key stakeholders expressing doubts"];
      const index = Math.floor(Math.random() * rumors.length);
      return rumors[index] ?? rumors[0]!;
    }

    const outcomeHint = this.config.outcome ? 'Leans positive' : 'Raises concerns';

    const prompt = renderPrompt(rumor, {
      day: day.toString(),
      question: this.generateQuestion(),
      outcome: this.config.outcome ? 'YES' : 'NO',
      recentEvents: events.slice(-3).map(e => e.description).join('; '),
      outcomeHint
    });

    const rawResponse = await this.llm.generateJSON<{ rumor: string } | { response: { rumor: string } }>(prompt);
    
    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { rumor: string };
    
    return response.rumor;
  }

  private async generateNPCConversation(day: number, npcs: NPC[], events: WorldEvent[]): Promise<string> {
    if (!this.llm) {
      return `NPCs debate the situation on Day ${day}. Mixed opinions emerge.`;
    }

    const participants = npcs.slice(0, 3);
    const participantsStr = participants.map(n => `${n.name} (${n.role}, knows truth: ${n.knowsTruth})`).join(', ');

    const prompt = renderPrompt(npcConversation, {
      day: day.toString(),
      question: this.generateQuestion(),
      outcome: this.config.outcome ? 'YES' : 'NO',
      participants: participantsStr,
      recentEvents: events.slice(-2).map(e => e.description).join('; ')
    });

    const rawResponse = await this.llm.generateJSON<{ conversation: string } | { response: { conversation: string } }>(prompt);
    
    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { conversation: string };
    
    return response.conversation;
  }

  private async generateExpertAnalysis(expert: NPC, events: WorldEvent[]): Promise<string> {
    if (!this.llm) {
      return `${expert.name} publishes analysis: ${this.config.outcome ? 'Indicators positive' : 'Warning signs evident'}`;
    }

    const confidenceContext = expert.knowsTruth ? 'Confidently points toward truth' : 'Makes educated guesses';
    const reliabilityContext = expert.reliability > 0.7 ? 'accurate' : 'sometimes wrong';

    const prompt = renderPrompt(expertAnalysis, {
      expertName: expert.name,
      question: this.generateQuestion(),
      outcome: this.config.outcome ? 'YES' : 'NO',
      expertRole: expert.role,
      knowsTruth: expert.knowsTruth.toString(),
      reliability: expert.reliability.toString(),
      recentEvents: events.slice(-5).map(e => e.description).join('; '),
      confidenceContext,
      reliabilityContext
    });

    const rawResponse = await this.llm.generateJSON<{ analysis: string } | { response: { analysis: string } }>(prompt);
    
    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { analysis: string };
    
    return `${expert.name}: ${response.analysis}`;
  }

  private async generateDaySummary(day: number, events: WorldEvent[]): Promise<string> {
    if (!this.llm || events.length === 0) {
      if (events.length === 0) return `Day ${day}: Quiet day, no major developments`;
      const types = events.map(e => e.type);
      if (types.includes('development:occurred')) return `Day ${day}: MAJOR DEVELOPMENT`;
      if (types.includes('news:published')) return `Day ${day}: News coverage`;
      return `Day ${day}: ${events.length} events`;
    }

    const prompt = renderPrompt(daySummary, {
      day: day.toString(),
      question: this.generateQuestion(),
      eventsToday: events.map(e => `${e.type}: ${e.description}`).join('; '),
      outcome: this.config.outcome ? 'YES' : 'NO'
    });

    const rawResponse = await this.llm.generateJSON<{ summary: string } | { response: { summary: string } }>(prompt);
    
    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { summary: string };
    
    return response.summary;
  }

  private calculateFeedSentiment(feedPosts: FeedEvent[]): number {
    if (feedPosts.length === 0) return 0;
    
    const totalSentiment = feedPosts.reduce((sum, post) => sum + (post.sentiment ?? 0), 0);
    return totalSentiment / feedPosts.length;
  }

  /**
   * Generate group chat messages for the day
   */
  private generateGroupMessages(day: number, worldEvents: WorldEvent[]): Record<string, GroupMessage[]> {
    const messages: Record<string, GroupMessage[]> = {};

    // Simple group messages (fallback for non-LLM mode)
    // NOTE: GameGenerator provides LLM-powered group messages for full game generation
    if (worldEvents.length > 0 && day % 3 === 0) {
      const firstEvent = worldEvents[0];
      if (firstEvent) {
        messages['group-0'] = [
          {
            from: this.npcs[0]?.name || 'Insider',
            message: `Heard something about ${firstEvent.description}...`,
            timestamp: `2025-10-${String(day).padStart(2, '0')}T12:00:00Z`,
            clueStrength: 0.5,
          },
        ];
      }
    }

    return messages;
  }

  /**
   * Create a properly structured WorldEvent
   * Used by event generation methods to create game story events
   */
  private createEvent(
    id: string,
    day: number,
    type: WorldEvent['type'],
    description: string,
    actors: string[],
    visibility: WorldEvent['visibility'],
    pointsToward?: WorldEvent['pointsToward']
  ): WorldEvent {
    return {
      id,
      day,
      type,
      description,
      actors,
      visibility,
      pointsToward,
    };
  }

  /**
   * Emit an internal system event (not a story event)
   * Used for EventEmitter tracking of world state changes
   */
  private emitEvent(type: EmitterEventType, data: EmitterEventData, description?: string) {
    const event: EmitterEvent = {
      type,
      day: this.currentDay,
      timestamp: Date.now(),
      description: description || type,
      data,
    };

    this.emit(type, event);
    this.emit('event', event);
  }

  /**
   * Add a WorldEvent to the events log and emit it
   * Used by event generation methods to track and broadcast story events
   */
  private emitWorldEvent(event: WorldEvent) {
    this.events.push(event);
    this.emit(event.type, event);
    this.emit('event', event);
  }
}

