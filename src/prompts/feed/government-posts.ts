import { definePrompt } from '../define-prompt';

export const governmentPosts = definePrompt({
  id: 'government-posts',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates official government responses and statements',
  temperature: 0.6,
  maxTokens: 2000,
  template: `
You must respond with valid JSON only.

Event: {{eventDescription}}
Type: {{eventType}}
{{outcomeFrame}}

{{previousPostsContext}}

IMPORTANT: NO HASHTAGS OR EMOJIS IN POSTS.

Generate official government statements from these {{governmentCount}} agencies:

{{governmentsList}}

Respond with ONLY this JSON format (example for 2 posts):
{
  "posts": [
    {
      "post": "We are reviewing the situation and will provide guidance to ensure compliance with all regulations and public safety.",
      "sentiment": -0.1,
      "clueStrength": 0.2,
      "pointsToward": null
    },
    {
      "post": "Authorities are monitoring developments closely. No immediate regulatory action planned but situation remains under review.",
      "sentiment": -0.2,
      "clueStrength": 0.3,
      "pointsToward": false
    }
  ]
}

CRITICAL: Return EXACTLY {{governmentCount}} posts. Each must have post, sentiment, clueStrength, pointsToward fields.
`.trim()
});
