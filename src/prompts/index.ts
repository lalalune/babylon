/**
 * Prompt Registry
 * 
 * Central export for all prompt definitions.
 * Import prompts directly for type safety and tree-shaking.
 */

// Re-export utilities
export { definePrompt, renderTemplate } from './define-prompt';
export { renderPrompt, getPromptParams } from './loader';
export type { PromptDefinition } from './define-prompt';

// Prompts by category
// Feed prompts
export { governmentPosts } from './feed/government-posts';
export { ambientInstruction } from './feed/ambient-instruction';
export { companyPost } from './feed/company-post';
export { reactionInstruction } from './feed/reaction-instruction';
export { governmentInstruction } from './feed/government-instruction';
export { newsPosts } from './feed/news-posts';
export { conspiracyPost } from './feed/conspiracy-post';
export { analystReaction } from './feed/analyst-reaction';
export { companyInstruction } from './feed/company-instruction';
export { governmentPost } from './feed/government-post';
export { expertCommentary } from './feed/expert-commentary';
export { ambientPost } from './feed/ambient-post';
export { mediaPost } from './feed/media-post';
export { reply } from './feed/reply';
export { ambientPosts } from './feed/ambient-posts';
export { stockTicker } from './feed/stock-ticker';
export { minuteAmbient } from './feed/minute-ambient';
export { replies } from './feed/replies';
export { directReaction } from './feed/direct-reaction';
export { journalistPost } from './feed/journalist-post';
export { conspiracy } from './feed/conspiracy';
export { journalistInstruction } from './feed/journalist-instruction';
export { reactions } from './feed/reactions';
export { companyPosts } from './feed/company-posts';
export { journalistPosts } from './feed/journalist-posts';
export { commentary } from './feed/commentary';

// Game prompts
export { dayTransition } from './game/day-transition';
export { groupMessages } from './game/group-messages';
export { resolutionEvent } from './game/resolution-event';
export { phaseContext } from './game/phase-context';
export { questionRankings } from './game/question-rankings';
export { baselineEvent } from './game/baseline-event';
export { questionResolutionValidation } from './game/question-resolution-validation';
export { eventDescriptions } from './game/event-descriptions';
export { questionResolvedFeed } from './game/question-resolved-feed';
export { scenarios } from './game/scenarios';
export { groupChatName } from './game/group-chat-name';
export { dayEvents } from './game/day-events';
export { questions } from './game/questions';
export { groupMessage } from './game/group-message';
export { priceAnnouncement } from './game/price-announcement';
export { priceImpact } from './game/price-impact';
export { groupChatNames } from './game/group-chat-names';
export { questionGeneration } from './game/question-generation';

// Image prompts
export { actorPortrait, actorBanner } from './image/actor-portrait';
export { userProfileBanner } from './image/user-profile-banner';
export { organizationLogo, organizationBanner } from './image/organization-logo';
export { userProfilePicture } from './image/user-profile-picture';

// System prompts
export { jsonAssistant } from './system/json-assistant';

// World prompts
export { rumor } from './world/rumor';
export { expertAnalysis } from './world/expert-analysis';
export { npcConversation } from './world/npc-conversation';
export { daySummary } from './world/day-summary';
export { newsReport } from './world/news-report';

// Trading prompts
export { npcMarketDecisions } from './trading/npc-market-decisions';

/**
 * Usage examples:
 * 
 * import { ambientPost, renderPrompt } from '@/prompts';
 * 
 * const prompt = renderPrompt(ambientPost, {
 *   actorName: 'Alice',
 *   actorDescription: 'Tech CEO'
 * });
 * 
 * const params = getPromptParams(ambientPost);
 * // { temperature: 0.9, maxTokens: 5000 }
 */
