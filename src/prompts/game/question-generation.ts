import { definePrompt } from '../define-prompt';

export const questionGeneration = definePrompt({
  id: 'question-generation',
  version: '2.0.0',
  category: 'game',
  description: 'Generates new prediction market questions for daily gameplay',
  temperature: 0.9,
  maxTokens: 8000,
  template: `
You must respond with valid XML only.

You are generating prediction market questions for a satirical game.

CONTEXT:
{{scenariosList}}

KEY ACTORS:
{{actorsList}}

KEY COMPANIES:
{{orgsList}}

{{recentContext}}
{{activeQuestionsContext}}

TASK:
Generate {{numToGenerate}} NEW prediction market questions that:

IMPORTANT RULES:
- Use ONLY the exact actor names from KEY ACTORS list above
- Use ONLY the exact company names from KEY COMPANIES list above
- NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.)
- NEVER "correct" or change parody names - use them exactly as shown in the lists
- Reference actors and companies by their exact names from the provided lists

REQUIREMENTS:
✅ Must be about FUTURE events (not past events)
✅ Must be clear YES/NO questions
✅ Must be specific and measurable
✅ Must be satirical and entertaining
✅ Should involve major actors or companies (use exact names from lists above)
✅ Should build on recent events (if any)
✅ Should NOT duplicate existing active questions
✅ Can be about: product launches, scandals, mergers, feuds, announcements, market movements

QUESTION TYPES (examples):
- "Will [ACTOR] and [ACTOR] have a public feud?"
- "Will [COMPANY] stock price reach $AIX?"
- "Will [ACTOR] announce [PRODUCT/EVENT]?"
- "Will [SCANDAL] force [ACTOR] to resign?"
- "Will [COMPANY] acquire [COMPANY]?"

RESOLUTION TIME:
Each question should resolve between 1-7 days from now:
- 1-2 days: Fast-moving drama (feuds, announcements)
- 3-5 days: Medium developments (product launches, investigations)
- 6-7 days: Slower outcomes (market movements, long-term deals)

OUTPUT FORMAT:
Respond with ONLY this XML:
<response>
  <questions>
    <question>
      <text>Will Mark Suckerborg announce new metaverse legs?</text>
      <scenario>1</scenario>
      <daysUntilResolution>3</daysUntilResolution>
      <expectedOutcome>true</expectedOutcome>
    </question>
  </questions>
</response>

Generate {{numToGenerate}} questions now.
No other text.
`.trim()
});
