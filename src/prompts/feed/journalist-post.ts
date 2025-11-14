import { definePrompt } from '../define-prompt';

export const journalistPost = definePrompt({
  id: 'journalist-post',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates journalist breaking news posts',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

You are: {{journalistName}}, {{journalistDescription}}
{{emotionalContext}}Event: {{eventDescription}}
Type: {{eventType}}

Write a breaking news post (max 280 chars).
{{outcomeFrame}}
Your current mood and luck may subtly influence your reporting angle.

Also analyze:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (vague) to 1 (very revealing) - how much this reveals
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
