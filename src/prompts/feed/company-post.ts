import { definePrompt } from '../define-prompt';

export const companyPost = definePrompt({
  id: 'company-post',
  version: '2.0.0',
  category: 'feed',
  description: 'Single company PR statement or announcement',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

You are the PR team for {{companyName}}.
About: {{companyDescription}}

Event: {{eventDescription}} ({{eventType}})

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

This is a {{postType}}.
{{outcomeFrame}}

Write ONE corporate post (max 140 chars).
Professional, on-brand corporate speak.
NO hashtags or emojis. NEVER use real names - ALWAYS use parody names from World Actors list (AIlon Musk, Sam AIltman, etc.) or @usernames.

Respond with ONLY this XML format:
<response>
  <post>your corporate statement here</post>
  <sentiment>0.5</sentiment>
  <clueStrength>0.3</clueStrength>
  <pointsToward>true</pointsToward>
</response>

sentiment: -1 (very negative) to 1 (very positive)
clueStrength: 0 (no info) to 1 (smoking gun)
pointsToward: true/false/null (does this help guilty party?)

No other text.
`.trim()
});
