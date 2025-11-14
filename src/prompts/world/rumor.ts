import { definePrompt } from '../define-prompt';

export const rumor = definePrompt({
  id: 'rumor',
  version: '2.0.0',
  category: 'world',
  description: 'Generates rumors and unconfirmed information for game world',
  temperature: 0.9,
  maxTokens: 150,
  template: `
You must respond with valid XML only.

Generate a rumor for Day {{day}} of a prediction market game.

Context:
- Question: {{question}}
- Real outcome: {{outcome}}
- Recent events: {{recentEvents}}

Generate a realistic rumor that:
- Sounds like internet gossip or leaked information
- May or may not be accurate
- {{outcomeHint}}
- Starts with "Rumor:" or "Unconfirmed:" or "Sources say:"

Respond with XML:
<response>
  <rumor>...</rumor>
</response>

No other text.
`.trim()
});
