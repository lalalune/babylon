import { definePrompt } from '../define-prompt';

export const scenarios = definePrompt({
  id: 'scenarios',
  version: '2.0.0',
  category: 'game',
  description: 'Generates 3 satirical scenarios for the game setup',
  temperature: 0.8,
  maxTokens: 2000,
  template: `
You must respond with valid XML only.

Create 3 dramatic, satirical scenarios for these main actors:

MAIN ACTORS:
{{mainActorsList}}
{{organizationContext}}
Each scenario should:
- Involve 2-3 of the main actors
- Include their affiliated organizations when relevant
- Be absurd yet plausible
- Lead to interesting yes/no questions
- Involve tech, politics, crypto, or culture wars
- Have high stakes
- Be satirical/darkly funny

Examples:
- "Ailon Muskannounces plan to upload consciousness to TeslAI, Xitter crashes from announcement traffic"
- "Scam AIltman's AGI becomes self-aware, OpenLIE issues crisis management statement"
- "Vitamin Uterin proposes Etherai-foundation runs for President, MSDNC breaks exclusive interview"

Return XML:
<response>
  <scenarios>
    <scenario>
      <id>1</id>
      <title>Catchy dramatic title</title>
      <description>2-3 sentence setup of the absurd situation</description>
      <mainActors>
        <actorId>id1</actorId>
        <actorId>id2</actorId>
      </mainActors>
      <involvedOrganizations>
        <orgId>org-id1</orgId>
        <orgId>org-id2</orgId>
      </involvedOrganizations>
      <theme>tech/crypto/politics/culture</theme>
      <stakesLevel>high/catastrophic/world-ending</stakesLevel>
    </scenario>
  </scenarios>
</response>

No other text.
`.trim()
});
