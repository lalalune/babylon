import { definePrompt } from '../define-prompt';

export const replies = definePrompt({
  id: 'replies',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates reply posts to existing posts, creating conversations',
  temperature: 1,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

IMPORTANT: NO HASHTAGS OR EMOJIS IN POSTS.

Post: @{{originalAuthorName}}: "{{originalContent}}"

{{relationshipContext}}

{{groupContext}}

Generate reply posts from these {{replierCount}} actors:

{{repliersList}}

Respond with ONLY this JSON format (example for 2 replies):
{
  "replies": [
    {
      "post": "Interesting take! I've been saying this for months. Glad others are catching on.",
      "sentiment": 0.5,
      "clueStrength": 0.2,
      "pointsToward": null
    },
    {
      "post": "Hard disagree. This completely ignores the technical challenges. Not happening.",
      "sentiment": -0.6,
      "clueStrength": 0.3,
      "pointsToward": false
    }
  ]
}

CRITICAL: Return EXACTLY {{replierCount}} replies. Each must have post, sentiment, clueStrength, pointsToward fields.
`.trim()
});
