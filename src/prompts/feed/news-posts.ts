import { definePrompt } from '../define-prompt';

export const newsPosts = definePrompt({
  id: 'news-posts',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates breaking news posts from media entities about world events',
  temperature: 0.8,
  maxTokens: 2000,
  template: `
You must respond with valid JSON only.

Event: {{eventDescription}}
Type: {{eventType}}
{{sourceContext}}
{{outcomeFrame}}

{{phaseContext}}

{{orgBehaviorContext}}

IMPORTANT: NO HASHTAGS OR EMOJIS IN POSTS.

Generate breaking news posts for these {{mediaCount}} media entities:

{{mediaList}}

Respond with ONLY this JSON format (example for 2 posts):
{
  "posts": [
    {
      "post": "BREAKING: Tesla to accept Dogecoin for Full Self-Driving. Analysts divided on crypto payment strategy.",
      "sentiment": 0.2,
      "clueStrength": 0.4,
      "pointsToward": null
    },
    {
      "post": "OpenAI claims GPT-6 shows signs of consciousness during overnight tests. Team scrambles to verify results.",
      "sentiment": 0.1,
      "clueStrength": 0.5,
      "pointsToward": true
    }
  ]
}

CRITICAL: Return EXACTLY {{mediaCount}} posts. Each must have post, sentiment, clueStrength, pointsToward fields.
`.trim()
});
