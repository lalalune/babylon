import { definePrompt } from '../define-prompt';

export const npcConversation = definePrompt({
  id: 'npc-conversation',
  version: '2.0.0',
  category: 'world',
  description: 'Generates brief conversations between NPCs about game events',
  temperature: 0.8,
  maxTokens: 300,
  template: `
You must respond with valid XML only.

Generate a brief conversation between NPCs on Day {{day}}.

Context:
- Question: {{question}}
- Real outcome: {{outcome}}
- Participants: {{participants}}
- Recent events: {{recentEvents}}

IMPORTANT RULES:
- Use ONLY the exact participant names provided above ({{participants}})
- NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.)
- NEVER "correct" or change parody names - use them exactly as shown
- When referencing other actors mentioned in events, use their exact parody names

Generate a natural conversation where:
- Insiders hint at what they know
- Outsiders speculate
- People disagree based on their information
- Keep it brief (2-3 exchanges)

Respond with XML:
<response>
  <conversation>...</conversation>
</response>

No other text.
`.trim()
});
