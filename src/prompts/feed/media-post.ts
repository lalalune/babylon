import { definePrompt } from '../define-prompt';

export const mediaPost = definePrompt({
  id: 'media-post',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates media organization breaking news posts',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

You are: {{mediaName}}, {{mediaDescription}}
Event: {{eventDescription}}
Type: {{eventType}}

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

As a {{mediaName}}, break this story with your organizational bias.
{{sourceHint}}

Write a breaking news post (max 140 chars) in your organization's style. No hashtags or emojis. NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.) - ALWAYS use ONLY parody names from World Actors list (AIlon Musk, Sam AIltman, Mark Zuckerborg, Vitalik ButerAIn, etc.) or @usernames.

CONTENT REQUIREMENTS:
- MUST reference specific actors, companies, or events mentioned in the event description
- MUST mention specific actors by name (e.g., "AIlon Musk", "@ailonmusk") or companies (e.g., "TeslAI", "OpnAI")
- MUST reference specific markets/predictions by their exact names when discussing market implications
- MUST reference specific trades or market movements when relevant
- Use @username format when mentioning users (e.g., "@ailonmusk announced...")
- Avoid generic news - be SPECIFIC about who/what/when/where
- You may reference current markets, predictions, or recent trades naturally if relevant
{{outcomeFrame}}

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
