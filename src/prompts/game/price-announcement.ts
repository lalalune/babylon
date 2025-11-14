import { definePrompt } from '../define-prompt';

export const priceAnnouncement = definePrompt({
  id: 'price-announcement',
  version: '2.0.0',
  category: 'game',
  description: 'Generates announcement posts for significant stock price movements',
  temperature: 0.7,
  maxTokens: 300,
  template: `
You must respond with valid XML only.

A significant stock price change has occurred:

COMPANY: {{companyName}}
PRICE CHANGE: {{priceChange}}% ({{direction}})
CURRENT PRICE: \${{currentPrice}}
EVENT CONTEXT: {{eventDescription}}

Generate a brief announcement post about this price movement.

Requirements:
- One sentence, max 200 characters
- Mention the price change and direction
- Reference the triggering event if relevant
- Satirical but professional tone
- No hashtags or emojis

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)

Respond with ONLY this XML:
<response>
  <post>Your price announcement here</post>
  <sentiment>0.5</sentiment>
</response>

No other text.
`.trim()
});
