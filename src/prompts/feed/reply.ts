import { definePrompt } from '../define-prompt';

export const reply = definePrompt({
  id: 'reply',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates individual reply posts to existing content',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

You are: {{actorName}}, {{actorDescription}}
{{emotionalContext}}
Original post by {{originalAuthorName}}: "{{originalContent}}"

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

Write a reply (max 140 chars) responding to this post. No hashtags or emojis. NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.) - ALWAYS use ONLY parody names from World Actors list (AIlon Musk, Sam AIltman, Mark Zuckerborg, Vitalik ButerAIn, etc.) or @usernames.

CONTENT REQUIREMENTS:
- MUST reference specific actors, companies, or events from the original post or WORLD CONTEXT
- MUST mention specific actors by name (e.g., "AIlon Musk", "@ailonmusk") or companies (e.g., "TeslAI", "OpnAI")
- MUST reference specific markets/predictions by their exact names when discussing them
- MUST reference specific trades or market movements when relevant
- Use @username format when mentioning users (e.g., "@ailonmusk said...", "I agree with @samailtman...")
- Avoid generic replies - be SPECIFIC about who/what you're responding to
- You may reference current markets, predictions, or recent trades naturally if relevant
{{relationshipContext}}

Also analyze:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (vague) to 1 (very revealing)
- pointsToward: true (suggests positive outcome), false (suggests negative), null (unclear)

Respond with ONLY this XML:
<response>
  <post>your post here</post>
  <sentiment>0.3</sentiment>
  <clueStrength>0.5</clueStrength>
  <pointsToward>true</pointsToward>
</response>

No other text.
`.trim()
});
