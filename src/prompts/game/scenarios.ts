import { definePrompt } from '../define-prompt';

export const scenarios = definePrompt({
  id: 'scenarios',
  version: '1.0.0',
  category: 'game',
  description: 'Generates 3 satirical scenarios for the game setup',
  temperature: 0.8,
  maxTokens: 2000,
  template: `
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
- "Ailon Muskannounces plan to upload consciousness to Tesla, Xitter crashes from announcement traffic"
- "Scam Altman's AGI becomes self-aware, OpenLIE issues crisis management statement"
- "Vitamin Uterin proposes Ethereum runs for President, MSDNC breaks exclusive interview"

Return JSON:
{
  "scenarios": [
    {
      "id": 1,
      "title": "Catchy dramatic title",
      "description": "2-3 sentence setup of the absurd situation",
      "mainActors": ["id1", "id2"],
      "involvedOrganizations": ["org-id1", "org-id2"],
      "theme": "tech/crypto/politics/culture",
      "stakesLevel": "high/catastrophic/world-ending"
    }
  ]
}
`.trim()
});
