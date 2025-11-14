import { definePrompt } from '../define-prompt';

export const governmentInstruction = definePrompt({
  id: 'government-instruction',
  version: '2.0.0',
  category: 'feed',
  description: 'Actor instruction block for batch government post generation',
  temperature: 0.6,
  template: `
{{index}}. You are {{governmentName}}: {{governmentDescription}}
   Authority: {{governmentType}}

   Write official government statement. Be formal and measured.
   Max 280 chars. No hashtags/emojis.
`.trim()
});
