/**
 * Babylon Question Manager
 * 
 * Manages the lifecycle of prediction market questions:
 * - Creates new questions daily (1-3 per day)
 * - Tracks active questions (max 20)
 * - Resolves questions when resolutionDate is reached (24h-7d from creation)
 * - Ensures events are relevant to active questions
 * 
 * Question lifecycle:
 * 1. Created with resolutionDate between 24h-7d in the future
 * 2. Status: 'active' - appears in markets, events generated around it
 * 3. Status: 'resolved' - outcome determined, no longer tradable
 * 4. Status: 'cancelled' - removed without resolution (rare)
 */

import type { Question, Scenario, SelectedActor, Organization, DayTimeline } from '@/shared/types';
import type { BabylonLLMClient } from '../generator/llm/openai-client';
import { questionGeneration, questionResolutionValidation, renderPrompt } from '@/prompts';
import { logger } from '@/lib/logger';

export interface QuestionCreationParams {
  currentDate: string; // ISO date
  scenarios: Scenario[];
  actors: SelectedActor[];
  organizations: Organization[];
  activeQuestions: Question[]; // Current active questions
  recentEvents: DayTimeline[]; // Recent game history
  nextQuestionId: number; // Next available question ID
}

export class QuestionManager {
  private llm: BabylonLLMClient;

  constructor(llm: BabylonLLMClient) {
    this.llm = llm;
  }

  /**
   * Generate new questions for the day (1-3 questions)
   * Returns questions with status='active', resolutionDate set between 24h-7d
   */
  async generateDailyQuestions(params: QuestionCreationParams): Promise<Question[]> {
    const {
      currentDate,
      scenarios,
      actors,
      organizations,
      activeQuestions,
      recentEvents,
      nextQuestionId,
    } = params;

    // Don't generate if we're at max capacity (20 questions)
    if (activeQuestions.length >= 20) {
      logger.warn('Max 20 questions reached, skipping generation', undefined, 'QuestionManager');
      return [];
    }

    // Generate 1-3 new questions
    const numToGenerate = Math.min(
      Math.floor(Math.random() * 3) + 1, // 1-3 questions
      20 - activeQuestions.length // Don't exceed max
    );

    const currentDateObj = new Date(currentDate);

    // Build context from recent events
    const recentContext = recentEvents.length > 0
      ? `\n\nRECENT EVENTS (Last ${recentEvents.length} days):\n${recentEvents
          .slice(-5)
          .map(day => `Day ${day.day}: ${day.events.map(e => e.description).join('; ')}`)
          .join('\n')}`
      : '';

    // Build context from active questions
    const activeQuestionsContext = activeQuestions.length > 0
      ? `\n\nCURRENT ACTIVE QUESTIONS (${activeQuestions.length}/20):\n${activeQuestions
          .map(q => `- ${q.text} (resolves ${q.resolutionDate})`)
          .join('\n')}`
      : '\n\nNo active questions yet.';

    const prompt = this.buildQuestionGenerationPrompt(
      scenarios,
      actors,
      organizations,
      recentContext,
      activeQuestionsContext,
      numToGenerate
    );

    const response = await this.llm.generateJSON<{
      questions: Array<{
        text: string;
        scenario: number;
        daysUntilResolution: number; // 1-7 days
        expectedOutcome: boolean;
      }>;
    }>(prompt, undefined, {
      temperature: 0.9,
      maxTokens: 8000,
    });

    if (!response.questions || response.questions.length === 0) {
      logger.warn('LLM returned no questions', undefined, 'QuestionManager');
      return [];
    }

    // Convert to Question objects with dates and IDs
    const questions: Question[] = response.questions.slice(0, numToGenerate).map((q, index) => {
      const resolutionDate = new Date(currentDateObj);
      resolutionDate.setDate(
        resolutionDate.getDate() + Math.max(1, Math.min(7, q.daysUntilResolution || 3))
      );

      return {
        id: nextQuestionId + index,
        text: q.text,
        scenario: q.scenario || 1,
        outcome: q.expectedOutcome,
        rank: 1,
        createdDate: currentDate,
        resolutionDate: resolutionDate.toISOString().split('T')[0]!,
        status: 'active',
      };
    });

    return questions;
  }

