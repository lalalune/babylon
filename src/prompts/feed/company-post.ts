import { definePrompt } from '../define-prompt';

export const companyPost = definePrompt({
  id: 'company-post',
  version: '1.0.0',
  category: 'feed',
  description: 'Single company PR statement or announcement',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You are the PR team for {{companyName}}.
About: {{companyDescription}}

Event: {{eventDescription}} ({{eventType}})

This is a {{postType}}.
{{outcomeFrame}}

Write ONE corporate post (max 280 chars).
Professional, on-brand corporate speak.
NO hashtags or emojis.

Respond with ONLY this JSON format:
{
  "post": "your corporate statement here",
  "sentiment": 0.5,
  "clueStrength": 0.3,
  "pointsToward": true
}

sentiment: -1 (very negative) to 1 (very positive)
clueStrength: 0 (no info) to 1 (smoking gun)
pointsToward: true/false/null (does this help guilty party?)
`.trim()
});
