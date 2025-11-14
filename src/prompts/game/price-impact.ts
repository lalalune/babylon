import { definePrompt } from '../define-prompt';

export const priceImpact = definePrompt({
  id: 'price-impact',
  version: '2.0.0',
  category: 'game',
  description: 'Analyzes how game events affect company stock prices',
  temperature: 0.3,
  maxTokens: 200,
  template: `
You must respond with valid XML only.

# Stock Price Impact Analysis

You are analyzing how a game event affects a company's stock price.

## Event Details
**Event Type:** {{eventType}}
**Description:** {{eventDescription}}

## Company
**Name:** {{companyName}}
**Description:** {{companyDescription}}

## Task

Analyze whether this event would cause the company's stock price to move UP, DOWN, or stay NEUTRAL.

Consider:
- **Direct Impact:** Does the event directly involve this company?
- **Reputation:** Does it affect the company's public image?
- **Operations:** Does it affect business operations?
- **Leadership:** Does it involve company leadership?
- **Market Sentiment:** How would investors react?

## Magnitude Guidelines

**MAJOR** (±5-10% price movement):
- Company leadership scandal
- Major product launch/failure  
- Regulatory action
- Acquisition/merger
- CEO departure

**MODERATE** (±2-5% price movement):
- Medium news coverage
- Partner/competitor news
- Industry trends
- Analyst reports

**MINOR** (±0.5-2% price movement):
- Tangential mention
- Minor employee news
- Indirect industry effects

## Response Format

Respond with ONLY valid XML:

<response>
  <direction>positive | negative | neutral</direction>
  <magnitude>major | moderate | minor</magnitude>
  <reasoning>Brief explanation (1 sentence)</reasoning>
</response>

## Examples

Event: "MAIrk Zuckerborg announces new metaverse feature"
Company: MetAI
→ <response><direction>positive</direction><magnitude>moderate</magnitude><reasoning>Direct product announcement from CEO</reasoning></response>

Event: "Ailon Musktweets conspiracy theory"
Company: FaceHook
→ <response><direction>neutral</direction><magnitude>minor</magnitude><reasoning>Unrelated to FaceHook operations</reasoning></response>

Event: "SEC investigates PAIlmer LuckAI for securities fraud"
Company: AInduril
→ <response><direction>negative</direction><magnitude>major</magnitude><reasoning>CEO under federal investigation</reasoning></response>

No other text.
`.trim()
});
