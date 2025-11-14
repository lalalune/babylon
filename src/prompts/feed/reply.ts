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

Write a reply (max 140 chars) responding to this post. No hashtags or emojis. NEVER use real names - ALWAYS use parody names from World Actors list (AIlon Musk, Sam AIltman, etc.) or @usernames.
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
