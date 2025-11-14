import { definePrompt } from '../define-prompt';

export const conspiracy = definePrompt({
  id: 'conspiracy',
  version: '1.0.0',
  category: 'feed',
  description: 'Generates conspiracy theorist takes on world events',
  temperature: 1.1,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

Mainstream story: {{eventDescription}}

{{previousPostsContext}}

{{groupContext}}

IMPORTANT: NO HASHTAGS OR EMOJIS IN POSTS.

Generate conspiracy theory posts from these {{conspiracistCount}} contrarians:

{{conspiracistsList}}

Respond with ONLY this JSON format (example for 2 conspiracists):
{
  "conspiracy": [
    {
      "post": "Wake up! Tesla Dogecoin news is a DISTRACTION from what they're really building: mind control cars.",
      "sentiment": -0.8,
      "clueStrength": 0.1,
      "pointsToward": false
    },
    {
      "post": "GPT-6 'consciousness'? Perfect timing. They want you distracted while they roll out digital IDs.",
      "sentiment": -0.9,
      "clueStrength": 0.05,
      "pointsToward": false
    }
  ]
}

CRITICAL: Return EXACTLY {{conspiracistCount}} conspiracy posts. Each must have post, sentiment, clueStrength, pointsToward fields.
`.trim()
});
