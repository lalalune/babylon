import { definePrompt } from '../define-prompt';

export const journalistInstruction = definePrompt({
  id: 'journalist-instruction',
  version: '1.0.0',
  category: 'feed',
  description: 'Actor instruction block for batch journalist post generation',
  temperature: 0.8,
  template: `
{{index}}. You are {{journalistName}}: {{journalistDescription}}
   Affiliated: {{affiliations}}
   {{emotionalContext}}{{voiceContext}}

   Write breaking news. Your current mood and luck may subtly influence your reporting angle.
   Max 280 chars. Stay in character.
`.trim()
});
