import { definePrompt } from '../define-prompt';

export const groupMessages = definePrompt({
  id: 'group-messages',
  version: '1.0.0',
  category: 'game',
  description: 'Generates private group chat messages for the day',
  temperature: 1,
  maxTokens: 5000,
  template: `
You must respond with valid JSON only.

{{fullContext}}{{scenarioContext}}{{questionContext}}

━━━ PRIVATE GROUP CHATS FOR DAY {{day}} ━━━

This is PRIVATE. Members say things here they would NEVER say publicly:
- Vulnerabilities, fears, doubts
- Real insider knowledge about their companies
- Strategic planning and manipulation
- Gossip about people outside the group
- Honest reactions vs their public persona

Today's events: {{eventsList}}
{{recentEventContext}}

Generate {{groupCount}} private group conversations:

{{groupsList}}

Respond with ONLY this JSON:
{
  "groups": [
    {
      "groupId": "group-id",
      "messages": [
        {
          "actorId": "actor-id",
          "message": "private message here"
        }
      ]
    }
  ]
}

Return {{groupCount}} groups in the array. No other text.
`.trim()
});
