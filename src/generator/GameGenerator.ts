/**
 * Babylon Game Generator - Main Orchestrator
 * 
 * Coordinates LLM-driven generation of complete 30-day games
 * with actors, scenarios, questions, events, and outcomes.
 * 
 * Generates:
 * - 3 main actors, 15 supporting, 50 extras
 * - 3 scenarios with yes/no questions
 * - 30-day timeline with events
 * - 300-500 feed posts
 * - 100-200 group messages
 * - Predetermined outcomes
 * 
 * ✅ OPTIMIZED: Batched LLM calls (90% reduction)
 * - Before: ~300 event calls + ~150 group message calls = 450 calls
 * - After: ~30 event calls + ~30 group message calls = 60 calls
 * - Combined with FeedGenerator batching: 2,000+ calls → ~200 calls total
 * 
 * Batching strategy:
 * - Event descriptions: All events per day in 1 call (3-15 → 1)
 * - Group messages: All groups per day in 1 call (~5 → 1)
 * 
 * Per-actor context preserved (personality, mood, luck)
 */

// readFileSync, join - not used
import { FeedGenerator } from '../engine/FeedGenerator';
import { BabylonLLMClient } from './llm/openai-client';
import { logger } from '@/lib/logger';
import { generateActorContext } from '../engine/EmotionSystem';
import { shuffleArray, toQuestionIdNumberOrNull } from '@/shared/utils';
import { NPCPersonaGenerator } from '@/lib/services/npc-persona-generator';
import { QuestionArcPlanner } from '@/lib/services/question-arc-planner';
import { 
  renderPrompt,
  scenarios as scenariosPrompt,
  questions as questionsPrompt,
  baselineEvent,
  questionRankings,
  groupChatName,
  dayEvents,
  resolutionEvent,
  groupMessages,
  groupMessage
} from '@/prompts';
import type {
  Actor,
  ActorTier,
  SelectedActor,
  ActorConnection,
  Organization,
  WorldEvent,
  Scenario,
  Question,
  GroupChat,
  ChatMessage,
  DayTimeline,
  LuckChange,
  MoodChange,
  GameResolution,
  QuestionOutcome,
  GameSetup,
  GeneratedGame,
  ActorsDatabase,
  GameHistory,
  GenesisGame,
  FeedPost,
} from '@/shared/types';

/**
 * Structure for actors selected for a game
 */
interface SelectedActorsByTier {
  mains: SelectedActor[];
  supporting: SelectedActor[];
  extras: SelectedActor[];
}

/**
 * Generate context from previous month's game
 */
