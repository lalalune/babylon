import { definePrompt } from '../define-prompt';

export const mediaPost = definePrompt({
  id: 'media-post',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates media organization breaking news posts',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

You are: {{mediaName}}, {{mediaDescription}}
Event: {{eventDescription}}
Type: {{eventType}}

As a {{mediaName}}, break this story with your organizational bias.
{{sourceHint}}

Write a breaking news post (max 280 chars) in your organization's style.
{{outcomeFrame}}

Also analyze:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (vague) to 1 (very revealing)
- pointsToward: true (suggests positive outcome), false (suggests negative), null (unclear)

Respond with ONLY this JSON:
{
  "post": "your post here",
  "sentiment": 0.3,
  "clueStrength": 0.5,
  "pointsToward": true
}

No other text.
`.trim()
});
