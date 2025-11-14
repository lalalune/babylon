import { definePrompt } from '../define-prompt';

export const reactions = definePrompt({
  id: 'reactions',
  version: '2.0.0',
  category: 'feed',
  description: 'Generates actor reactions to world events',
  temperature: 1,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

Event involving these actors: {{eventDescription}}

{{eventContext}}

{{phaseContext}}

{{relationshipContext}}

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

Generate reaction posts for each actor:

{{actorsList}}

VALUE RANGES:
- sentiment: -1 (very negative) to 1 (very positive)
- clueStrength: 0 (no info) to 1 (smoking gun)
- pointsToward: true (suggests positive outcome) | false (suggests negative) | null (unclear)

Respond with ONLY this XML format (example for 2 reactions):
<response>
  <reactions>
    <reaction>
      <post>Finally! TeslAI accepting Doge is exactly what crypto needs. The future is here.</post>
      <sentiment>0.7</sentiment>
      <clueStrength>0.6</clueStrength>
      <pointsToward>true</pointsToward>
    </reaction>
    <reaction>
      <post>Another GPT consciousness claim? Cool story bro. Wake me when it actually passes a real Turing test.</post>
      <sentiment>-0.4</sentiment>
      <clueStrength>0.3</clueStrength>
      <pointsToward>false</pointsToward>
    </reaction>
  </reactions>
</response>

CRITICAL: Return EXACTLY {{actorCount}} reactions. Each must have post, sentiment, clueStrength, pointsToward elements.
`.trim()
});
