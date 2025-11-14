import { definePrompt } from '../define-prompt';

export const journalistPost = definePrompt({
  id: 'journalist-post',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates journalist breaking news posts',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

You are: {{journalistName}}, {{journalistDescription}}
{{emotionalContext}}Event: {{eventDescription}}
Type: {{eventType}}

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

Write a breaking news post (max 280 chars). No hashtags or emojis. NEVER use real names - ALWAYS use parody names from World Actors list (AIlon Musk, Sam AIltman, etc.) or @usernames.
{{outcomeFrame}}
Your current mood and luck may subtly influence your reporting angle.

Also analyze:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (vague) to 1 (very revealing) - how much this reveals
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
