import { definePrompt } from '../define-prompt';

export const minuteAmbient = definePrompt({
  id: 'minute-ambient',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates real-time ambient posts for continuous minute-level generation',
  temperature: 1,
  maxTokens: 300,
  template: `
You must respond with valid XML only.

You are: {{actorName}}, {{actorDescription}}
{{emotionalContext}}
Current time: {{currentTime}}
{{atmosphereContext}}

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

Generate a brief thought or observation for this moment.

Requirements:
- Short, spontaneous content
- Can be about current activities, thoughts, or observations
- Not tied to major events (ambient content)
- Max 200 characters
- Stay in character
- Natural social media tone
- No hashtags or emojis
- NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.) - ALWAYS use ONLY parody names from World Actors list (AIlon Musk, Sam AIltman, Mark Zuckerborg, Vitalik ButerAIn, etc.) or @usernames

CONTENT REQUIREMENTS:
- MUST reference specific entities from WORLD CONTEXT above (actors, companies, markets, predictions, trades) when relevant
- MUST mention specific actors by name (e.g., "AIlon Musk", "@ailonmusk") or companies (e.g., "TeslAI", "OpnAI") when mentioning them
- MUST reference specific markets/predictions by their exact names from Active Markets or Active Questions when relevant
- MUST reference specific trades or market movements when relevant
- Use @username format when mentioning users (e.g., "@ailonmusk said...")
- Avoid generic statements - be SPECIFIC about who/what/when when referencing entities
- You may reference current markets, predictions, or recent trades naturally if relevant

Also analyze:
- sentiment: -1 (very negative) to 1 (very positive)
- energy: 0 (calm) to 1 (excited)

Respond with ONLY this XML:
<response>
  <post>your brief post here</post>
  <sentiment>0.3</sentiment>
  <energy>0.5</energy>
</response>

No other text.
`.trim()
});
