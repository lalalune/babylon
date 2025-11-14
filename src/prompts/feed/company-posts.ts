import { definePrompt } from '../define-prompt';

export const companyPosts = definePrompt({
  id: 'company-posts',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates corporate PR statements and responses to events',
  temperature: 0.7,
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

Generate corporate statements from these {{companyCount}} companies:

{{companiesList}}

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (no info) to 1 (smoking gun)
- pointsToward: true (suggests positive outcome) | false (suggests negative) | null (unclear)

Respond with ONLY this XML format (example for 2 posts):
<response>
  <posts>
    <post>
      <content>We're excited about this development and remain committed to innovation. Our team is working closely with partners.</content>
      <sentiment>0.5</sentiment>
      <clueStrength>0.3</clueStrength>
      <pointsToward>true</pointsToward>
    </post>
    <post>
      <content>We're monitoring the situation closely. No immediate changes to our roadmap or operations at this time.</content>
      <sentiment>0.0</sentiment>
      <clueStrength>0.2</clueStrength>
      <pointsToward>null</pointsToward>
    </post>
  </posts>
</response>

CRITICAL: Return EXACTLY {{companyCount}} posts. Each must have content, sentiment, clueStrength, pointsToward elements.
`.trim()
});
