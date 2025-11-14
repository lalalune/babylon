/**
 * Shared Utility Functions for Babylon Game
 *
 * Consolidated utility functions to eliminate duplication across codebase
 */

import type { Actor, ActorRelationship, Organization } from './types';

/**
 * Shuffle array using Fisher-Yates algorithm
 * Provides cryptographically secure randomization
 *
 * @param array - Array to shuffle
 * @returns New shuffled array (original untouched)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Use temp variable to satisfy TypeScript strict mode
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

/**
 * Format actor voice context with postStyle and randomized postExample
 * Used for LLM prompt generation to maintain actor voice consistency
 *
 * @param actor - Actor with optional postStyle and postExample
 * @returns Formatted context string for LLM prompts
 */
export function formatActorVoiceContext(actor: {
  postStyle?: string;
  postExample?: string[];
}): string {
  if (!actor.postStyle && !actor.postExample) {
    return '';
  }

  let context = '';

  if (actor.postStyle) {
    context += `\n   Writing Style: ${actor.postStyle}`;
  }

  if (actor.postExample && actor.postExample.length > 0) {
    const shuffledExamples = shuffleArray(actor.postExample);
    const examples = shuffledExamples
      .slice(0, 3)
      .map((ex) => `"${ex}"`)
      .join(', ');
    context += `\n   Example Posts: ${examples}`;
  }

  return context;
}

/**
 * Generate unique ID with timestamp and random component
 *
 * @param prefix - Optional prefix for the ID (e.g., 'post', 'event', 'actor')
 * @returns Unique ID string
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Clamp number between min and max values
 *
 * @param value - Number to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate sentiment score from text (simple heuristic)
 * Returns value between -1 (negative) and 1 (positive)
 *
 * @param text - Text to analyze
 * @returns Sentiment score between -1 and 1
 */
export function calculateSentiment(text: string): number {
  const positive = /\b(great|amazing|success|win|best|love|excellent|awesome)\b/gi;
  const negative = /\b(terrible|awful|fail|worst|hate|disaster|crisis|scandal)\b/gi;

  const positiveCount = (text.match(positive) || []).length;
  const negativeCount = (text.match(negative) || []).length;

  const total = positiveCount + negativeCount;
  if (total === 0) return 0;

  return clamp((positiveCount - negativeCount) / total, -1, 1);
}

/**
 * Format timestamp to readable date string
 *
 * @param timestamp - ISO timestamp string
 * @returns Formatted date string (e.g., "Jan 1, 2025")
 */
export function formatDate(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format timestamp to readable time string
 *
 * @param timestamp - ISO timestamp string
 * @returns Formatted time string (e.g., "3:45 PM")
 */
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Pick random element from array
 *
 * @param array - Array to pick from
 * @returns Random element from array
 */
export function pickRandom<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined;
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Pick N random elements from array (without replacement)
 *
 * @param array - Array to pick from
 * @param count - Number of elements to pick
 * @returns Array of random elements
 */
export function pickRandomN<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
}

/**
 * Build phase-specific narrative context for LLM prompts
 * Provides instructions on how content should reflect the current game phase
 *
 * @param day - Current game day (1-30)
 * @returns Phase-specific narrative instructions
 */
export function buildPhaseContext(day: number): string {
  if (day <= 10) {
    return `Phase: WILD (Days 1-10)
- Generate mysterious, disconnected events
- Drop vague hints and rumors
- Create speculation and uncertainty
- Events feel random and chaotic
- Minimal concrete information`;
  } else if (day <= 20) {
    return `Phase: CONNECTION (Days 11-20)
- Begin connecting previous events
- Reveal relationships between actors
- Provide more concrete information
- Story threads start emerging
- Patterns become visible`;
  } else if (day <= 25) {
    return `Phase: CONVERGENCE (Days 21-25)
- Major storyline convergence
- Big revelations about questions
- Clear narrative threads
- Dramatic developments
- Truth starts emerging`;
  } else if (day <= 29) {
    return `Phase: CLIMAX (Days 26-29)
- Maximum drama and uncertainty
- Conflicting final clues
- Rapid developments
- High stakes moments
- Resolution seems imminent`;
  } else {
    return `Phase: RESOLUTION (Day 30)
- Definitive outcomes
- All questions resolved
- Epilogue content
- Narrative closure`;
  }
}