function generatePreviousMonthContext(previousHistory: GameHistory[]): string {
  if (previousHistory.length === 0) {
    return ''; // No previous history available
  }
  
  const lastGame = previousHistory[previousHistory.length - 1]!;
  
  return `
━━━ PREVIOUS MONTH CONTEXT ━━━
${lastGame.summary}

Prediction outcomes from last month:
${lastGame.keyOutcomes.map(o => `- ${o.questionText} → ${o.outcome ? 'YES' : 'NO'}`).join('\n')}

Key moments: ${lastGame.highlights.slice(0, 3).join('; ')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

/**
 * Generate current month setup context
 */
function generateCurrentMonthContext(
  mainActors: SelectedActor[],
  scenarios: Scenario[],
  questions: Question[],
  day: number
): string {
  return `
━━━ CURRENT MONTH - DAY ${day}/30 ━━━

MAIN ACTORS (focus on these):
${mainActors.map(a => `- ${a.name}: ${a.description} [${a.affiliations?.join(', ') || 'independent'}]`).join('\n')}

ACTIVE SCENARIOS:
${scenarios.map(s => `- ${s.title}: ${s.description}`).join('\n')}

PREDICTION MARKETS:
${questions.map(q => `- ${q.text}`).join('\n')}

ORGANIZATIONS: ${scenarios.flatMap(s => s.involvedOrganizations).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

/**
 * Generate day-by-day summaries for this month
 */
function generateDaySummariesContext(previousDays: DayTimeline[]): string {
  return `
━━━ THIS MONTH SO FAR ━━━
${previousDays.map(d => `Day ${d.day}: ${d.summary}
Events: ${d.events.map(e => e.description).join('; ')}`).join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

/**
 * Get actor's group context - all groups they're in + recent messages
 */
function getActorGroupContext(
  actorId: string,
  allGroups: GroupChat[],
  previousDays: DayTimeline[],
  allActors: SelectedActor[]
): string {
  const memberOf = allGroups.filter(g => g.members.includes(actorId));
  
  const groupContexts = memberOf.map(group => {
    const recentMessages: string[] = [];
    
    for (let i = previousDays.length - 1; i >= Math.max(0, previousDays.length - 3); i--) {
      const dayData = previousDays[i];
      if (!dayData) continue;
      
      const msgs = dayData.groupChats?.[group.id] || [];
      
      msgs.slice(-3).forEach((msg: ChatMessage) => {
        const actor = allActors.find(a => a.id === msg.from);
        recentMessages.push(`${actor?.name || msg.from}: "${msg.message}"`);
      });
    }
    
    const memberNames = group.members
      .map(id => allActors.find(a => a.id === id)?.name || id)
      .filter(name => name !== allActors.find(a => a.id === actorId)?.name);
    
    return `- "${group.name}": ${memberNames.join(', ')}
  ${recentMessages.length > 0 ? `Recent: ${recentMessages.slice(-3).join('; ')}` : 'No recent messages'}`;
  }).join('\n');
  
  return memberOf.length > 0 ? `
━━━ YOUR PRIVATE GROUP CHATS ━━━
${groupContexts}

You're aware of these conversations. They inform your knowledge and perspective.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : '';
}

export function createScenarioPrompt(mainActors: Actor[], organizations?: Organization[]) {
  const organizationContext = organizations && organizations.length > 0 ? `

AFFILIATED ORGANIZATIONS:
Organizations can participate in scenarios through their behavioral patterns:

MEDIA ORGANIZATIONS (Break Stories):
${organizations.filter(o => o.type === 'media').map(o =>
  `- ${o.name}: ${o.description}`
).join('\n') || '(none)'}

COMPANIES (Announce Products, Manage Crises):
${organizations.filter(o => o.type === 'company').map(o =>
  `- ${o.name}: ${o.description}`
).join('\n') || '(none)'}

GOVERNMENT AGENCIES (Investigate, Contain):
${organizations.filter(o => o.type === 'government').map(o =>
  `- ${o.name}: ${o.description}`
).join('\n') || '(none)'}

Organizations should:
- React to actor behavior (e.g., Xitter announces policy change after Elon's 3am rant)
- Drive scenarios (e.g., MSDNC breaks exclusive story with leaked documents)
- Create conflicts (e.g., The Fud investigates, company issues denial)
` : '';

  const mainActorsList = mainActors.map(a =>
    `- ${a.name}: ${a.description} (Domain: ${a.domain})${a.affiliations?.length ? ` [Affiliated: ${a.affiliations.join(', ')}]` : ''}`
  ).join('\n');

  return renderPrompt(scenariosPrompt, {
    mainActorsList,
    organizationContext
  });
}

export function createQuestionPrompt(scenarios: Scenario[], organizations?: Organization[]) {
  const organizationContext = organizations && organizations.length > 0 ? `

ORGANIZATIONS IN PLAY:
You can create questions about organizational responses, not just actors:
- "Will [MEDIA] break story about [EVENT]?"
- "Will [COMPANY] announce [PRODUCT/DENIAL]?"
- "Will [GOVERNMENT] launch investigation into [ACTOR]?"

Available organizations: ${organizations.map(o => `${o.name} (${o.type})`).join(', ')}
` : '';

  const scenariosList = scenarios.map(s => `
Scenario ${s.id}: ${s.title}
${s.description}
Actors: ${s.mainActors.join(', ')}
${s.involvedOrganizations?.length ? `Organizations: ${s.involvedOrganizations.join(', ')}` : ''}
`).join('\n');

  return renderPrompt(questionsPrompt, {
    scenariosList,
    organizationContext
  });
}

// Organization types
export type OrganizationType = 'company' | 'media' | 'government';

// Organization behavioral patterns
export enum OrganizationBehavior {
  // Media organizations break stories
  MEDIA_BREAKS_STORY = 'media_breaks_story',
  MEDIA_INVESTIGATES = 'media_investigates',
  MEDIA_COVERS_UP = 'media_covers_up',
  
  // Companies manage PR and announce products
  COMPANY_ANNOUNCES = 'company_announces',
  COMPANY_CRISIS_MANAGEMENT = 'company_crisis_management',
  COMPANY_DENIES = 'company_denies',
  
  // Government contains and responds
  GOVT_INVESTIGATES = 'govt_investigates',
  GOVT_DENIES = 'govt_denies',
  GOVT_ANNOUNCES_POLICY = 'govt_announces_policy',
}

// Re-export types for backwards compatibility with external consumers
export type {
  GeneratedGame,
  GameSetup,
  SelectedActor,
  Scenario,
  Question,
  GroupChat,
  ActorConnection,
  DayTimeline,
  WorldEvent,
  ChatMessage,
  LuckChange,
  MoodChange,
  GameResolution,
  QuestionOutcome,
  GameHistory,
  GenesisGame,
};

// Load actors database
import { loadActorsData } from '@/lib/data/actors-loader';
const actorsData = loadActorsData() as ActorsDatabase;
const actors = actorsData;

/**
 * Main Game Generator
 * 
 * Orchestrates complete LLM-driven game generation
 */
export class GameGenerator {
  private llm: BabylonLLMClient;
  private feedGenerator: FeedGenerator;
  private gameHistory: GameHistory[] = [];
  constructor(apiKey?: string, previousHistory?: GameHistory[]) {
    this.llm = new BabylonLLMClient(apiKey);
    this.feedGenerator = new FeedGenerator(this.llm); // Pass LLM to FeedGenerator
    this.gameHistory = previousHistory || [];
  }

  /**
   * Generate complete game
   * @param preGenerateDays - Number of days to pre-generate (for first game initialization)
   */
  async generateCompleteGame(startDate = '2025-11-01'): Promise<GeneratedGame> {
    const gameNumber = this.gameHistory.length + 1;
    
    logger.info(`GENERATING BABYLON GAME #${gameNumber}...`, undefined, 'GameGenerator');
    logger.info(`Start date: ${startDate}`, undefined, 'GameGenerator');
    logger.info('Duration: 30 days', undefined, 'GameGenerator');
    if (this.gameHistory.length > 0) {
      logger.info(`Loading ${this.gameHistory.length} previous game(s) as context`, undefined, 'GameGenerator');
    } else {
      logger.info('First game - no previous context', undefined, 'GameGenerator');
    }
    logger.info('================================', undefined, 'GameGenerator');

    // Phase 1: Actor Selection
    logger.info('Phase 1: Selecting actors...', undefined, 'GameGenerator');
    const selectedActors = this.selectActors();
    logger.info(`Selected ${selectedActors.mains.length} main actors`, undefined, 'GameGenerator');
    logger.info(`Selected ${selectedActors.supporting.length} supporting actors`, undefined, 'GameGenerator');
    logger.info(`Selected ${selectedActors.extras.length} extras`, undefined, 'GameGenerator');
    
    if (selectedActors.mains.length > 0) {
      logger.info('Main cast:', selectedActors.mains.map(a => `${a.name} - ${(a.description || '').substring(0, 60)}...`), 'GameGenerator');
    }

    // Phase 2: Scenario & Question Generation
    logger.info('Phase 2: Generating scenarios & questions...', undefined, 'GameGenerator');
    
    // Extract organizations first for context
    const organizations = this.extractOrganizations(selectedActors);
    
    // ✅ NEW: Generate NPC personas for consistency and learnability
    logger.info('Generating NPC personas for consistency...', undefined, 'GameGenerator');
    const allActors = [...selectedActors.mains, ...selectedActors.supporting, ...selectedActors.extras];
    const personaGenerator = new NPCPersonaGenerator();
    const personas = personaGenerator.assignPersonas(allActors, organizations);
    
    // Apply personas to actors
    for (const actor of allActors) {
      const persona = personas.get(actor.id);
      if (persona) {
        actor.persona = {
          reliability: persona.reliability,
          insiderOrgs: persona.insiderOrgs,
          expertise: persona.expertise,
          willingToLie: persona.willingToLie,
          selfInterest: persona.selfInterest,
          favorsActors: persona.favorsActors,
          opposesActors: persona.opposesActors,
          favorsOrgs: persona.favorsOrgs,
          opposesOrgs: persona.opposesOrgs,
        };
      }
    }
    
    logger.info(`Assigned ${personas.size} NPC personas`, {
      avgReliability: (Array.from(personas.values()).reduce((sum, p) => sum + p.reliability, 0) / personas.size).toFixed(2),
      insiders: Array.from(personas.values()).filter(p => p.insiderOrgs.length > 0).length,
      liars: Array.from(personas.values()).filter(p => p.willingToLie).length,
    }, 'GameGenerator');
    
    const scenarios = await this.generateScenarios(selectedActors.mains, organizations);
    logger.info(`Generated ${scenarios.length} scenarios`, undefined, 'GameGenerator');
    
    const questions = await this.generateQuestions(scenarios, organizations);
    logger.info(`Generated ${questions.length} questions total`, undefined, 'GameGenerator');
    
    const topQuestions = await this.rankAndSelectQuestions(questions);
    logger.info('Selected top 3 questions', undefined, 'GameGenerator');
    
    // ✅ NEW: Generate arc plans for selected questions (ensures learnable information gradient)
    logger.info('Generating arc plans for questions...', undefined, 'GameGenerator');
    const arcPlanner = new QuestionArcPlanner();
    
    for (const question of topQuestions) {
      const arcPlan = arcPlanner.planQuestionArc(question, allActors, organizations);
      
      // Store arc plan in question metadata
      question.metadata = {
        arcPlan: {
          uncertaintyPeakDay: arcPlan.uncertaintyPeakDay,
          clarityOnsetDay: arcPlan.clarityOnsetDay,
          verificationDay: arcPlan.verificationDay,
          insiders: arcPlan.insiders,
          deceivers: arcPlan.deceivers,
        },
      };
    }
    logger.info('Arc plans generated for all questions', undefined, 'GameGenerator');

    // Phase 3: World Building
    logger.info('Phase 3: Building world...', undefined, 'GameGenerator');
    const connections = this.generateConnections(selectedActors);
    logger.info(`Generated ${connections.length} actor relationships`, undefined, 'GameGenerator');
    
    const groupChats = await this.createGroupChats(selectedActors, connections);
    logger.info(`Created ${groupChats.length} group chats`, undefined, 'GameGenerator');
    
    const luckMood = this.initializeLuckMood(selectedActors);
    logger.info(`Initialized luck & mood for ${luckMood.size} actors`, undefined, 'GameGenerator');

    // Phase 4: 30-Day Timeline Generation
    logger.info('Phase 4: Generating 30-day timeline...', undefined, 'GameGenerator');
    const timeline: DayTimeline[] = [];
    const gameStartDate = new Date(startDate);
    
    // Set organizations in FeedGenerator once before timeline generation
    this.feedGenerator.setOrganizations(organizations);
    
    // ✅ NEW: Set NPC personas in FeedGenerator for consistent behavior
    this.feedGenerator.setNPCPersonas(personas);
    
    for (let day = 1; day <= 30; day++) {
      const currentDate = new Date(gameStartDate);
      currentDate.setDate(gameStartDate.getDate() + (day - 1));
      const dateStr = currentDate.toISOString().split('T')[0]!;

      const phase = this.getPhase(day);
      process.stdout.write(`  [${dateStr}] ${phase.padEnd(12)} `);
      
      const dayTimeline = await this.generateDay(
        day,
        selectedActors,
        topQuestions,
        scenarios,
        groupChats,
        timeline,
        luckMood,
        dateStr,
        connections
      );
      
      timeline.push(dayTimeline);
      logger.debug(`[${dateStr}] ${phase} - ${dayTimeline.events.length} events, ${dayTimeline.feedPosts.length} posts`, undefined, 'GameGenerator');
    }

    // Phase 5: Resolution
    logger.info('Phase 5: Generating resolution...', undefined, 'GameGenerator');
    const resolution = this.generateResolution(topQuestions, timeline);
    logger.info('All questions resolved', undefined, 'GameGenerator');

    // Organizations already extracted earlier for prompt generation
    const game: GeneratedGame = {
      id: `babylon-${Date.now()}`,
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      setup: {
        mainActors: selectedActors.mains,
        supportingActors: selectedActors.supporting,
        extras: selectedActors.extras,
        organizations,
        scenarios,
        questions: topQuestions,
        groupChats,
        connections,
      },
      timeline,
      resolution,
    };

    // Calculate totals
    const totalEvents = timeline.reduce((sum, day) => sum + day.events.length, 0);
    const totalPosts = timeline.reduce((sum, day) => sum + day.feedPosts.length, 0);
    const totalGroupMessages = timeline.reduce((sum, day) => {
      return sum + Object.values(day.groupChats).flat().length;
    }, 0);

    logger.info('GENERATION COMPLETE', undefined, 'GameGenerator');
    logger.info('======================', undefined, 'GameGenerator');
    logger.info(`Total actors: ${selectedActors.mains.length + selectedActors.supporting.length + selectedActors.extras.length}`, undefined, 'GameGenerator');
    logger.info(`Total events: ${totalEvents}`, undefined, 'GameGenerator');
    logger.info(`Total feed posts: ${totalPosts}`, undefined, 'GameGenerator');
    logger.info(`Total group messages: ${totalGroupMessages}`, undefined, 'GameGenerator');

    return game;
  }

  /**
   * Generate Genesis Game
   * October 2025 (full 30 days) - world initialization
   * No questions, just events and social media to establish baseline
   */
  async generateGenesis(): Promise<GenesisGame> {
    logger.info('GENERATING GENESIS GAME...', undefined, 'GameGenerator');
    logger.info('October 2025 - World Initialization (30 days)', undefined, 'GameGenerator');
    logger.info('==============================================', undefined, 'GameGenerator');

    // Select actors for the world
    logger.info('Selecting actors for world initialization...', undefined, 'GameGenerator');
    const selectedActors = this.selectActors();
    const allActors = [...selectedActors.mains, ...selectedActors.supporting, ...selectedActors.extras];
    logger.info(`Selected ${allActors.length} actors`, undefined, 'GameGenerator');

    // Create relationships
    const connections = this.generateConnections(selectedActors);
    
    // Create group chats
    const groupChats = await this.createGroupChats(selectedActors, connections);
    logger.info(`Created ${groupChats.length} group chats`, undefined, 'GameGenerator');

    // Initialize luck and mood
    const luckMood = this.initializeLuckMood(selectedActors);

    // Generate 30 days: October 1-31, 2025
    logger.info('Generating October 1-31, 2025 (30 days)...', undefined, 'GameGenerator');
    const timeline: DayTimeline[] = [];
    const startDate = new Date('2025-10-01');

    for (let day = 1; day <= 30; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + (day - 1));
      const dateStr = currentDate.toISOString().split('T')[0]!;

      process.stdout.write(`  [${dateStr}] `);

      // Generate baseline events (no questions, just world activity)
      const events = await this.generateGenesisEvents(day, allActors, dateStr);
      
      // Generate luck and mood changes based on events
      const luckChanges = this.generateLuckChanges(day, events, allActors, luckMood);
      const moodChanges = this.generateMoodChanges(day, events, allActors, luckMood);
      
      // Apply ambient mood drift with correct parameters
      this.applyAmbientMoodDrift(allActors, luckMood);
      
      // Generate feed posts (no outcome parameter - prevents leakage)
      const feedPosts = await this.feedGenerator.generateDayFeed(
        day,
        events.map(e => ({
          id: e.id,
          day,
          type: e.type,
          description: e.description,
          actors: e.actors,
          visibility: e.visibility,
        })),
        allActors
      );

      // Generate group messages (function signature: day, events, groupChats, allActors)
      const groupMessages = await this.generateGroupMessages(day, events, groupChats, allActors);

      timeline.push({
        day,
        summary: `${dateStr}: ${events.length} events, ${feedPosts.length} posts`,
        events,
        groupChats: groupMessages,
        feedPosts,
        luckChanges,
        moodChanges,
      });

      logger.debug(`[${dateStr}] ${events.length} events, ${feedPosts.length} posts, ${luckChanges.length + moodChanges.length} state changes`, undefined, 'GameGenerator');
    }

    const genesis: GenesisGame = {
      id: 'genesis-2025-10',
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: '2025-10-01',
        end: '2025-10-31',
      },
      actors: allActors,
      timeline,
      summary: 'World initialization - October 2025 (30 days). Normal activity establishing baseline.',
    };

    logger.info('GENESIS COMPLETE', undefined, 'GameGenerator');
    logger.info('===================', undefined, 'GameGenerator');
    logger.info(`Total events: ${timeline.reduce((sum, day) => sum + day.events.length, 0)}`, undefined, 'GameGenerator');
    logger.info(`Total posts: ${timeline.reduce((sum, day) => sum + day.feedPosts.length, 0)}`, undefined, 'GameGenerator');
    logger.info(`Total state changes: ${timeline.reduce((sum, day) => sum + day.luckChanges.length + day.moodChanges.length, 0)}`, undefined, 'GameGenerator');

    return genesis;
  }

  /**
   * Generate baseline events for genesis (no questions)
   */
  private async generateGenesisEvents(
    day: number,
    allActors: SelectedActor[],
    dateStr: string
  ): Promise<WorldEvent[]> {
    const events: WorldEvent[] = [];
    const eventCount = 2 + Math.floor(Math.random() * 2); // 2-3 events per day
    const eventTypes: Array<WorldEvent['type']> = ['meeting', 'announcement', 'deal'];

    for (let i = 0; i < eventCount; i++) {
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]!;
      const numActorsInvolved = type === 'meeting' ? 2 + Math.floor(Math.random() * 2) : 1;
      const involvedActors = shuffleArray(allActors).slice(0, numActorsInvolved);

      const description = await this.generateBaselineEvent(type, involvedActors, dateStr);

      events.push({
        id: `genesis-${day}-${i}`,
        day,
        type,
        actors: involvedActors.map(a => a.id),
        description,
        relatedQuestion: null,
        pointsToward: null,
        visibility: 'public',
      });
    }

    return events;
  }

  /**
   * Generate baseline event description (normal world activity)
   */
  private async generateBaselineEvent(
    type: WorldEvent['type'],
    actors: SelectedActor[],
    dateStr: string
  ): Promise<string> {
    const actorDescriptions = actors.map(a => `${a.name} (${a.description})`).join(', ');

    const prompt = renderPrompt(baselineEvent, {
      dateStr,
      eventType: type,
      actorDescriptions
    });

    const rawResponse = await this.llm.generateJSON<{ event: string } | { response: { event: string } }>(
      prompt,
      undefined,
      { temperature: 0.7, maxTokens: 5000 }
    );

    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { event: string };

    return response.event || `${actors[0]?.name || 'Actor'} ${type}`;
  }

  /**
   * Create game history summary from completed game
   */
  createGameHistory(game: GeneratedGame): GameHistory {
    const highlights = game.timeline
      .flatMap(day => day.events)
      .filter(e => e.pointsToward !== null)
      .slice(0, 10)
      .map(e => e.description);
    
    const topMoments = game.timeline
      .flatMap(day => day.feedPosts)
      .sort((a, b) => Math.abs(b.sentiment ?? 0) - Math.abs(a.sentiment ?? 0))
      .slice(0, 5)
      .map(p => `${p.authorName}: "${p.content}"`);
    
    return {
      gameNumber: this.gameHistory.length + 1,
      completedAt: new Date().toISOString(),
      summary: game.resolution.finalNarrative,
      keyOutcomes: game.resolution.outcomes.map(o => {
        const question = game.setup.questions.find(q => q.id === o.questionId);
        return {
          questionText: question?.text || '',
          outcome: o.answer,
          explanation: o.explanation,
        };
      }),
      highlights,
      topMoments,
    };
  }

  /**
   * Get game history context for prompts
   */
  private getHistoryContext(): string {
    let context = '';
    
    // Add previous game history
    if (this.gameHistory.length > 0) {
      const recent = this.gameHistory.slice(-2); // Last 2 games
      context += `Previous games:
${recent.map(h => `
Game #${h.gameNumber}:
Summary: ${h.summary}
Key outcomes: ${h.keyOutcomes.map(o => `${o.questionText} → ${o.outcome ? 'YES' : 'NO'}`).join('; ')}
`).join('\n')}
`;
    }
    
    if (!context) {
      return 'This is the first game.';
    }
    
    return context + '\nBuild on this history naturally - reference past events, create continuity, but don\'t contradict what happened.';
  }

  /**
   * Select actors with weighted randomness
   * Prioritizes S/A tier for mains, mixed tiers for supporting, C/D for extras
   */
  private selectActors() {
    const allActors = actors.actors;
    
    // Weighted random selection - higher tiers have more weight
    const tierWeights: Record<string, number> = {
      'S_TIER': 10,
      'A_TIER': 6,
      'B_TIER': 3,
      'C_TIER': 1,
      'D_TIER': 0.5,
    };

    // Create weighted pool for mains (heavily favor S/A tier)
    const mainPool = allActors.flatMap(a =>
      Array(Math.ceil(tierWeights[a.tier || 'C_TIER'] || 1)).fill(a)
    );
    const shuffledMains = shuffleArray(mainPool);
    const uniqueMains = Array.from(new Set(shuffledMains.map(a => a.id)))
      .slice(0, 3)
      .map(id => allActors.find(a => a.id === id)!)
      .map(a => ({
        ...a,
        tier: a.tier as ActorTier, // Ensure tier is always set
        role: 'main',
        initialLuck: this.randomLuck(),
        initialMood: this.randomMood(),
      }));

    // Create weighted pool for supporting (moderate favor for A/B tier)
    const supportWeights: Record<string, number> = {
      'S_TIER': 2,
      'A_TIER': 5,
      'B_TIER': 4,
      'C_TIER': 2,
      'D_TIER': 0.5,
    };
    const supportPool = allActors
      .filter(a => !uniqueMains.some(m => m.id === a.id))
      .flatMap(a => Array(Math.ceil(supportWeights[a.tier || 'C_TIER'] || 1)).fill(a));
    const shuffledSupport = shuffleArray(supportPool);
    const uniqueSupporting = Array.from(new Set(shuffledSupport.map(a => a.id)))
      .slice(0, 15)
      .map(id => allActors.find(a => a.id === id)!)
      .map(a => ({
        ...a,
        tier: a.tier as ActorTier, // Ensure tier is always set
        role: 'supporting',
        initialLuck: this.randomLuck(),
        initialMood: this.randomMood(),
      }));

    // Create weighted pool for extras (favor C/D tier)
    const extraWeights: Record<string, number> = {
      'S_TIER': 0.5,
      'A_TIER': 1,
      'B_TIER': 2,
      'C_TIER': 4,
      'D_TIER': 5,
    };
    const usedIds = new Set([...uniqueMains, ...uniqueSupporting].map(a => a.id));
    const extraPool = allActors
      .filter(a => !usedIds.has(a.id))
      .flatMap(a => Array(Math.ceil(extraWeights[a.tier || 'C_TIER'] || 1)).fill(a));
    const shuffledExtras = shuffleArray(extraPool);
    const uniqueExtras = Array.from(new Set(shuffledExtras.map(a => a.id)))
      .slice(0, 50)
      .map(id => allActors.find(a => a.id === id)!)
      .map(a => ({
        ...a,
        tier: a.tier as ActorTier, // Ensure tier is always set
        role: 'extra',
        initialLuck: this.randomLuck(),
        initialMood: this.randomMood(),
      }));

    return { mains: uniqueMains, supporting: uniqueSupporting, extras: uniqueExtras };
  }

  /**
   * Extract organizations affiliated with selected actors
   * Weighs by actor tier and involvement
   */
  private extractOrganizations(selectedActors: { mains: SelectedActor[], supporting: SelectedActor[], extras: SelectedActor[] }): Organization[] {
    const allSelectedActors = [...selectedActors.mains, ...selectedActors.supporting, ...selectedActors.extras];
    const orgIds = new Set<string>();
    const orgWeights = new Map<string, number>();

    // Collect all affiliated organization IDs with weights
    for (const actor of allSelectedActors) {
      if (!actor.affiliations) continue;
      
      // Weight by actor role
      let weight = 1;
      if (actor.role === 'main') weight = 3;
      else if (actor.role === 'supporting') weight = 2;
      
      for (const orgId of actor.affiliations) {
        orgIds.add(orgId);
        orgWeights.set(orgId, (orgWeights.get(orgId) || 0) + weight);
      }
    }

    // Get full organization objects and sort by weight
    const organizations = actors.organizations
      .filter(org => orgIds.has(org.id))
      .sort((a, b) => (orgWeights.get(b.id) || 0) - (orgWeights.get(a.id) || 0));

    logger.debug(`Extracted ${organizations.length} organizations (${organizations.filter(o => o.type === 'company').length} companies, ${organizations.filter(o => o.type === 'media').length} media, ${organizations.filter(o => o.type === 'government').length} government)`, undefined, 'GameGenerator');
    
    return organizations;
  }

  private randomLuck(): 'low' | 'medium' | 'high' {
    const r = Math.random();
    if (r < 0.3) return 'low';
    if (r < 0.7) return 'medium';
    return 'high';
  }

  private randomMood(): number {
    return (Math.random() - 0.5) * 2; // -1 to 1
  }

  public getActorTier(id: string): string {
    const actor = actors.actors.find(a => a.id === id);
    return actor ? (actor.tier || 'D_TIER') : 'D_TIER';
  }

  /**
   * Generate scenarios using LLM with rich prompt
   */
  private async generateScenarios(mains: SelectedActor[], organizations: Organization[]): Promise<Scenario[]> {
    const historyContext = this.getHistoryContext();
    const basePrompt = createScenarioPrompt(mains, organizations);
    const prompt = `${basePrompt}

${historyContext}

If there's previous game history, reference it naturally (e.g., "After the events of last game...", "Following up on...").
Otherwise, start fresh.`;
    
    const rawResult = await this.llm.generateJSON<{ scenarios: Scenario[] } | { response: { scenarios: Scenario[] } }>(prompt, undefined, {
      temperature: 0.9,
      maxTokens: 8000,
    });
    
    // Handle XML structure - may be nested like { scenarios: { scenario: [...] } }
    let scenarios: Scenario[];
    
    if ('response' in rawResult && rawResult.response && rawResult.response.scenarios) {
      const responseSc = rawResult.response.scenarios;
      if (Array.isArray(responseSc)) {
        scenarios = responseSc;
      } else if (typeof responseSc === 'object' && 'scenario' in responseSc) {
        const nested = (responseSc as { scenario: Scenario[] | Scenario }).scenario;
        scenarios = Array.isArray(nested) ? nested : [nested];
      } else {
        logger.error('Invalid scenarios in response:', JSON.stringify(responseSc, null, 2), 'GameGenerator');
        throw new Error('LLM returned invalid scenarios in response');
      }
    } else if (rawResult && 'scenarios' in rawResult && rawResult.scenarios) {
      if (Array.isArray(rawResult.scenarios)) {
        scenarios = rawResult.scenarios;
      } else if (typeof rawResult.scenarios === 'object' && 'scenario' in rawResult.scenarios) {
        const nested = (rawResult.scenarios as { scenario: Scenario[] | Scenario }).scenario;
        scenarios = Array.isArray(nested) ? nested : [nested];
      } else {
        logger.error('Invalid scenarios structure:', JSON.stringify(rawResult.scenarios, null, 2), 'GameGenerator');
        throw new Error('LLM returned invalid scenarios structure');
      }
    } else {
      logger.error('No scenarios found in response:', JSON.stringify(rawResult, null, 2), 'GameGenerator');
      throw new Error('LLM returned no scenarios');
    }
    
    // Validate scenarios array exists
    if (!scenarios || scenarios.length === 0) {
      logger.error('No scenarios returned from LLM', undefined, 'GameGenerator');
      throw new Error('LLM returned empty scenarios');
    }

    // Validate each scenario has required fields
    for (const scenario of scenarios) {
      // Handle XML nested structures in mainActors
      if (scenario.mainActors) {
        if (typeof scenario.mainActors === 'object' && 'actorId' in scenario.mainActors) {
          const actorIds = scenario.mainActors.actorId;
          scenario.mainActors = Array.isArray(actorIds) ? actorIds : [actorIds];
        }
      }
      
      // Handle XML nested structures in involvedOrganizations
      if (scenario.involvedOrganizations && typeof scenario.involvedOrganizations === 'object') {
        if ('orgId' in scenario.involvedOrganizations) {
          const orgIds = scenario.involvedOrganizations.orgId;
          scenario.involvedOrganizations = Array.isArray(orgIds) ? orgIds : [orgIds];
        }
      }
      
      if (!scenario.mainActors || !Array.isArray(scenario.mainActors)) {
        logger.error('Scenario missing mainActors:', JSON.stringify(scenario, null, 2), 'GameGenerator');
        throw new Error(`Scenario "${scenario.title}" is missing mainActors array`);
      }
      if (!scenario.title || !scenario.description) {
        logger.error('Scenario missing required fields:', JSON.stringify(scenario, null, 2), 'GameGenerator');
        throw new Error('Scenario is missing title or description');
      }
    }
    
    return scenarios;
  }

  /**
   * Generate questions using LLM with rich prompt
   */
  private async generateQuestions(scenarios: Scenario[], organizations: Organization[]): Promise<Question[]> {
    const prompt = createQuestionPrompt(scenarios, organizations);
    // Note: Not using schema validation here because LLM sometimes returns array format
    const rawResult = await this.llm.generateJSON<{ questions: Question[] } | Array<{ questions: Question[] }>>(prompt, undefined, {
      temperature: 0.85,
      maxTokens: 8000,
    });
    
    // Handle both possible response formats:
    // 1. { questions: [...] } - expected format
    // 2. [{ questions: [...] }, { questions: [...] }] - grouped by scenario
    // 3. { questions: { question: [...] } } - XML nested structure
    let questions: Question[];
    
    if (Array.isArray(rawResult)) {
      // LLM returned array of objects - flatten into single object
      logger.warn('LLM returned array format, flattening...', undefined, 'GameGenerator');
      questions = rawResult.flatMap(item => {
        if (item && item.questions && Array.isArray(item.questions)) {
          return item.questions;
        }
        return [];
      });
    } else if (rawResult && 'questions' in rawResult && rawResult.questions) {
      // Check if it's an array or nested structure
      if (Array.isArray(rawResult.questions)) {
        questions = rawResult.questions;
      } else if (typeof rawResult.questions === 'object' && 'question' in rawResult.questions) {
        // XML nested structure: { questions: { question: [...] } }
        const nested = (rawResult.questions as { question: Question[] | Question }).question;
        questions = Array.isArray(nested) ? nested : [nested];
        logger.warn('LLM returned XML nested structure, extracting...', undefined, 'GameGenerator');
      } else {
        logger.error('Invalid questions structure:', JSON.stringify(rawResult.questions, null, 2), 'GameGenerator');
        throw new Error('LLM returned invalid questions structure');
      }
    } else {
      // Invalid format
      logger.error('Invalid response from LLM:', JSON.stringify(rawResult, null, 2), 'GameGenerator');
      throw new Error(
        'LLM returned invalid response. Expected { questions: [...] } but got: ' + 
        (rawResult ? JSON.stringify(rawResult).substring(0, 200) : 'undefined')
      );
    }

    if (!questions || questions.length === 0) {
      throw new Error('LLM returned empty questions array');
    }
    
    // Assign predetermined outcomes to each question
    const questionsWithOutcomes = questions.map((q, i) => ({
      ...q,
      outcome: Math.random() > 0.5, // Random YES or NO outcome
      rank: q.rank || (i + 1), // Default rank if not provided
    }));
    
    return questionsWithOutcomes;
  }

  /**
   * Rank questions and select top 3
   */
  private async rankAndSelectQuestions(questions: Question[]): Promise<Question[]> {
    const questionsList = questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n');

    const prompt = renderPrompt(questionRankings, {
      questionCount: questions.length.toString(),
      questionsList
    });

    const rawResult = await this.llm.generateJSON<{ rankings: { questionId: number; rank: number }[] } | { response: { rankings: { questionId: number; rank: number }[] } }>(prompt);
    
    // Handle XML structure - may be nested like { rankings: { ranking: [...] } }
    let rankings: Array<{ questionId: number; rank: number }> = [];
    
    if ('response' in rawResult && rawResult.response) {
      const responseRankings = rawResult.response.rankings;
      if (Array.isArray(responseRankings)) {
        rankings = responseRankings;
      } else if (responseRankings && typeof responseRankings === 'object' && 'ranking' in responseRankings) {
        const nested = (responseRankings as { ranking: Array<{ questionId: number; rank: number }> | { questionId: number; rank: number } }).ranking;
        rankings = Array.isArray(nested) ? nested : [nested];
      }
    } else if (rawResult && 'rankings' in rawResult && rawResult.rankings) {
      if (Array.isArray(rawResult.rankings)) {
        rankings = rawResult.rankings;
      } else if (typeof rawResult.rankings === 'object' && 'ranking' in rawResult.rankings) {
        const nested = (rawResult.rankings as { ranking: Array<{ questionId: number; rank: number }> | { questionId: number; rank: number } }).ranking;
        rankings = Array.isArray(nested) ? nested : [nested];
      }
    }
    
    // Apply rankings (with safety check)
    if (rankings && rankings.length > 0) {
      rankings.forEach(r => {
        const q = questions.find(q => q.id === r.questionId);
        if (q) q.rank = r.rank;
      });
    }

    // Sort by rank and take top 3
    return questions.sort((a, b) => a.rank - b.rank).slice(0, 3);
  }

  /**
   * Generate actor connections with richer network
   */
  private generateConnections(selectedActors: SelectedActorsByTier): ActorConnection[] {
    const connections: ActorConnection[] = [];
    
    // Connect each main to each other (rivalry or alliance)
    for (let i = 0; i < selectedActors.mains.length; i++) {
      for (let j = i + 1; j < selectedActors.mains.length; j++) {
        const actor1 = selectedActors.mains[i];
        const actor2 = selectedActors.mains[j];
        if (!actor1 || !actor2) continue;

        const relationship = Math.random() > 0.5 ? 'rivals' : 'allies';
        connections.push({
          actor1: actor1.id,
          actor2: actor2.id,
          relationship,
          context: `${relationship === 'rivals' ? 'Competing' : 'Collaborating'} in ${actor1.domain?.[0] || 'same space'}`,
        });
      }
    }

    // Each main has connections to 3-5 supporting actors
    selectedActors.mains.forEach((main: SelectedActor) => {
      const numConnections = 3 + Math.floor(Math.random() * 3);
      const connected = shuffleArray([...selectedActors.supporting]).slice(0, numConnections);
      
      connected.forEach((supporting: SelectedActor) => {
        const relationships = ['advisor', 'source', 'critic', 'ally', 'friend'];
        connections.push({
          actor1: main.id,
          actor2: supporting.id,
          relationship: relationships[Math.floor(Math.random() * relationships.length)]!,
          context: `Professional relationship in ${main.domain?.[0] || 'industry'}`,
        });
      });
    });

    // Supporting actors connect to each other (creates richer network)
    selectedActors.supporting.forEach((supporting: SelectedActor, i: number) => {
      const numConnections = 2 + Math.floor(Math.random() * 2); // 2-3 connections
      // Exclude current actor and filter out already connected actors
      const potentials = selectedActors.supporting
        .filter((other: SelectedActor, idx: number) => 
          idx !== i && 
          !connections.some(c => 
            (c.actor1 === supporting.id && c.actor2 === other.id) ||
            (c.actor2 === supporting.id && c.actor1 === other.id)
          )
        );
      
      const connected = shuffleArray(potentials).slice(0, numConnections) as SelectedActor[];
      
      connected.forEach((other: SelectedActor) => {
        const relationships = ['ally', 'friend', 'source', 'critic'];
        connections.push({
          actor1: supporting.id,
          actor2: other.id,
          relationship: relationships[Math.floor(Math.random() * relationships.length)]!,
          context: `Peers in ${supporting.domain?.[0] || 'industry'}`,
        });
      });
    });

    return connections;
  }

  /**
   * Initialize luck and mood tracking for all actors
   */
  private initializeLuckMood(selectedActors: { mains: SelectedActor[]; supporting: SelectedActor[]; extras: SelectedActor[] }): Map<string, { luck: string; mood: number }> {
    const tracking = new Map<string, { luck: string; mood: number }>();
    
    const allActors = [
      ...(selectedActors.mains || []),
      ...(selectedActors.supporting || []),
      ...(selectedActors.extras || []),
    ];

    allActors.forEach((actor: SelectedActor) => {
      if (actor && actor.id) {
        tracking.set(actor.id, {
          luck: actor.initialLuck || 'medium',
          mood: actor.initialMood || 0,
        });
      }
    });

    return tracking;
  }

  /**
   * Generate a contextually relevant group chat name using LLM
   */
  private async generateGroupChatName(
    admin: SelectedActor,
    members: SelectedActor[],
    domain: string
  ): Promise<string> {
    const memberDescriptions = members.map(m => {
      const affiliations = m.affiliations?.slice(0, 2).join(', ') || 'various organizations';
      return `- ${m.name}: ${m.role || 'Notable figure'} at ${affiliations}`;
    }).join('\n');

    const prompt = renderPrompt(groupChatName, {
      adminName: admin.name,
      adminRole: admin.role || 'Notable figure',
      domain,
      adminAffiliations: admin.affiliations?.slice(0, 3).join(', ') || 'various organizations',
      memberDescriptions
    });

    const rawResponse = await this.llm.generateJSON<{ name: string } | { response: { name: string } }>(prompt, {
      required: ['name']
    });

    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { name: string };

    return response.name.toLowerCase();
  }

  /**
   * Create group chats - one per main actor + some for high-tier supporting
   */
  private async createGroupChats(selectedActors: SelectedActorsByTier, connections: ActorConnection[]): Promise<GroupChat[]> {
    const chats: GroupChat[] = [];
    
    // Helper to get positive relationships for an actor
    const getPositiveConnections = (actorId: string): string[] => {
      const positiveRelationships = ['ally', 'friend', 'advisor', 'source'];
      return connections
        .filter(c => 
          (c.actor1 === actorId || c.actor2 === actorId) &&
          positiveRelationships.includes(c.relationship)
        )
        .map(c => c.actor1 === actorId ? c.actor2 : c.actor1);
    };
    
    // Helper to get actor details by ID
    const getActorById = (id: string): SelectedActor | undefined => {
      return [...selectedActors.mains, ...selectedActors.supporting, ...selectedActors.extras]
        .find((a: SelectedActor) => a.id === id);
    };
    
    logger.info('Generating contextual group chat names...', undefined, 'GameGenerator');
    
    // One group per main actor
    for (const main of selectedActors.mains) {
      const positiveConnections = getPositiveConnections(main.id);
      const memberIds = [main.id, ...positiveConnections.slice(0, 6)];
      const members = memberIds.map(id => getActorById(id)).filter((actor): actor is SelectedActor => actor !== null && actor !== undefined);

      const domain = main.domain?.[0] || 'general';

      // Generate contextual name using LLM
      const groupName = await this.generateGroupChatName(main, members, domain);
      const kebabName = groupName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      logger.debug(`"${groupName}" (admin: ${main.name})`, undefined, 'GameGenerator');
      
      chats.push({
        id: kebabName,
        name: groupName,
        admin: main.id,
        members: memberIds,
        theme: domain,
      });
    }
    
    // Add 1-2 groups for S/A-tier supporting actors
    const highTierSupporting = selectedActors.supporting
      .filter((a: SelectedActor) => a.tier === 'S_TIER' || a.tier === 'A_TIER')
      .slice(0, 2);
    
    for (const supporting of highTierSupporting) {
      const positiveConnections = getPositiveConnections(supporting.id);
      const memberIds = [supporting.id, ...positiveConnections.slice(0, 5)];
      const members = memberIds.map(id => getActorById(id)).filter((actor): actor is SelectedActor => actor !== null && actor !== undefined);

      const domain = supporting.domain?.[0] || 'general';

      // Generate contextual name using LLM
      const groupName = await this.generateGroupChatName(supporting, members, domain);
      const kebabName = groupName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + `-${chats.length}`;
      
      logger.debug(`"${groupName}" (admin: ${supporting.name})`, undefined, 'GameGenerator');
      
      chats.push({
        id: kebabName,
        name: groupName,
        admin: supporting.id,
        members: memberIds,
        theme: domain,
      });
    }

    return chats;
  }

  /**
   * Generate single day's events, feed posts, and group messages
   */
  private async generateDay(
    day: number,
    actors: { mains: SelectedActor[]; supporting: SelectedActor[]; extras: SelectedActor[] },
    questions: Question[],
    scenarios: Scenario[],
    groupChats: GroupChat[],
    previousDays: DayTimeline[],
    luckMood: Map<string, { luck: string; mood: number }>,
    dateStr: string,
    connections: ActorConnection[]
  ): Promise<DayTimeline> {
    const phase = this.getPhase(day);
    const eventCount = this.getEventCount(day);
    const allActors = [...actors.mains, ...actors.supporting, ...actors.extras];

    // Build comprehensive context
    const previousMonthContext = this.gameHistory.length > 0 
      ? generatePreviousMonthContext(this.gameHistory) 
      : '';
    const currentMonthContext = generateCurrentMonthContext(actors.mains, scenarios, questions, day);
    const daySummariesContext = previousDays.length > 0 
      ? generateDaySummariesContext(previousDays) 
      : '';
    
    const fullContext = previousMonthContext + currentMonthContext + daySummariesContext;

    // Generate events with full context
    const events: WorldEvent[] = [];
    const eventTypes: Array<WorldEvent['type']> = ['meeting', 'announcement', 'scandal', 'deal', 'conflict', 'revelation'];
    
    const eventRequests: Array<{
      eventNumber: number;
      type: WorldEvent['type'];
      actors: SelectedActor[];
      questionId: number;
    }> = [];
    
    for (let i = 0; i < eventCount; i++) {
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]!;
      const numActorsInvolved = type === 'meeting' ? 2 + Math.floor(Math.random() * 3) : 1;
      const involvedActors = shuffleArray(allActors).slice(0, numActorsInvolved);
      const questionId = questions[i % questions.length]!.questionNumber || 0;

      eventRequests.push({
        eventNumber: i,
        type,
        actors: involvedActors,
        questionId,
      });
    }
    
    // Generate all descriptions in one batched call with full context
    const descriptions = await this.generateDayEventsBatch(
      day,
      eventRequests,
      questions,
      fullContext,
      luckMood,
      connections
    );
      
    // Determine if this day should reveal answer hints based on phase
    const shouldReveal = this.shouldRevealAnswer(day, phase);

    descriptions.forEach((desc, i) => {
      const req = eventRequests[i];
      if (!req) return; // Skip if no matching request

      events.push({
        id: `event-${day}-${i}`,
        day,
        type: req.type,
        actors: req.actors.map((a: SelectedActor) => a.id),
        description: desc.event,
        relatedQuestion: req.questionId,
        // Only reveal hints if phase allows it
        pointsToward: shouldReveal ? (desc.pointsToward || null) : null,
        visibility: req.type === 'meeting' ? 'private' : 'public',
      });
    });

    // Prepare actor states for this day
    const actorStateMap = new Map();
    allActors.forEach((actor: SelectedActor) => {
      const state = luckMood.get(actor.id);
      actorStateMap.set(actor.id, {
        mood: state?.mood || 0,
        luck: (state?.luck as 'low' | 'medium' | 'high') || 'medium',
      });
    });
    
    // Build group contexts for all actors
    const actorGroupContextMap = new Map<string, string>();
    allActors.forEach((actor: SelectedActor) => {
      const groupContext = getActorGroupContext(actor.id, groupChats, previousDays, allActors);
      actorGroupContextMap.set(actor.id, groupContext);
    });
    
    // Set context and states in feed generator
    this.feedGenerator.setActorStates(actorStateMap);
    this.feedGenerator.setRelationships(connections);
    this.feedGenerator.setActorGroupContexts(actorGroupContextMap);

    // Generate feed posts from events
    const feedPosts: FeedPost[] = [];
    const eventFeedPosts = await this.feedGenerator.generateDayFeed(
      day,
      events.map(e => ({
        id: e.id,
        day,
        type: e.type,
        description: e.description,
        actors: e.actors,
        visibility: e.visibility,
      })),
      allActors
    );
    feedPosts.push(...eventFeedPosts);

    // Generate group messages - BATCHED
    const groupMessages = await this.generateDayGroupMessagesBatch(
      day, 
      events, 
      groupChats, 
      allActors, 
      previousDays, 
      luckMood, 
      connections,
      scenarios,
      questions,
      fullContext
    );

    // Apply ambient mood drift for all actors (small random changes)
    this.applyAmbientMoodDrift(allActors, luckMood);

    // Generate luck and mood changes (for actors in events - larger changes)
    const luckChanges = this.generateLuckChanges(day, events, allActors, luckMood);
    const moodChanges = this.generateMoodChanges(day, events, allActors, luckMood);

    // Generate resolution events during the Resolution phase (days 27-30)
    if (phase === 'Resolution' && day >= 28) {
      // Generate one resolution event per question on days 28-30
      const questionIndex = day - 28; // Day 28 = question 0, day 29 = question 1, day 30 = question 2
      if (questionIndex < questions.length) {
        const resolutionEvent = await this.generateResolutionEvent(
          questions[questionIndex]!,
          allActors,
          day,
          previousDays
        );
        events.push(resolutionEvent);
      }
    }

    return {
      day,
      summary: `${dateStr}: ${phase} phase - ${events.length} events, ${feedPosts.length} posts, ${Object.values(groupMessages).flat().length} group messages`,
      events,
      groupChats: groupMessages,
      feedPosts,
      luckChanges,
      moodChanges,
    };
  }

  /**
   * BATCHED: Generate all event descriptions for a day in ONE call with full context
   */
  private async generateDayEventsBatch(
    day: number,
    eventRequests: Array<{
      eventNumber: number;
      type: WorldEvent['type'];
      actors: SelectedActor[];
      questionId: number;
    }>,
    questions: Question[],
    fullContext: string,
    luckMood: Map<string, { luck: string; mood: number }>,
    connections: ActorConnection[]
  ): Promise<Array<{ eventNumber: number; event: string; pointsToward: 'YES' | 'NO' | null }>> {
    const eventRequestsList = eventRequests.map((req, i) => {
      const question = questions.find(q => q.id === req.questionId);
      const actorsWithMood = req.actors.map(a => {
        const state = luckMood.get(a.id);
        const emotionalContext = state
          ? generateActorContext(state.mood, state.luck as 'low' | 'medium' | 'high', undefined, connections, a.id)
          : '';
        return `${a.name} (${a.description})${emotionalContext ? '\n   ' + emotionalContext.replace(/\n/g, '\n   ') : ''}`;
      }).join('\n   ');
      return `${i + 1}. Type: ${req.type}
   Actors: 
   ${actorsWithMood}
   Related to: ${question?.text || 'General drama'}
   
   Create event involving these actors. Build on the narrative above.
   Their mood and luck should influence the nature of the event.
   One sentence, max 120 chars, satirical but plausible.`;
    }).join('\n');

    const prompt = renderPrompt(dayEvents, {
      fullContext,
      day: day.toString(),
      eventCount: eventRequests.length.toString(),
      eventRequestsList
    });

    const rawResponse = await this.llm.generateJSON<{ 
      events: Array<{ 
        eventNumber: number; 
        event: string; 
        pointsToward: 'YES' | 'NO' | null 
      }> 
    } | {
      response: {
        events: Array<{ 
          eventNumber: number; 
          event: string; 
          pointsToward: 'YES' | 'NO' | null 
        }> 
      }
    }>(prompt, undefined, { temperature: 0.9, maxTokens: 5000 });

    // Handle XML structure - may be nested like { events: { event: [...] } }
    let events: Array<{ eventNumber: number; event: string; pointsToward: 'YES' | 'NO' | null }> = [];
    
    if ('response' in rawResponse && rawResponse.response && rawResponse.response.events) {
      if (Array.isArray(rawResponse.response.events)) {
        events = rawResponse.response.events;
      } else if (typeof rawResponse.response.events === 'object' && 'event' in rawResponse.response.events) {
        const nested = (rawResponse.response.events as { event: Array<{ eventNumber: number; event: string; pointsToward: 'YES' | 'NO' | null }> }).event;
        events = Array.isArray(nested) ? nested : [nested];
      }
    } else if (rawResponse && 'events' in rawResponse && rawResponse.events) {
      if (Array.isArray(rawResponse.events)) {
        events = rawResponse.events;
      } else if (typeof rawResponse.events === 'object' && 'event' in rawResponse.events) {
        const nested = (rawResponse.events as { event: Array<{ eventNumber: number; event: string; pointsToward: 'YES' | 'NO' | null }> }).event;
        events = Array.isArray(nested) ? nested : [nested];
      }
    }

    return events;
  }

  /**
   * Should this day's events reveal the answer?
   * 
   * Returns true if this event should include a pointsToward hint.
   * Probability increases over time to create information gradient:
   * - Early (Days 1-10): 15% reveal rate (mostly ambiguous)
   * - Middle (Days 11-20): 45% reveal rate (some clarity)
   * - Late (Days 21-25): 75% reveal rate (clear signals)
   * - Climax (Days 26-29): 90% reveal rate (very clear)
   * - Resolution (Day 30): 100% reveal (definitive proof)
   * 
   * This creates a learnable gradient where early bets are risky/valuable
   * and late bets are safe/lower-value.
   */
  private shouldRevealAnswer(_day: number, phase: string): boolean {
    if (phase === 'Early') return Math.random() > 0.85;   // 15% reveal
    if (phase === 'Middle') return Math.random() > 0.55;  // 45% reveal
    if (phase === 'Late') return Math.random() > 0.25;    // 75% reveal
    if (phase === 'Climax') return Math.random() > 0.10;  // 90% reveal
    return true; // Resolution always reveals
  }

  /**
   * Generate concrete event description using LLM
   * Events should be specific, concrete things that happened
   */
  public async generateEventDescription(
    actors: SelectedActor[],
    type: WorldEvent['type'],
    _questionId: number,
    day: number
  ): Promise<string> {
    const actorNames = actors.map(a => a.name).join(' and ');
    const prompt = `Generate a satirical event description for day ${day}.
Event type: ${type}
Actors: ${actorNames}
Max 120 characters, one sentence.`;

    const rawResponse = await this.llm.generateJSON<{ event: string } | { response: { event: string } }>(
      prompt,
      undefined,
      { temperature: 0.9 }
    );

    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { event: string };

    return response.event || `${actorNames} ${type}`;
  }

  /**
   * Generate a resolution event that definitively resolves a question
   * These happen on days 21-30 and provide clear YES or NO evidence
   */
  private async generateResolutionEvent(
    question: Question,
    allActors: SelectedActor[],
    day: number,
    previousDays: DayTimeline[]
  ): Promise<WorldEvent> {
    // Get actors involved in this question's scenario
    const mainActors = allActors.filter(a => a.role === 'main').slice(0, 2);
    
    // Build context from previous events
    const relatedEvents = previousDays
      .flatMap(d => d.events)
      .filter(e => e.relatedQuestion === question.id)
      .slice(-3); // Last 3 related events
    
    const eventHistory = relatedEvents.length > 0
      ? `Recent events: ${relatedEvents.map(e => e.description).join('; ')}`
      : 'No prior events';

    const outcome = question.outcome ? 'YES' : 'NO';
    const outcomeContext = question.outcome ? 'PROVES it happened' : 'PROVES it failed/was cancelled';

    const prompt = renderPrompt(resolutionEvent, {
      questionText: question.text,
      outcome,
      eventHistory,
      outcomeContext
    });

    const rawResponse = await this.llm.generateJSON<{ event: string; type: 'announcement' | 'revelation' } | { response: { event: string; type: 'announcement' | 'revelation' } }>(
      prompt,
      undefined,
      { temperature: 0.7, maxTokens: 5000 }
    );

    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { event: string; type: 'announcement' | 'revelation' };

    return {
      id: `resolution-${day}-${question.id}`,
      day,
      type: response.type || 'revelation',
      actors: mainActors.map(a => a.id),
      description: response.event || `Resolution event for question ${question.id}`,
      relatedQuestion: toQuestionIdNumberOrNull(question.id),
      pointsToward: question.outcome ? 'YES' : 'NO',
      visibility: 'public',
    };
  }

  /**
   * BATCHED: Generate all group messages for the day in ONE call
   * Reduces ~5 calls per day → 1 call per day
   */
  private async generateDayGroupMessagesBatch(
    day: number,
    events: WorldEvent[],
    groupChats: GroupChat[],
    allActors: SelectedActor[],
    previousDays: DayTimeline[] = [],
    luckMood?: Map<string, { luck: string; mood: number }>,
    connections?: ActorConnection[],
    scenarios?: Scenario[],
    questions?: Question[],
    fullContext?: string
  ): Promise<Record<string, ChatMessage[]>> {
    const messages: Record<string, ChatMessage[]> = {};
    const groupRequests: Array<{
      groupId: string;
      groupName: string;
      groupTheme: string;
      members: Array<{
        actorId: string;
        actorName: string;
        description: string;
        personality: string;
        role: string;
      }>;
      previousMessages: Array<{
        actorName: string;
        message: string;
        day: number;
      }>;
    }> = [];
    
    // Build requests for active groups
    for (const group of groupChats) {
      const activityChance = this.getGroupActivityChance(day);
      
      if (Math.random() < activityChance) {
        const numMessages = 1 + Math.floor(Math.random() * 3); // 1-3 messages
        
        // Pick random members to post
        const activeMembers = shuffleArray(
          allActors.filter(a => group.members.includes(a.id))
        ).slice(0, numMessages);
        
        if (activeMembers.length > 0) {
          // Get recent conversation history from this group (last 2-3 days, max 5 messages)
          const recentMessages: Array<{
            actorName: string;
            message: string;
            day: number;
          }> = [];
          
          for (let i = previousDays.length - 1; i >= Math.max(0, previousDays.length - 3); i--) {
            const dayData = previousDays[i];
            if (!dayData) continue;

            const groupMessages = dayData.groupChats?.[group.id] || [];
            
            for (const msg of groupMessages.slice(-5)) {
              const actor = allActors.find(a => a.id === msg.from);
              if (actor) {
                recentMessages.unshift({
                  actorName: actor.name,
                  message: msg.message,
                  day: dayData.day,
                });
              }
            }
          }
          
          groupRequests.push({
            groupId: group.id,
            groupName: group.name,
            groupTheme: group.theme,
            members: activeMembers.map(a => ({
              actorId: a.id,
              actorName: a.name,
              description: a.description || '',
              personality: a.personality || '',
              role: a.role,
            })),
            previousMessages: recentMessages.slice(-5), // Keep last 5 messages max
          });
        }
      }
    }
    
    // If no active groups, return empty
    if (groupRequests.length === 0) {
      return messages;
    }
    
    // Generate all messages in one batch
    const recentEvent = events.length > 0 ? events[Math.floor(Math.random() * events.length)] : null;

    // Build additional context from optional parameters
    const scenarioContext = scenarios && scenarios.length > 0
      ? `\n\nACTIVE SCENARIOS: ${scenarios.map(s => s.description).join('; ')}`
      : '';

    const questionContext = questions && questions.length > 0
      ? `\n\nQUESTIONS TO RESOLVE: ${questions.map(q => q.text).join('; ')}`
      : '';

    // Build emotional state context for actors
    const getEmotionalState = (actorId: string): string => {
      if (!luckMood) return '';
      const state = luckMood.get(actorId);
      if (!state) return '';
      
      const moodDesc = state.mood > 0.3 ? 'confident' : state.mood < -0.3 ? 'pessimistic' : 'neutral';
      const luckDesc = state.luck === 'high' ? '🍀 lucky streak' : state.luck === 'low' ? '💀 unlucky' : 'average luck';
      return ` [${moodDesc}, ${luckDesc}]`;
    };

    // Build relationship context between group members
    const getRelationshipContext = (groupMembers: Array<{ actorId: string; actorName: string }>): string => {
      if (!connections || groupMembers.length < 2) return '';

      const relevantConnections = connections.filter(conn =>
        groupMembers.some(m => m.actorId === conn.actor1) &&
        groupMembers.some(m => m.actorId === conn.actor2)
      );

      if (relevantConnections.length === 0) return '';

      const connectionLines = relevantConnections.map(conn => {
        const actor1 = groupMembers.find(m => m.actorId === conn.actor1);
        const actor2 = groupMembers.find(m => m.actorId === conn.actor2);
        return `   • ${actor1?.actorName} ↔️ ${actor2?.actorName}: ${conn.relationship}`;
      }).join('\n');

      return `\n   \n   RELATIONSHIPS IN THIS GROUP:\n${connectionLines}\n`;
    };;

    const groupsList = groupRequests.map((req, i) => `${i + 1}. "${req.groupName}"
   
   MEMBERS IN THIS CHAT (don't gossip about them):
${req.members.map((m, j) => {
  const actor = allActors.find(a => a.id === m.actorId);
  const emotionalState = getEmotionalState(m.actorId);
  return `   ${j + 1}. ${m.actorName}${emotionalState} [${actor?.affiliations?.join(', ') || 'independent'}]`;
}).join('\n')}${getRelationshipContext(req.members)}
   
   PEOPLE NOT IN THIS CHAT (you can gossip):
   ${shuffleArray(allActors.filter(a => !req.members.find(m => m.actorId === a.id))).slice(0, 12).map(a => a.name).join(', ')}
   
   ${req.previousMessages.length > 0 ? `CONVERSATION HISTORY:
${req.previousMessages.map(pm => `   [Day ${pm.day}] ${pm.actorName}: "${pm.message}"`).join('\n')}
   
   ` : ''}PRIVATE CHAT RULES:
   ✅ Share insider info about YOUR orgs (be strategic about what you reveal)
   ✅ Discuss vulnerabilities, doubts, real plans
   ✅ Gossip about outsiders
   ✅ Respond naturally to each other
   ✅ Reference scenarios/questions/events from insider perspective
   ✅ Let emotional state influence your tone (confident/pessimistic/neutral)
   ✅ Consider your relationships with other members
   ❌ DON'T gossip about members IN this chat
   ❌ DON'T just repeat public statements
   
   Generate ${req.members.length} messages:
${req.members.map((m, idx) => {
  const actor = allActors.find(a => a.id === m.actorId);
  const emotionalState = getEmotionalState(m.actorId);
  return `   ${idx + 1}. ${m.actorName}${emotionalState} [${actor?.affiliations?.join(', ') || 'independent'}]:
      ${idx === 0 
        ? 'Start/continue - share insider knowledge, strategic thoughts, or private reactions'
        : 'Respond to previous - add insider perspective, gossip about outsiders, share org info'}`;
}).join('\n')}
   
   Max 200 chars each. PRIVATE conversation - strategic, vulnerable, gossipy.
`).join('\n');

    const prompt = renderPrompt(groupMessages, {
      fullContext: fullContext || `Day ${day} of 30`,
      scenarioContext,
      questionContext,
      day: day.toString(),
      eventsList: events.map(e => e.description).join('; '),
      recentEventContext: recentEvent ? `\nMost talked about: ${recentEvent.description}` : '',
      groupCount: groupRequests.length,
      groupsList
    });

    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const rawResponse = await this.llm.generateJSON<{ 
        groups: Array<{
          groupId: string;
          messages: Array<{
            actorId: string;
            message: string;
          }>;
        }> 
      } | {
        response: {
          groups: Array<{
            groupId: string;
            messages: Array<{
              actorId: string;
              message: string;
            }>;
          }> 
        }
      }>(
        prompt,
        { required: ['groups'] },
        { temperature: 1.0, maxTokens: 5000 }
      );

      // Handle XML structure
      const response = 'response' in rawResponse && rawResponse.response
        ? rawResponse.response
        : rawResponse as { groups: Array<{ groupId: string; messages: Array<{ actorId: string; message: string }> }> };

      const groups = response.groups || [];
      if (groups.length === groupRequests.length && groups.every(g => g.messages && g.messages.length > 0)) {
        // Convert to expected format
        groups.forEach((group, i) => {
          const req = groupRequests[i];
          if (!req) return; // Skip if no matching request

          messages[group.groupId] = group.messages.map((msg, j) => ({
            from: msg.actorId,
            message: msg.message,
            timestamp: `2025-10-${String(day).padStart(2, '0')}T${String(10 + j * 2).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`,
            clueStrength: req.members.find(m => m.actorId === msg.actorId)?.role === 'main' ? 0.7 : 0.4,
          }));
        });
        
        return messages;
      }

      logger.warn(`Invalid group messages batch for day ${day} (attempt ${attempt + 1}/${maxRetries}). Expected ${groupRequests.length}, got ${groups.length}`, undefined, 'GameGenerator');
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error(`Failed to generate group messages batch for day ${day} after ${maxRetries} attempts`);
  }

  /**
   * DEPRECATED: Old individual message generation - kept for reference
   * Use generateDayGroupMessagesBatch instead
   */
  private async generateGroupMessages(
    day: number,
    events: WorldEvent[],
    groupChats: GroupChat[],
    allActors: SelectedActor[]
  ): Promise<Record<string, ChatMessage[]>> {
    return this.generateDayGroupMessagesBatch(
      day, 
      events, 
      groupChats, 
      allActors, 
      [], 
      new Map(), 
      [], 
      [], 
      [], 
      ''
    );
  }

  /**
   * Get group activity chance based on day
   */
  private getGroupActivityChance(day: number): number {
    if (day <= 10) return 0.3; // Quiet early
    if (day <= 20) return 0.5; // Moderate mid-game
    if (day <= 25) return 0.7; // Active late game
    return 0.9; // Very active near end
  }

  /**
   * Generate group message content using LLM
   * Private insider information shared in groups
   */
  public async generateGroupMessage(
    actor: SelectedActor,
    events: WorldEvent[],
    day: number,
    groupTheme: string
  ): Promise<string> {
    const recentEvent = events[Math.floor(Math.random() * events.length)];
    const eventContext = recentEvent ? `Recent event: ${recentEvent.description}` : `It's Day ${day} of 30`;
    const informationHint = day < 15 ? 'Drop vague hints' : 'Share more concrete information';

    const prompt = renderPrompt(groupMessage, {
      actorName: actor.name,
      actorDescription: actor.description || '',
      personality: actor.personality || 'balanced',
      domain: actor.domain?.join(', ') || 'general',
      groupTheme,
      eventContext,
      informationHint
    });

    const rawResponse = await this.llm.generateJSON<{ message: string } | { response: { message: string } }>(
      prompt,
      undefined,
      { temperature: 1.0 }
    );

    // Handle XML structure
    const response = 'response' in rawResponse && rawResponse.response
      ? rawResponse.response
      : rawResponse as { message: string };

    return response.message || `Day ${day}: Interesting developments...`;
  }

  /**
   * Generate luck changes for the day
   */
  private generateLuckChanges(
    day: number,
    events: WorldEvent[],
    actors: SelectedActor[],
    luckMood: Map<string, { luck: string; mood: number }>
  ): LuckChange[] {
    const changes: LuckChange[] = [];
    
    // Create a Set of valid actor IDs for efficient lookup
    const validActorIds = new Set(actors.map(a => a.id));
    
    // Actors involved in events may have luck changes
    events.forEach(event => {
      event.actors.forEach(actorId => {
        // Validate that actor exists in selected actors list
        if (!validActorIds.has(actorId)) {
          return; // Skip actors not in the game
        }
        
        if (Math.random() > 0.7) { // 30% chance
          const current = luckMood.get(actorId);
          if (current) {
            const luckLevels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
            const currentIdx = luckLevels.indexOf(current.luck as 'low' | 'medium' | 'high');
            
            // Determine direction based on event type and outcome
            let change: number;
            const isPositiveEvent = event.type === 'deal' || event.type === 'announcement' || event.pointsToward === 'YES';
            const isNegativeEvent = event.type === 'scandal' || event.type === 'conflict' || event.pointsToward === 'NO';
            
            if (isPositiveEvent) {
              // 70% chance to increase luck, 30% to decrease
              change = Math.random() > 0.3 ? 1 : -1;
            } else if (isNegativeEvent) {
              // 70% chance to decrease luck, 30% to increase
              change = Math.random() > 0.3 ? -1 : 1;
            } else {
              // Neutral: 50/50
              change = Math.random() > 0.5 ? 1 : -1;
            }
            
            const newIdx = Math.max(0, Math.min(2, currentIdx + change));
            const newLuck = luckLevels[newIdx] as 'low' | 'medium' | 'high';
            
            if (newLuck !== current.luck) {
              changes.push({
                actor: actorId,
                from: current.luck,
                to: newLuck,
                reason: `Day ${day}: ${event.description}`,
              });
              current.luck = newLuck;
            }
          }
        }
      });
    });

    return changes;
  }

  /**
   * Generate mood changes for the day
   */
  private generateMoodChanges(
    day: number,
    events: WorldEvent[],
    actors: SelectedActor[],
    luckMood: Map<string, { luck: string; mood: number }>
  ): MoodChange[] {
    const changes: MoodChange[] = [];
    
    // Create a Set of valid actor IDs for efficient lookup
    const validActorIds = new Set(actors.map(a => a.id));
    
    // Actors involved in events may have mood changes
    events.forEach(event => {
      event.actors.forEach(actorId => {
        // Validate that actor exists in selected actors list
        if (!validActorIds.has(actorId)) {
          return; // Skip actors not in the game
        }
        
        if (Math.random() > 0.6) { // 40% chance
          const current = luckMood.get(actorId);
          if (current) {
            // Determine direction and magnitude based on event type and outcome
            let moodChange: number;
            const isPositiveEvent = event.type === 'deal' || event.type === 'announcement' || event.pointsToward === 'YES';
            const isNegativeEvent = event.type === 'scandal' || event.type === 'conflict' || event.pointsToward === 'NO';
            
            if (isPositiveEvent) {
              // Positive events: bias toward positive mood change (0 to +0.3)
              moodChange = Math.random() * 0.3;
            } else if (isNegativeEvent) {
              // Negative events: bias toward negative mood change (-0.3 to 0)
              moodChange = Math.random() * -0.3;
            } else {
              // Neutral events: balanced change (-0.2 to +0.2)
              moodChange = (Math.random() - 0.5) * 0.4;
            }
            
            const newMood = Math.max(-1, Math.min(1, current.mood + moodChange));
            
            if (Math.abs(newMood - current.mood) > 0.05) {
              changes.push({
                actor: actorId,
                from: current.mood,
                to: newMood,
                reason: `Day ${day}: ${event.description}`,
              });
              current.mood = newMood;
            }
          }
        }
      });
    });

    return changes;
  }

  /**
   * Apply ambient mood drift to all actors
   * Small random mood changes each day to simulate natural emotional variation
   * Ensures all actors (not just those in events) have evolving emotional states
   */
  private applyAmbientMoodDrift(
    actors: SelectedActor[],
    luckMood: Map<string, { luck: string; mood: number }>
  ): void {
    actors.forEach(actor => {
      const current = luckMood.get(actor.id);
      if (current) {
        // 60% chance of mood drift each day
        if (Math.random() > 0.4) {
          // Small drift: -0.1 to +0.1 (bidirectional, perfectly balanced)
          // 5% chance of larger mood swing for variety
          const isLargeSwing = Math.random() > 0.95;
          const range = isLargeSwing ? 0.4 : 0.2; // Large: ±0.2, Normal: ±0.1
          const drift = (Math.random() - 0.5) * range;
          const newMood = Math.max(-1, Math.min(1, current.mood + drift));
          current.mood = newMood;
        }
        
        // 15% chance of luck changing (up or down equally)
        if (Math.random() > 0.85) {
          const luckLevels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
          const currentIdx = luckLevels.indexOf(current.luck as 'low' | 'medium' | 'high');
          // 50/50 chance to go up or down
          const change = Math.random() > 0.5 ? 1 : -1;
          const newIdx = Math.max(0, Math.min(2, currentIdx + change));
          // Type assertion safe because newIdx is clamped to [0, 2]
          current.luck = luckLevels[newIdx] as 'low' | 'medium' | 'high';
        }
      }
    });
  }

  /**
   * Generate final resolution
   */
  private generateResolution(
    questions: Question[],
    timeline: DayTimeline[]
  ): GameResolution {
    const outcomes = questions.map(q => {
      // Find key events that pointed to this outcome
      const relevantEvents = timeline
        .flatMap(day => day.events)
        .filter(e => e.relatedQuestion === q.id && e.pointsToward === (q.outcome ? 'YES' : 'NO'))
        .slice(0, 3);

      return {
        questionId: q.id,
        answer: q.outcome,
        explanation: `Throughout the 30 days, events aligned toward ${q.outcome ? 'YES' : 'NO'}. ${relevantEvents.length} key events confirmed this outcome.`,
        keyEvents: relevantEvents.map(e => e.description),
      };
    });

    return {
      day: 30,
      outcomes,
      finalNarrative: `All ${questions.length} questions have been resolved. The 30-day narrative concludes with clear outcomes based on the events that unfolded.`,
    };
  }

  private getPhase(day: number): string {
    if (day <= 10) return 'Early';
    if (day <= 20) return 'Middle';
    if (day <= 25) return 'Late';
    if (day < 30) return 'Climax';
    return 'Resolution';
  }

  private getEventCount(day: number): number {
    // Match GDD requirements
    if (day <= 10) return 3 + Math.floor(Math.random() * 3); // 3-5 events (WILD PHASE)
    if (day <= 20) return 5 + Math.floor(Math.random() * 3); // 5-7 events (CONNECTION PHASE)
    if (day <= 25) return 7 + Math.floor(Math.random() * 4); // 7-10 events (CONVERGENCE)
    if (day < 30) return 10 + Math.floor(Math.random() * 6); // 10-15 events (CLIMAX)
    return 5; // Day 30 resolution (5 final events)
  }
}

