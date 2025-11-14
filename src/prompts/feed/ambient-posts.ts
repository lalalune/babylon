import { definePrompt } from '../define-prompt';

export const ambientPosts = definePrompt({
  id: 'ambient-posts',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates organic ambient posts from actors not directly involved in events',
  temperature: 1.1,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

Day {{day}}/30
{{progressContext}}
{{atmosphereContext}}

{{previousPostsContext}}

IMPORTANT: NO HASHTAGS OR EMOJIS IN POSTS.

Generate general thoughts posts for these {{actorCount}} actors:

{{actorsList}}

Respond with ONLY this JSON format (example for 2 posts):
{
  "posts": [
    {
      "post": "Been thinking about the future of payments. Crypto integration might be the key. Time will tell.",
      "sentiment": 0.2,
      "clueStrength": 0.1,
      "pointsToward": null
    },
    {
      "post": "AI progress moves fast. Maybe too fast? Hard to say where we'll be in a year.",
      "sentiment": -0.1,
      "clueStrength": 0.05,
      "pointsToward": null
    }
  ]
}

CRITICAL: Return EXACTLY {{actorCount}} posts. Each must have post, sentiment, clueStrength, pointsToward fields.
`.trim()
});
