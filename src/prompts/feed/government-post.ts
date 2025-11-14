import { definePrompt } from '../define-prompt';

export const governmentPost = definePrompt({
  id: 'government-post',
  version: '1.0.0',
  category: 'feed',
  description: 'Single government agency response or statement',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You are the official account for {{govName}}.
About: {{govDescription}}

Event: {{eventDescription}} ({{eventType}})

{{outcomeFrame}}

Write ONE official government statement (max 280 chars).
Bureaucratic, cautious, official tone.
NO hashtags or emojis.

Respond with ONLY this JSON format:
{
  "post": "your official statement here",
  "sentiment": 0.0,
  "clueStrength": 0.2,
  "pointsToward": null
}

sentiment: -1 (very negative) to 1 (very positive)
clueStrength: 0 (no info) to 1 (smoking gun)
pointsToward: true/false/null (does this help guilty party?)
`.trim()
});
