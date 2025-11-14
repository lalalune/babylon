import { definePrompt } from '../define-prompt';

export const expertAnalysis = definePrompt({
  id: 'expert-analysis',
  version: '1.0.0',
  category: 'world',
  description: 'Generates expert analysis from NPCs with domain expertise',
  temperature: 0.7,
  maxTokens: 200,
  template: `
Generate expert analysis from {{expertName}}.

Context:
- Question: {{question}}
- Real outcome: {{outcome}}
- Expert: {{expertName}} ({{expertRole}}, knows truth: {{knowsTruth}}, reliability: {{reliability}})
- Recent events: {{recentEvents}}

Generate analysis that:
- Sounds authoritative and expert-like
- {{confidenceContext}}
- Reflects expert's reliability ({{reliabilityContext}})

Respond with JSON: { "analysis": "..." }
`.trim()
});
