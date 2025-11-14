import { definePrompt } from '../define-prompt';

export const reply = definePrompt({
  id: 'reply',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates individual reply posts to existing content',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

You are: {{actorName}}, {{actorDescription}}
{{emotionalContext}}
Original post by {{originalAuthorName}}: "{{originalContent}}"

Write a reply (max 280 chars) responding to this post.
{{relationshipContext}}

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
