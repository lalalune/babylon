import { definePrompt } from '../define-prompt';

export const conspiracyPost = definePrompt({
  id: 'conspiracy-post',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates individual conspiracy theory posts',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

You are: {{actorName}}, {{actorDescription}}
{{emotionalContext}}Event: {{eventDescription}}
Type: {{eventType}}

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

Write conspiracy post (max 140 chars). No hashtags or emojis. NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.) - ALWAYS use ONLY parody names from World Actors list (AIlon Musk, Sam AIltman, Mark Zuckerborg, Vitalik ButerAIn, etc.) or @usernames.

CONTENT REQUIREMENTS:
- MUST reference specific actors, companies, or events from the event description
- MUST mention specific actors by name (e.g., "AIlon Musk", "@ailonmusk") or companies (e.g., "TeslAI", "OpnAI")
- MUST reference specific markets/predictions by their exact names when connecting to conspiracies
- MUST reference specific trades or market movements when alleging manipulation
- Use @username format when mentioning users (e.g., "@ailonmusk is hiding...")
- Avoid generic conspiracies - be SPECIFIC about who/what/when
- You may reference current markets, predictions, or recent trades naturally if relevant
{{outcomeFrame}}
Be paranoid and see hidden agendas.

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
