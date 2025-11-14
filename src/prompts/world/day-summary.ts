import { definePrompt } from '../define-prompt';

export const daySummary = definePrompt({
  id: 'day-summary',
  version: '2.0.0',
  category: 'world',
  description: 'Generates one-line summaries of daily events',
  temperature: 0.6,
  maxTokens: 100,
  template: `
You must respond with valid XML only.

Generate a summary for Day {{day}}.

Context:
- Question: {{question}}
- Events today: {{eventsToday}}
- Real outcome: {{outcome}}

Generate a one-line summary that captures the day's key developments.

Respond with XML:
<response>
  <summary>...</summary>
</response>

No other text.
`.trim()
});
