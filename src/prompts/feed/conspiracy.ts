import { definePrompt } from '../define-prompt';

export const conspiracy = definePrompt({
  id: 'conspiracy',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates conspiracy theorist takes on world events',
  temperature: 1.1,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

Mainstream story: {{eventDescription}}

{{previousPostsContext}}

{{groupContext}}

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

Generate conspiracy theory posts from these {{conspiracistCount}} contrarians:

{{conspiracistsList}}

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (no info) to 1 (smoking gun)
- pointsToward: true (suggests positive outcome) | false (suggests negative) | null (unclear)

Respond with ONLY this XML format (example for 2 conspiracists):
<response>
  <conspiracy>
    <theory>
      <post>Wake up! TeslAI Dogecoin news is a DISTRACTION from what they're really building: mind control cars.</post>
      <sentiment>-0.8</sentiment>
      <clueStrength>0.1</clueStrength>
      <pointsToward>false</pointsToward>
    </theory>
    <theory>
      <post>GPT-6 'consciousness'? Perfect timing. They want you distracted while they roll out digital IDs.</post>
      <sentiment>-0.9</sentiment>
      <clueStrength>0.05</clueStrength>
      <pointsToward>false</pointsToward>
    </theory>
  </conspiracy>
</response>

CRITICAL: Return EXACTLY {{conspiracistCount}} conspiracy posts. Each must have post, sentiment, clueStrength, pointsToward elements.
`.trim()
});
