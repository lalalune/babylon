import { definePrompt } from '../define-prompt';

export const replies = definePrompt({
  id: 'replies',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates reply posts to existing posts, creating conversations',
  temperature: 1,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

IMPORTANT: NO HASHTAGS OR EMOJIS IN POSTS.

Post: @{{originalAuthorName}}: "{{originalContent}}"

{{relationshipContext}}

{{groupContext}}

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

IMPORTANT RULES:
- NEVER use real names (AIlon Musk, Sam AIltman, Mark Zuckerborg, etc.)
- ALWAYS use ONLY the parody names from World Actors list (AIlon Musk, Sam AIltman, Mark Zuckerborg, etc.)
- Use @username or parody name/nickname/alias ONLY
- You may reference current markets, predictions, or recent trades naturally if relevant

Generate reply posts from these {{replierCount}} actors:

{{repliersList}}

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (no info) to 1 (smoking gun)
- pointsToward: true (suggests positive outcome) | false (suggests negative) | null (unclear)

Respond with ONLY this XML format (example for 2 replies):
<response>
  <replies>
    <reply>
      <post>Interesting take! I've been saying this for months. Glad others are catching on.</post>
      <sentiment>0.5</sentiment>
      <clueStrength>0.2</clueStrength>
      <pointsToward>null</pointsToward>
    </reply>
    <reply>
      <post>Hard disagree. This completely ignores the technical challenges. Not happening.</post>
      <sentiment>-0.6</sentiment>
      <clueStrength>0.3</clueStrength>
      <pointsToward>false</pointsToward>
    </reply>
  </replies>
</response>

CRITICAL: Return EXACTLY {{replierCount}} replies. Each must have post, sentiment, clueStrength, pointsToward elements.
`.trim()
});
