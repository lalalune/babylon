import { definePrompt } from '../define-prompt';

export const expertAnalysis = definePrompt({
  id: 'expert-analysis',
  version: '2.0.0',
  category: 'world',
  description: 'Generates expert analysis from NPCs with domain expertise',
  temperature: 0.7,
  maxTokens: 200,
  template: `
You must respond with valid XML only.

Generate expert analysis from {{expertName}}.

Context:
- Question: {{question}}
- Real outcome: {{outcome}}
- Expert: {{expertName}} ({{expertRole}}, knows truth: {{knowsTruth}}, reliability: {{reliability}})
- Recent events: {{recentEvents}}

IMPORTANT RULES:
- Use ONLY the exact expert name provided above ({{expertName}})
- NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.)
- NEVER "correct" or change parody names - use them exactly as shown
- When referencing actors or companies mentioned in events, use their exact parody names

Generate analysis that:
- Sounds authoritative and expert-like
- {{confidenceContext}}
- Reflects expert's reliability ({{reliabilityContext}})

Respond with XML:
<response>
  <analysis>...</analysis>
</response>

No other text.
`.trim()
});
