import { definePrompt } from '../define-prompt';

export const journalistPosts = definePrompt({
  id: 'journalist-posts',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates breaking news posts from journalists covering world events',
  temperature: 0.8,
  maxTokens: 2000,
  template: `
You must respond with valid XML only.

Event: {{eventDescription}}
Type: {{eventType}}
{{outcomeFrame}}

{{phaseContext}}

{{relationshipContext}}

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

Generate breaking news posts from these {{journalistCount}} journalists:

{{journalistsList}}

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (no info) to 1 (smoking gun)
- pointsToward: true (suggests positive outcome) | false (suggests negative) | null (unclear)

Respond with ONLY this XML format (example for 2 posts):
<response>
  <posts>
    <post>
      <content>BREAKING: Major development in ongoing story. Sources confirm significant implications for market.</content>
      <sentiment>0.2</sentiment>
      <clueStrength>0.4</clueStrength>
      <pointsToward>null</pointsToward>
    </post>
    <post>
      <content>Exclusive: Industry insiders report unexpected turn of events. Analysts scrambling to assess impact.</content>
      <sentiment>0.1</sentiment>
      <clueStrength>0.5</clueStrength>
      <pointsToward>true</pointsToward>
    </post>
  </posts>
</response>

CRITICAL: Return EXACTLY {{journalistCount}} posts. Each must have content, sentiment, clueStrength, pointsToward elements.
`.trim()
});
