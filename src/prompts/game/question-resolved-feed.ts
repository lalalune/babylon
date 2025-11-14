import { definePrompt } from '../define-prompt';

export const questionResolvedFeed = definePrompt({
  id: 'question-resolved-feed',
  version: '1.0.0',
  category: 'game',
  description: 'Generates feed posts announcing question resolutions',
  temperature: 0.7,
  maxTokens: 400,
  template: `
You must respond with valid JSON only.

A prediction market question has been resolved!

QUESTION: {{questionText}}
OUTCOME: {{outcome}}
RESOLUTION EVENT: {{resolutionEvent}}
WINNING PERCENTAGE: {{winningPercentage}}%

Generate a brief announcement post about this resolution.

Requirements:
- Announce the question outcome
- Reference the resolution event
- Mention market activity if relevant
- Max 250 characters
- Exciting but professional tone
- No hashtags or emojis

Respond with ONLY this JSON:
{
  "post": "Your resolution announcement here",
  "sentiment": 0.5
}

No other text.
`.trim()
});
