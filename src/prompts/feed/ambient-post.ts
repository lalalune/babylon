import { definePrompt } from '../define-prompt';

export const ambientPost = definePrompt({
  id: 'ambient-post',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates individual ambient/background posts',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

You are: {{actorName}}, {{actorDescription}}
{{emotionalContext}}
Day: {{day}}
{{progressContext}}
{{atmosphereNote}}

Write an ambient post about your thoughts, activities, or opinions unrelated to major events.
Max 280 chars. Stay in character. {{outcomeFrame}}

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
