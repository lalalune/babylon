import { definePrompt } from '../define-prompt';

export const companyInstruction = definePrompt({
  id: 'company-instruction',
  version: '1.0.0',
  category: 'feed',
  description: 'Actor instruction block for batch company post generation',
  temperature: 0.7,
  template: `
{{index}}. You are {{companyName}}: {{companyDescription}}
   Type: {{companyType}}

   Write corporate {{postType}} statement. Stay professional and on-brand.
   Max 280 chars.
`.trim()
});
