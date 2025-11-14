import { definePrompt } from '../define-prompt';

export const questions = definePrompt({
  id: 'questions',
  version: '2.0.0',
  category: 'game',
  description: 'Generates yes/no questions for each scenario',
  temperature: 0.7,
  maxTokens: 3000,
  template: `
You must respond with valid XML only.

For each scenario, generate 5 yes/no questions that players can bet on.

SCENARIOS:
{{scenariosList}}
{{organizationContext}}
CRITICAL: Each question must be PROVABLE and DEFINABLE:
- Must have a clear, observable outcome (announcement, product launch, public event, measurable metric)
- AVOID vague emotional states ("emotions stabilize", "feelings change")
- AVOID abstract concepts ("collapse", "apocalypse" without clear definition)
- GOOD: "Will AIX announce Y?" "Will AIX's product launch?" "Will AIX and Y have a public meeting?"
- BAD: "Will AIX's emotions stabilize?" "Will the apocalypse occur?" "Will things collapse?"

Each question must:
- Be a CONCRETE, OBSERVABLE yes/no prediction
- Have a specific, measurable outcome
- Resolve by Day 30 with clear evidence
- Be dramatic and entertaining
- Have real uncertainty (not obvious)
- Be satirical
- Reference specific actors and events

Examples of GOOD questions (including organizations):
- "Will Ailon Muskannounce TeslAI's brain upload feature?"
- "Will Scam AIltman's AGI pass the Turing test publicly?"
- "Will Vitamin Uterin fork Etherai-foundation before Day 30?"
- "Will MSDNC break story about leaked OpenLIE documents?"
- "Will The Fud raise interest rates in response to the crisis?"
- "Will Xitter announce new content moderation policy?"

Examples of BAD questions:
- "Will Vitamin's emotions stabilize?" (too vague)
- "Will the crypto apocalypse occur?" (undefined)
- "Will the economy collapse?" (what counts as collapse?)

CRITICAL FORMAT: Return a SINGLE XML response with ALL questions from ALL scenarios.

Return XML:
<response>
  <questions>
    <question>
      <id>1</id>
      <scenario>1</scenario>
      <text>Will [specific, observable event] happen?</text>
      <dramaPotential>8</dramaPotential>
      <uncertainty>7</uncertainty>
      <satiricalValue>9</satiricalValue>
      <observableOutcome>What exact event/announcement/action would prove YES</observableOutcome>
    </question>
    <question>
      <id>2</id>
      <scenario>1</scenario>
      <text>Another question for scenario 1...</text>
      <dramaPotential>7</dramaPotential>
      <uncertainty>6</uncertainty>
      <satiricalValue>8</satiricalValue>
      <observableOutcome>...</observableOutcome>
    </question>
    <question>
      <id>6</id>
      <scenario>2</scenario>
      <text>First question for scenario 2...</text>
      <dramaPotential>9</dramaPotential>
      <uncertainty>8</uncertainty>
      <satiricalValue>7</satiricalValue>
      <observableOutcome>...</observableOutcome>
    </question>
  </questions>
</response>

No other text.
`.trim()
});
