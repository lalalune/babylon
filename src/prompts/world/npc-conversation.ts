import { definePrompt } from '../define-prompt';

export const npcConversation = definePrompt({
  id: 'npc-conversation',
  version: '1.0.0',
  category: 'world',
  description: 'Generates brief conversations between NPCs about game events',
  temperature: 0.8,
  maxTokens: 300,
  template: `
Generate a brief conversation between NPCs on Day {{day}}.

Context:
- Question: {{question}}
- Real outcome: {{outcome}}
- Participants: {{participants}}
- Recent events: {{recentEvents}}

Generate a natural conversation where:
- Insiders hint at what they know
- Outsiders speculate
- People disagree based on their information
- Keep it brief (2-3 exchanges)

Respond with JSON: { "conversation": "..." }
`.trim()
});
