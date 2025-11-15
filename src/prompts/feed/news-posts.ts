import { definePrompt } from '../define-prompt';

export const newsPosts = definePrompt({
  id: 'news-posts',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates breaking news posts from media entities about world events',
  temperature: 0.8,
  maxTokens: 2000,
  template: `
You must respond with valid XML only.

Event: {{eventDescription}}
Type: {{eventType}}
{{sourceContext}}
{{outcomeFrame}}

{{phaseContext}}

{{orgBehaviorContext}}

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
- MUST reference specific actors, companies, or events mentioned in the event description
- MUST mention specific actors by name (e.g., "AIlon Musk", "@ailonmusk") or companies (e.g., "TeslAI", "OpnAI")
- MUST reference specific markets/predictions by their exact names when relevant
- MUST reference specific trades or market movements when discussing market impact
- Use @username format when mentioning users (e.g., "@ailonmusk announced...")
- Avoid generic news - be SPECIFIC about who/what/when/where
- You may reference current markets, predictions, or recent trades naturally if relevant

Generate breaking news posts for these {{mediaCount}} media entities:

{{mediaList}}

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (no info) to 1 (smoking gun)
- pointsToward: true (suggests positive outcome) | false (suggests negative) | null (unclear)

Respond with ONLY this XML format (example for 2 posts):
<response>
  <posts>
    <post>
      <content>BREAKING: TeslAI to accept Dogecoin for Full Self-Driving. Analysts divided on crypto payment strategy.</content>
      <sentiment>0.2</sentiment>
      <clueStrength>0.4</clueStrength>
      <pointsToward>null</pointsToward>
    </post>
    <post>
      <content>OpnAI claims GPT-6 shows signs of consciousness during overnight tests. Team scrambles to verify results.</content>
      <sentiment>0.1</sentiment>
      <clueStrength>0.5</clueStrength>
      <pointsToward>true</pointsToward>
    </post>
  </posts>
</response>

CRITICAL: Return EXACTLY {{mediaCount}} posts. Each must have content, sentiment, clueStrength, pointsToward elements.
`.trim()
});
