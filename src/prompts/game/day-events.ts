import { definePrompt } from '../define-prompt';

export const dayEvents = definePrompt({
  id: 'event-descriptions',
  version: '2.0.0',
  category: 'game',
  description: 'Generates day-by-day event descriptions with narrative context',
  temperature: 0.9,
  maxTokens: 5000,
  template: `
You must respond with valid XML only.

{{fullContext}}

━━━ GENERATE DAY {{day}} EVENTS ━━━

{{phaseContext}}

{{relationshipContext}}

{{organizationBehaviorContext}}

Generate {{eventCount}} events:

{{eventRequestsList}}

Return XML with events and whether they point toward outcomes:
<response>
  <events>
    <event>
      <eventNumber>1</eventNumber>
      <description>OpenLIE schedules independent verification demo for next week</description>
      <pointsToward>YES</pointsToward>
    </event>
    <event>
      <eventNumber>2</eventNumber>
      <description>Etherai-foundation FoundAItion delays security patch citing testing issues</description>
      <pointsToward>NO</pointsToward>
    </event>
  </events>
</response>

Return EXACTLY {{eventCount}} events.
`.trim()
});
