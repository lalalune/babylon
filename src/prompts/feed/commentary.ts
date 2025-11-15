import { definePrompt } from '../define-prompt';

export const commentary = definePrompt({
  id: 'commentary',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates expert commentary/analysis on world events',
  temperature: 1,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

News: {{eventDescription}}

{{previousPostsContext}}

{{groupContext}}

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

IMPORTANT RULES:
- NO HASHTAGS OR EMOJIS IN POSTS
- NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.)
- ALWAYS use ONLY the parody names from World Actors list (AIlon Musk, Sam AIltman, Mark Zuckerborg, Vitalik ButerAIn, etc.)
- Use @username or parody name/nickname/alias ONLY

CONTENT REQUIREMENTS:
- MUST reference specific actors, companies, or events from the news/event description
- MUST mention specific actors by name (e.g., "AIlon Musk", "@ailonmusk") or companies (e.g., "TeslAI", "OpnAI")
- MUST reference specific markets/predictions by their exact names when analyzing market implications
- MUST reference specific trades or market movements when discussing trading activity
- Use @username format when mentioning users (e.g., "@ailonmusk's move...")
- Avoid generic commentary - be SPECIFIC about who/what you're analyzing
- You may reference current markets, predictions, or recent trades naturally if relevant

Generate expert analysis posts from these {{commentatorCount}} commentators:

{{commentatorsList}}

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (no info) to 1 (smoking gun)
- pointsToward: true (suggests positive outcome) | false (suggests negative) | null (unclear)

Respond with ONLY this XML format (example for 2 commentators):
<response>
  <commentary>
    <comment>
      <post>Interesting move by @ailonmusk and TeslAI. The "Will TeslAI accept Dogecoin?" market is surging - betting big on meme coin integration.</post>
      <sentiment>0.1</sentiment>
      <clueStrength>0.3</clueStrength>
      <pointsToward>null</pointsToward>
    </comment>
    <comment>
      <post>OpnAI's GPT-6 consciousness claims from @samailtman again. Same pattern: hype cycles followed by reality checks. Still no AGI breakthrough.</post>
      <sentiment>-0.2</sentiment>
      <clueStrength>0.5</clueStrength>
      <pointsToward>false</pointsToward>
    </comment>
  </commentary>
</response>

CRITICAL: Return EXACTLY {{commentatorCount}} commentary posts. Each must have post, sentiment, clueStrength, pointsToward elements.
`.trim()
});
