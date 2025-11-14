import { definePrompt } from '../define-prompt';

export const governmentPosts = definePrompt({
  id: 'government-posts',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates official government responses and statements',
  temperature: 0.6,
  maxTokens: 2000,
  template: `
You must respond with valid XML only.

Event: {{eventDescription}}
Type: {{eventType}}
{{outcomeFrame}}

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

Generate official government statements from these {{governmentCount}} agencies:

{{governmentsList}}

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (no info) to 1 (smoking gun)
- pointsToward: true (suggests positive outcome) | false (suggests negative) | null (unclear)

Respond with ONLY this XML format (example for 2 posts):
<response>
  <posts>
    <post>
      <content>We are reviewing the situation and will provide guidance to ensure compliance with all regulations and public safety.</content>
      <sentiment>-0.1</sentiment>
      <clueStrength>0.2</clueStrength>
      <pointsToward>null</pointsToward>
    </post>
    <post>
      <content>Authorities are monitoring developments closely. No immediate regulatory action planned but situation remains under review.</content>
      <sentiment>-0.2</sentiment>
      <clueStrength>0.3</clueStrength>
      <pointsToward>false</pointsToward>
    </post>
  </posts>
</response>

CRITICAL: Return EXACTLY {{governmentCount}} posts. Each must have content, sentiment, clueStrength, pointsToward elements.
`.trim()
});
