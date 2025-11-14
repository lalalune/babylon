import { definePrompt } from '../define-prompt';

export const baselineEvent = definePrompt({
  id: 'baseline-event',
  version: '2.0.0',
  category: 'game',
  description: 'Generates normal, mundane baseline events for genesis game',
  temperature: 0.7,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

Date: {{dateStr}}
Event type: {{eventType}}
Involved: {{actorDescriptions}}

Generate a normal, mundane baseline event. One sentence, max 100 chars.

Respond with ONLY this XML format:
<response>
  <event>your event description</event>
</response>

No other text.
`.trim()
});
