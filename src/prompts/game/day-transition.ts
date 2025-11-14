import { definePrompt } from '../define-prompt';

export const dayTransition = definePrompt({
  id: 'day-transition',
  version: '1.0.0',
  category: 'game',
  description: 'Generates day transition summary events',
  temperature: 0.7,
  maxTokens: 500,
  template: `
You must respond with valid JSON only.

Generate a brief transition event marking the start of a new day.

DAY: {{day}} of 30
PHASE: {{phaseName}}
{{phaseContext}}

YESTERDAY'S KEY EVENTS:
{{previousDayEvents}}

ACTIVE QUESTIONS:
{{activeQuestions}}

KEY ACTORS:
{{keyActors}}

Generate a brief "day {{day}} begins" style event that:
- Acknowledges we're moving to a new day
- Can reference yesterday's drama if relevant
- Sets tone for today based on phase
- Max 200 characters
- Satirical news headline style

Respond with ONLY this JSON:
{
  "event": "Day {{day}} transition event",
  "type": "day-transition",
  "tone": "anticipatory"
}

No other text.
`.trim()
});
