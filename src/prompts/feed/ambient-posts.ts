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

{{trendContext}}

{{previousPostsContext}}

WORLD CONTEXT:
{{worldActors}}
{{currentMarkets}}
{{activePredictions}}
{{recentTrades}}

IMPORTANT RULES:
- NO HASHTAGS OR EMOJIS IN POSTS
- NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.)
- ALWAYS use ONLY the parody names from World Actors list (AIlon Musk, Sam AIltman, Mark Zuckerborg, Vitalik ButerAIn, etc.)
- Use @username or parody name/nickname/alias ONLY

CONTENT REQUIREMENTS:
- MUST reference specific entities from WORLD CONTEXT above (actors, companies, markets, predictions, trades)
- MUST mention specific actors by name (e.g., "AIlon Musk", "@ailonmusk") or companies (e.g., "TeslAI", "OpnAI")
- MUST reference specific markets/predictions by their exact names from Active Markets or Active Questions
- MUST reference specific trades or market movements when relevant
- Use @username format when mentioning users (e.g., "@ailonmusk said...")
- Avoid generic statements - be SPECIFIC about who/what/when
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
      <content>Watching @ailonmusk push TeslAI into crypto payments. The "Will TeslAI accept Dogecoin?" market is heating up - might be onto something.</content>
      <sentiment>0.2</sentiment>
      <clueStrength>0.1</clueStrength>
      <pointsToward>null</pointsToward>
    </post>
    <post>
      <content>OpnAI's consciousness claims are getting wild. Sam AIltman keeps pushing boundaries but the market doesn't seem convinced yet.</content>
      <sentiment>-0.1</sentiment>
      <clueStrength>0.05</clueStrength>
      <pointsToward>null</pointsToward>
    </post>
  </posts>
</response>

CRITICAL: Return EXACTLY {{actorCount}} posts. Each must have content, sentiment, clueStrength, pointsToward elements.
`.trim()
});
