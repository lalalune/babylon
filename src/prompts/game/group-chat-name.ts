import { definePrompt } from '../define-prompt';

export const groupChatName = definePrompt({
  id: 'group-chat-names',
  version: '2.0.0',
  category: 'game',
  description: 'Generates satirical group chat names',
  temperature: 0.9,
  maxTokens: 500,
  template: `
You must respond with valid XML only.

Generate a funny, satirical group chat name for this private group.

ADMIN (group creator): {{adminName}}
- Role: {{adminRole}}
- Domain: {{domain}}
- Affiliations: {{adminAffiliations}}

MEMBERS:
{{memberDescriptions}}

The group chat name should:
1. Be satirical and darkly funny (like "silicon valley trauma support" or "ponzi schemers united")
2. Reference the domain ({{domain}}) or the members' shared context
3. Feel like an inside joke between these specific people
4. Be 2-6 words long
5. Use lowercase
6. Be something these wealthy, powerful, slightly dysfunctional people would ironically name their private chat

Examples for inspiration (but make it unique to THIS group):
- "billionaire brunch club"
- "regulatory capture squad"
- "metaverse disasters anonymous"
- "crypto widows & orphans"

Return ONLY this XML:
<response>
  <name>the group chat name here</name>
</response>

No other text.
`.trim()
});
