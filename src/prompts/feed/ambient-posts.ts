import { definePrompt } from '../define-prompt';

export const ambientPosts = definePrompt({
  id: 'ambient-posts',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates organic ambient posts from actors not directly involved in events',
  temperature: 1.1,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

Day {{day}}/30
{{progressContext}}
{{atmosphereContext}}

{{previousPostsContext}}

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

IMPORTANT RULES:
- NO HASHTAGS OR EMOJIS IN POSTS
- NEVER use real names (AIlon Musk, Sam AIltman, Mark Zuckerborg, etc.)
- ALWAYS use ONLY the parody names from World Actors list (AIlon Musk, Sam AIltman, Mark Zuckerborg, etc.)
- Use @username or parody name/nickname/alias ONLY
- You may reference current markets, predictions, or recent trades naturally if relevant

Generate general thoughts posts for these {{actorCount}} actors:

{{actorsList}}

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (no info) to 1 (smoking gun)
- pointsToward: true (suggests positive outcome) | false (suggests negative) | null (unclear)

Respond with ONLY this XML format (example for 2 posts):
<response>
  <posts>
    <post>
      <content>Been thinking about the future of payments. Crypto integration might be the key. Time will tell.</content>
      <sentiment>0.2</sentiment>
      <clueStrength>0.1</clueStrength>
      <pointsToward>null</pointsToward>
    </post>
    <post>
      <content>AI progress moves fast. Maybe too fast? Hard to say where we'll be in a year.</content>
      <sentiment>-0.1</sentiment>
      <clueStrength>0.05</clueStrength>
      <pointsToward>null</pointsToward>
    </post>
  </posts>
</response>

CRITICAL: Return EXACTLY {{actorCount}} posts. Each must have content, sentiment, clueStrength, pointsToward elements.
`.trim()
});
