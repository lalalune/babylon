import { definePrompt } from '../define-prompt';

export const questionResolutionValidation = definePrompt({
  id: 'question-resolution-validation',
  version: '1.0.0',
  category: 'game',
  description: 'Generates resolution event that definitively proves question outcome',
  temperature: 0.7,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

You are generating a resolution event for a prediction market question.

QUESTION: {{questionText}}
PREDETERMINED OUTCOME: {{outcome}}
HISTORY: {{eventHistory}}{{contextInfo}}

Generate a definitive resolution event that PROVES the {{outcome}} outcome.

Requirements:
- Must be concrete and observable
- Must definitively resolve the question
- {{outcomeContext}}
- Should involve relevant actors or companies from context
- One sentence, max 150 characters
- Satirical but plausible

Respond with ONLY this JSON:
{
  "event": "Your resolution event description",
  "type": "announcement"
}

No other text.
`.trim()
});
