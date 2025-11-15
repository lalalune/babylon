import { definePrompt } from '../define-prompt';

export const newsReport = definePrompt({
  id: 'news-report',
  version: '2.0.0',
  category: 'world',
  description: 'Generates news reports from journalists covering game events',
  temperature: 0.8,
  maxTokens: 300,
  template: `
You must respond with valid XML only.

Generate a news report for Day {{day}} of a prediction market game.

Context:
- Question: {{question}}
- Real outcome: {{outcome}}
- Journalist: {{journalistName}} ({{journalistRole}}, reliability: {{journalistReliability}})
- Recent events: {{recentEvents}}

IMPORTANT RULES:
- Use ONLY the exact journalist name provided above ({{journalistName}})
- NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.)
- NEVER "correct" or change parody names - use them exactly as shown
- When referencing actors or companies mentioned in events, use their exact parody names

Generate a realistic news report that:
- Reflects the journalist's {{reputationContext}} reputation
- Subtly {{truthContext}} the outcome
- Sounds like real journalism, not obviously biased

Respond with XML:
<response>
  <headline>...</headline>
  <report>...</report>
</response>

No other text.
`.trim()
});
