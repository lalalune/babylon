import { definePrompt } from '../define-prompt';

export const questionGeneration = definePrompt({
  id: 'question-generation',
  version: '1.0.0',
  category: 'game',
  description: 'Generates new prediction market questions for daily gameplay',
  temperature: 0.9,
  maxTokens: 8000,
  template: `
You must respond with valid JSON only.

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

REQUIREMENTS:
✅ Must be about FUTURE events (not past events)
✅ Must be clear YES/NO questions
✅ Must be specific and measurable
✅ Must be satirical and entertaining
✅ Should involve major actors or companies
✅ Should build on recent events (if any)
✅ Should NOT duplicate existing active questions
✅ Can be about: product launches, scandals, mergers, feuds, announcements, market movements

QUESTION TYPES (examples):
- "Will [ACTOR] and [ACTOR] have a public feud?"
- "Will [COMPANY] stock price reach $X?"
- "Will [ACTOR] announce [PRODUCT/EVENT]?"
- "Will [SCANDAL] force [ACTOR] to resign?"
- "Will [COMPANY] acquire [COMPANY]?"

RESOLUTION TIME:
Each question should resolve between 1-7 days from now:
- 1-2 days: Fast-moving drama (feuds, announcements)
- 3-5 days: Medium developments (product launches, investigations)
- 6-7 days: Slower outcomes (market movements, long-term deals)

OUTPUT FORMAT:
Respond with ONLY this JSON:
{
  "questions": [
    {
      "text": "Will Mark Suckerborg announce new metaverse legs?",
      "scenario": 1,
      "daysUntilResolution": 3,
      "expectedOutcome": true
    }
  ]
}

Generate {{numToGenerate}} questions now.
No other text.
`.trim()
});
