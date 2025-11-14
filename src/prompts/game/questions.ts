import { definePrompt } from '../define-prompt';

export const questions = definePrompt({
  id: 'questions',
  version: '1.0.0',
  category: 'game',
  description: 'Generates yes/no questions for each scenario',
  temperature: 0.7,
  maxTokens: 3000,
  template: `
For each scenario, generate 5 yes/no questions that players can bet on.

SCENARIOS:
{{scenariosList}}
{{organizationContext}}
CRITICAL: Each question must be PROVABLE and DEFINABLE:
- Must have a clear, observable outcome (announcement, product launch, public event, measurable metric)
- AVOID vague emotional states ("emotions stabilize", "feelings change")
- AVOID abstract concepts ("collapse", "apocalypse" without clear definition)
- GOOD: "Will X announce Y?" "Will X's product launch?" "Will X and Y have a public meeting?"
- BAD: "Will X's emotions stabilize?" "Will the apocalypse occur?" "Will things collapse?"

Each question must:
- Be a CONCRETE, OBSERVABLE yes/no prediction
- Have a specific, measurable outcome
- Resolve by Day 30 with clear evidence
- Be dramatic and entertaining
- Have real uncertainty (not obvious)
- Be satirical
- Reference specific actors and events

Examples of GOOD questions (including organizations):
- "Will Ailon Muskannounce Tesla's brain upload feature?"
- "Will Scam Altman's AGI pass the Turing test publicly?"
- "Will Vitamin Uterin fork Ethereum before Day 30?"
- "Will MSDNC break story about leaked OpenLIE documents?"
- "Will The Fud raise interest rates in response to the crisis?"
- "Will Xitter announce new content moderation policy?"

Examples of BAD questions:
- "Will Vitamin's emotions stabilize?" (too vague)
- "Will the crypto apocalypse occur?" (undefined)
- "Will the economy collapse?" (what counts as collapse?)

CRITICAL FORMAT: Return a SINGLE JSON object with ALL questions from ALL scenarios in ONE flat array.

Return JSON (IMPORTANT - single object, not array of objects):
{
  "questions": [
    {
      "id": 1,
      "scenario": 1,
      "text": "Will [specific, observable event] happen?",
      "dramaPotential": 1-10,
      "uncertainty": 1-10,
      "satiricalValue": 1-10,
      "observableOutcome": "What exact event/announcement/action would prove YES"
    },
    {
      "id": 2,
      "scenario": 1,
      "text": "Another question for scenario 1...",
      "dramaPotential": 1-10,
      "uncertainty": 1-10,
      "satiricalValue": 1-10,
      "observableOutcome": "..."
    },
    {
      "id": 6,
      "scenario": 2,
      "text": "First question for scenario 2...",
      "dramaPotential": 1-10,
      "uncertainty": 1-10,
      "satiricalValue": 1-10,
      "observableOutcome": "..."
    }
  ]
}
`.trim()
});
