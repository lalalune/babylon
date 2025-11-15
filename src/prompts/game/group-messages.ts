import { definePrompt } from '../define-prompt';

export const groupMessages = definePrompt({
  id: 'group-messages',
  version: '2.0.0',
  category: 'game',
  description: 'Generates private group chat messages for the day',
  temperature: 1,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

{{fullContext}}{{scenarioContext}}{{questionContext}}

━━━ PRIVATE GROUP CHATS FOR DAY {{day}} ━━━

This is PRIVATE. Members say things here they would NEVER say publicly:
- Vulnerabilities, fears, doubts
- Real insider knowledge about their companies
- Strategic planning and market manipulation
- Gossip about people outside the group
- Honest reactions vs their public persona
- SPECIFIC trading positions and intentions
- Coordination of attacks on rivals
- Insider data (revenues, deals, failures)
- What they're REALLY doing vs what they say publicly

IMPORTANT RULES:
- Use ONLY the exact actor names provided in the context above
- NEVER use real names (Elon Musk, Sam Altman, Mark Zuckerberg, Vitalik Buterin, etc.)
- NEVER "correct" or change parody names - use them exactly as shown
- When referencing other actors, use their exact parody names from the game world

Today's events: {{eventsList}}
{{recentEventContext}}

Generate {{groupCount}} private group conversations:

{{groupsList}}

Respond with ONLY this XML:
<response>
  <groups>
    <group>
      <groupId>group-id</groupId>
      <messages>
        <message>
          <actorId>actor-id</actorId>
          <content>private message here</content>
        </message>
      </messages>
    </group>
  </groups>
</response>

Return {{groupCount}} groups in the array. No other text.
`.trim()
});
