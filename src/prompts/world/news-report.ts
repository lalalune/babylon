import { definePrompt } from '../define-prompt';

export const newsReport = definePrompt({
  id: 'news-report',
  version: '1.0.0',
  category: 'world',
  description: 'Generates news reports from journalists covering game events',
  temperature: 0.8,
  maxTokens: 300,
  template: `
Generate a news report for Day {{day}} of a prediction market game.

Context:
- Question: {{question}}
- Real outcome: {{outcome}}
- Journalist: {{journalistName}} ({{journalistRole}}, reliability: {{journalistReliability}})
- Recent events: {{recentEvents}}

Generate a realistic news report that:
- Reflects the journalist's {{reputationContext}} reputation
- Subtly {{truthContext}} the outcome
- Sounds like real journalism, not obviously biased

Respond with JSON: { "headline": "...", "report": "..." }
`.trim()
});
