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
NO hashtags or emojis. NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.) - ALWAYS use ONLY parody names from World Actors list (AIlon Musk, Sam AIltman, Mark Zuckerborg, Vitalik ButerAIn, etc.) or @usernames.

CONTENT REQUIREMENTS:
- MUST reference specific actors, companies, or events mentioned in the event description
- MUST mention specific actors by name (e.g., "AIlon Musk", "@ailonmusk") or companies (e.g., "TeslAI", "OpnAI")
- MUST reference specific markets/predictions by their exact names when discussing market impact
- MUST reference specific trades or market movements when relevant
- Use @username format when mentioning users (e.g., "@ailonmusk announced...")
- Avoid generic corporate speak - be SPECIFIC about who/what/when
- You may reference current markets, predictions, or recent trades naturally if relevant

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
