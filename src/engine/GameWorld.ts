/**
 * Babylon Game World Generator
 * 
 * Generates complete game narratives with NPCs, events, and predetermined outcomes.
 * This is the WORLD that agents observe and bet on - it doesn't handle betting itself.
 * 
 * The game generates:
 * - Daily events and developments
 * - NPC conversations and actions
 * - Clues and information reveals
 * - News reports and rumors
 * - The final outcome
 * 
 * External agents observe this world and bet on prediction markets about the outcome.
 * 
 * @module engine/GameWorld
 */

import { daySummary, expertAnalysis, newsReport, npcConversation, renderPrompt, rumor } from '@/prompts';
import type { JsonValue } from '@/types/common';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';
import type { BabylonLLMClient } from '../generator/llm/openai-client';
import { FeedGenerator, type FeedEvent } from './FeedGenerator';

export interface WorldConfig {
  /** Predetermined outcome (true = success, false = failure) */
  outcome: boolean;
  /** Number of NPCs in the world */
  numNPCs?: number;
  /** Game duration in days */
  duration?: number;
  /** How much information to generate */
  verbosity?: 'minimal' | 'normal' | 'detailed';
}

/**
 * WorldEvent - represents actual story events that occur in the game world
 * This is the canonical definition used throughout the engine
 * These are the events that actors see and react to in the social feed
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
 * Creates autonomous game worlds with NPCs, events, and narratives.
 * External agents observe this world and make predictions.
 * 
 * @example
 * ```typescript
 * const world = new GameWorld({ outcome: true });
 * 
 * world.on('npc:conversation', (event) => {
 *   console.log(`${event.npc}: "${event.data.dialogue}"`);
 * });
 * 
 * const finalWorld = await world.generate();
 * // Complete 30-day narrative with all NPC actions
 * ```
 */
export class GameWorld extends EventEmitter {
  private config: Required<WorldConfig>;
  private events: WorldEvent[] = [];
  private currentDay = 0;
  private npcs: NPC[] = [];
  private feedGenerator: FeedGenerator;
  private llm?: BabylonLLMClient;

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
   * Generate complete game world from day 1 to 30
   * 
   * Returns full narrative with:
   * - Daily events and developments
   * - NPC conversations and actions
   * - Clues and information reveals
   * - News reports and rumors
   * - Final outcome
   * 
   * This is what agents observe - they don't participate in this world,
   * they BET on what will happen.
   */
  async generate(): Promise<WorldState> {
    const worldId = uuid();
    
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

    const response = await this.llm.generateJSON<{ headline: string; report: string }>(prompt);
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

    const response = await this.llm.generateJSON<{ rumor: string }>(prompt);
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

    const response = await this.llm.generateJSON<{ conversation: string }>(prompt);
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

    const response = await this.llm.generateJSON<{ analysis: string }>(prompt);
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

    const response = await this.llm.generateJSON<{ summary: string }>(prompt);
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