  /**
   * Build LLM prompt for question generation
   */
  private buildQuestionGenerationPrompt(
    scenarios: Scenario[],
    actors: SelectedActor[],
    organizations: Organization[],
    recentContext: string,
    activeQuestionsContext: string,
    numToGenerate: number
  ): string {
    const scenariosList = scenarios
      .map(
        s => `
Scenario ${s.id}: ${s.title}
${s.description}
Actors: ${s.mainActors.join(', ')}
${s.involvedOrganizations?.length ? `Organizations: ${s.involvedOrganizations.join(', ')}` : ''}
`
      )
      .join('\n');

    const actorsList = actors
      .filter(a => a.role === 'main' || a.role === 'supporting')
      .slice(0, 20)
      .map(a => `- ${a.name}: ${a.description}`)
      .join('\n');

    const orgsList = organizations
      .filter(o => o.type === 'company')
      .slice(0, 15)
      .map(o => `- ${o.name}: ${o.description}`)
      .join('\n');

    return renderPrompt(questionGeneration, {
      scenariosList,
      actorsList,
      orgsList,
      recentContext,
      activeQuestionsContext,
      numToGenerate: numToGenerate.toString()
    });
  }

  /**
   * Check for questions that should be resolved today
   * Returns questions where resolutionDate <= currentDate
   */
  getQuestionsToResolve(activeQuestions: Question[], currentDate: string): Question[] {
    const currentDateObj = new Date(currentDate);

    return activeQuestions.filter(q => {
      if (!q.resolutionDate) return false;
      const resolutionDateObj = new Date(q.resolutionDate);
      return resolutionDateObj <= currentDateObj;
    });
  }

  /**
   * Resolve a question - mark as resolved and set final outcome
   */
  resolveQuestion(question: Question, outcome: boolean): Question {
    return {
      ...question,
      status: 'resolved',
      resolvedOutcome: outcome,
    };
  }

  /**
   * Generate resolution events for questions being resolved today
   * These are dramatic events that definitively prove the outcome
   */
  async generateResolutionEvent(
    question: Question,
    _actors: SelectedActor[],
    _organizations: Organization[],
    recentEvents: DayTimeline[]
  ): Promise<string> {
    // Get context from recent events related to this question
    const relatedEvents = recentEvents
      .flatMap(day => day.events)
      .filter(e => e.relatedQuestion === question.id)
      .slice(-3);

    const eventHistory =
      relatedEvents.length > 0
        ? `Recent events: ${relatedEvents.map(e => e.description).join('; ')}`
        : 'No prior events';

    const outcomeContext = question.outcome 
      ? 'PROVES it happened/succeeded' 
      : 'PROVES it failed/was cancelled/did not happen';

    const prompt = renderPrompt(questionResolutionValidation, {
      questionText: question.text,
      outcome: question.outcome ? 'YES' : 'NO',
      eventHistory,
      contextInfo: '',
      outcomeContext
    });

    const response = await this.llm.generateJSON<{ event: string; type: string }>(
      prompt,
      undefined,
      { temperature: 0.7, maxTokens: 5000 }
    );

    return response.event || `Resolution: ${question.text} outcome is ${question.outcome ? 'YES' : 'NO'}`;
  }

  /**
   * Get all active questions
   */
  getActiveQuestions(questions: Question[]): Question[] {
    return questions.filter(q => q.status === 'active');
  }

  /**
   * Get all resolved questions
   */
  getResolvedQuestions(questions: Question[]): Question[] {
    return questions.filter(q => q.status === 'resolved');
  }

  /**
   * Calculate how many days until a question resolves
   */
  getDaysUntilResolution(question: Question, currentDate: string): number {
    if (!question.resolutionDate) return 999;

    const current = new Date(currentDate);
    const resolution = new Date(question.resolutionDate);
    const diffTime = resolution.getTime() - current.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  }
}


