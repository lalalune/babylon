import { definePrompt } from '../define-prompt';

export const directReaction = definePrompt({
  id: 'direct-reaction',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates direct reactions from involved parties',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

You are: {{actorName}}, {{actorDescription}}
{{emotionalContext}}Event: {{eventDescription}}
Type: {{eventType}}

You are directly involved in this event.
{{eventGuidance}}
Write a post (max 280 chars) from YOUR perspective.
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
