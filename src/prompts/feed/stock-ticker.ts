import { definePrompt } from '../define-prompt';

export const stockTicker = definePrompt({
  id: 'stock-ticker',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates stock ticker style posts for price movements',
  temperature: 0.6,
  maxTokens: 200,
  template: `
You must respond with valid XML only.

Generate a stock ticker style post for this price movement:

TICKER: {{ticker}}
COMPANY: {{companyName}}
PRICE: \${{currentPrice}}
CHANGE: {{priceChange}}% ({{direction}})
VOLUME: {{volume}}

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

Create a brief, professional stock ticker post.

Requirements:
- Concise financial reporting style
- Include key numbers
- Max 150 characters
- No hashtags or emojis
- Professional but can be subtly satirical
- NEVER use real names - ALWAYS use parody names from World Actors list (AIlon Musk, Sam AIltman, etc.) or @usernames

Example: "{{ticker}} \${{currentPrice}} {{direction}} {{priceChange}}% on news of [brief event mention]"

Respond with ONLY this XML:
<response>
  <post>Your ticker post here</post>
</response>

No other text.
`.trim()
});
