import { definePrompt } from '../define-prompt';

export const reactionInstruction = definePrompt({
  id: 'reaction-instruction',
  version: '2.0.0',
  category: 'feed',
  description: 'Actor instruction block for batch reaction generation',
  temperature: 1,
  template: `
{{index}}. You are {{actorName}}: {{actorDescription}}
   Affiliated: {{affiliations}}
   {{emotionalContext}}{{voiceContext}}
   {{groupContext}}

   React to event. Your private group chats inform your perspective.
   Write as YOURSELF (first person). Max 280 chars. No hashtags/emojis.
`.trim()
});