/**
 * Build relationship context for actors in LLM prompts
 * Formats actor relationships and connections for narrative generation
 *
 * @param actors - List of actors involved
 * @param relationships - Relationship data between actors
 * @returns Formatted relationship context string
 */
export function buildRelationshipContext(
  actors: Actor[],
  relationships: ActorRelationship[]
): string {
  if (!relationships || relationships.length === 0) {
    return '';
  }

  const actorIds = new Set(actors.map(a => a.id));
  const relevantRelationships = relationships.filter(
    r => actorIds.has(r.actor1Id) && actorIds.has(r.actor2Id)
  );

  if (relevantRelationships.length === 0) {
    return '';
  }

  const actorMap = new Map(actors.map(a => [a.id, a.name]));
  const relationshipLines = relevantRelationships
    .slice(0, 10)
    .map(r => {
      const name1 = actorMap.get(r.actor1Id) || r.actor1Id;
      const name2 = actorMap.get(r.actor2Id) || r.actor2Id;
      const sentimentDesc = r.sentiment > 0.5 ? 'respect' : r.sentiment < -0.5 ? 'beef' : 'neutral';
      return `- ${name1} & ${name2}: ${r.relationshipType} (${sentimentDesc})${r.history ? ` - ${r.history}` : ''}`;
    })
    .join('\n');

  return `\nKnown Relationships:\n${relationshipLines}`;
}

/**
 * Convert question ID to number safely
 * Handles both string and number IDs, converting strings to numbers when possible
 *
 * @param questionId - Question ID (can be string or number)
 * @returns Number ID, or 0 if conversion fails
 */
export function toQuestionIdNumber(questionId: string | number): number {
  if (typeof questionId === 'number') {
    return questionId;
  }
  const parsed = parseInt(String(questionId), 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Convert question ID to number or null
 * Returns null if conversion fails or if questionId is null/undefined
 *
 * @param questionId - Question ID (can be string, number, null, or undefined)
 * @returns Number ID, or null if conversion fails or input is null/undefined
 */
export function toQuestionIdNumberOrNull(questionId: string | number | null | undefined): number | null {
  if (questionId === null || questionId === undefined) {
    return null;
  }
  if (typeof questionId === 'number') {
    return questionId;
  }
  const parsed = parseInt(String(questionId), 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Build organization behavior context for LLM prompts
 * Provides guidance on how different organization types should behave
 *
 * @param organizations - List of organizations involved
 * @returns Formatted organization behavior instructions
 */
export function buildOrganizationBehaviorContext(organizations: Organization[]): string {
  if (!organizations || organizations.length === 0) {
    return '';
  }

  const orgsByType = {
    media: organizations.filter(o => o.type === 'media'),
    company: organizations.filter(o => o.type === 'company'),
    government: organizations.filter(o => o.type === 'government'),
  };

  const contextParts: string[] = [];

  if (orgsByType.media.length > 0) {
    contextParts.push(
      `Media Organizations (${orgsByType.media.map(o => o.name).join(', ')}):
- Break stories first, prioritize speed and exclusivity
- Cite sources when available, use "sources say" for leaks
- Maintain journalistic tone, factual but engaging
- Compete for attention and credibility`
    );
  }

  if (orgsByType.company.length > 0) {
    contextParts.push(
      `Companies (${orgsByType.company.map(o => o.name).join(', ')}):
- Issue official statements, press releases
- Protect reputation and manage PR
- Announce developments strategically
- Respond to criticism and controversy`
    );
  }

  if (orgsByType.government.length > 0) {
    contextParts.push(
      `Government Entities (${orgsByType.government.map(o => o.name).join(', ')}):
- Formal, official communications
- Regulatory announcements and investigations
- Policy statements and enforcement actions
- Balance transparency with discretion`
    );
  }

  return contextParts.length > 0
    ? `\nOrganization Behavior Guidelines:\n${contextParts.join('\n\n')}`
    : '';
}
