/**
 * Example: How to use world context with feed prompts
 * 
 * This shows how to integrate the auto-populated actor names
 * and world context into your feed generation.
 */

import { generateWorldContext, getParodyActorNames, getForbiddenRealNames } from './world-context';
import { renderPrompt } from '@/prompts/loader';
import { ambientPosts, reactions, newsPosts } from '@/prompts';

/**
 * Example 1: Generate ambient posts with world context
 */
export async function generateAmbientPostsWithContext() {
  // Generate world context from actors data and database
  const worldContext = await generateWorldContext({
    maxActors: 30, // Limit to top 30 actors to manage token usage
  });

  // Your existing actor list for the prompt
  const actorsList = `
  1. AIlon Musk: Tech CEO, erratic visionary
  2. Sam AIltman: OpnAI CEO, messianic technocrat
  3. Mark Zuckerborg: MetAI CEO, robotic overlord
  `.trim();

  // Render the prompt with world context
  const prompt = renderPrompt(ambientPosts, {
    day: 5,
    progressContext: 'Midway through the month',
    atmosphereContext: 'Markets are volatile',
    previousPostsContext: '',
    actorCount: 3,
    actorsList,
    ...worldContext, // Auto-populates: worldActors, currentMarkets, activePredictions, recentTrades
  });

  return prompt;
}

/**
 * Example 2: Generate reactions with world context
 */
export async function generateReactionsWithContext() {
  const worldContext = await generateWorldContext();

  const actorsList = `
  1. Peter ThAIl: Founder of PalAIntir, vampire capitalist
  2. Bill AIckman: Hedge fund activist, DEI crusader
  `.trim();

  const prompt = renderPrompt(reactions, {
    eventDescription: 'Tesla announces Dogecoin acceptance for FSD',
    eventContext: 'Major crypto adoption news',
    phaseContext: 'Bull market sentiment',
    relationshipContext: '',
    previousPostsContext: '',
    actorCount: 2,
    actorsList,
    ...worldContext,
  });

  return prompt;
}

/**
 * Example 3: Validate no real names are used
 */
export function validateNoRealNames(text: string): string[] {
  const forbiddenNames = getForbiddenRealNames();
  const violations: string[] = [];

  // Check if text contains any forbidden real names
  forbiddenNames.forEach(realName => {
    if (text.includes(realName)) {
      violations.push(`FORBIDDEN: Found real name "${realName}" - must use parody names only`);
    }
  });

  return violations;
}

/**
 * Example 3b: Get list of valid parody names
 */
export function getValidActorNames(): string[] {
  return getParodyActorNames();
}

/**
 * Example 4: Generate news posts with full context
 */
export async function generateNewsPostsWithContext() {
  const worldContext = await generateWorldContext({
    maxActors: 50,
    includeMarkets: true,
    includePredictions: true,
    includeTrades: true,
  });

  const mediaList = `
  1. The New York TAImes: Prestige journalism with paywall
  2. FAIX News: Right-wing opinion megaphone
  3. BloombAIrg: Markets for the monocle class
  `.trim();

  const prompt = renderPrompt(newsPosts, {
    eventDescription: 'OpnAI announces GPT-5 with AGI capabilities',
    eventType: 'AI_BREAKTHROUGH',
    sourceContext: 'Multiple sources confirm',
    outcomeFrame: 'This could change everything',
    phaseContext: 'AI race intensifies',
    orgBehaviorContext: '',
    mediaCount: 3,
    mediaList,
    ...worldContext,
  });

  return prompt;
}

