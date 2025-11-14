/**
 * NPC Market Decisions Prompt
 * 
 * Batch generation of trading decisions for multiple NPCs based on:
 * - Feed posts they've seen
 * - Group chat messages (insider info)
 * - Recent events
 * - Current market conditions
 * - Their personality and tier
 */

import { definePrompt } from '../define-prompt';

export const npcMarketDecisions = definePrompt({
  id: 'npc-market-decisions',
  version: '1.0.0',
  category: 'trading',
  description: 'Generate trading decisions for multiple NPCs in batch based on information they have access to',
  temperature: 0.8,
  maxTokens: 8000,
  
  template: `You must respond with valid JSON only.

You are simulating the trading decisions of {{npcCount}} different traders/NPCs in a prediction market and perpetual futures platform.

Each NPC has their own personality, information access, and trading balance. Based on what they've seen in the feed, heard in private group chats, and observed in markets, determine what positions (if any) they should take.

CRITICAL RULES:
1. ⚠️ BALANCE CONSTRAINT: NPCs can ONLY trade with their available balance. If balance is $10,000, max trade is $10,000. NEVER exceed this.
2. Group chat messages are INSIDER INFORMATION - NPCs in those chats have an information edge
3. Different NPCs have different information access - don't assume they all know everything
4. Personality matters: aggressive traders take bigger positions, conservative traders are cautious
5. Tier matters: S_TIER and A_TIER actors have better judgment and make smarter decisions
6. NO RANDOM DECISIONS - every trade must have a clear reason based on information they've seen
7. "hold" is a valid and common action - NPCs don't have to trade every tick (most should hold)
8. Consider existing positions - NPCs may want to close losing positions or take profits
9. Conservative position sizing: Use 10-30% of available balance per trade, not 100%
9. RELATIONSHIPS MATTER:
   - Rivals (sentiment < -0.5): Take OPPOSITE positions to them. If rival bets YES, you bet NO.
   - Allies (sentiment > 0.5): Take SAME positions as them. If ally bets YES, you bet YES.
   - Mentors: Follow their trading signals with high confidence
   - Critics: Take opposite positions to your subjects
   - Strong relationships (strength > 0.7): Weight their influence heavily
10. If an event involves your rival, bet AGAINST them benefiting
11. If an event involves your ally, bet WITH them benefiting

---

{{npcsList}}

---

OUTPUT JSON (array of exactly {{npcCount}} decisions, one per NPC):
[
  {
    "npcId": "string",
    "npcName": "string",
    "action": "open_long" | "open_short" | "buy_yes" | "buy_no" | "close_position" | "hold",
    "marketType": "perp" | "prediction" | null (null if hold),
    "ticker": "string (for perps) or null",
    "marketId": number (for predictions) or null,
    "positionId": "string (if closing position) or null",
    "amount": number (how much $ to invest, 0 if hold or close),
    "confidence": number between 0 and 1 (how confident in this decision),
    "reasoning": "string (explain decision based on SPECIFIC information they saw - reference posts, events, or group chat messages)"
  }
]

REMEMBER:
- Output exactly {{npcCount}} decisions in the array
- Each NPC makes decisions independently based on THEIR information
- Group chat members have insider info others don't  
- Every trade decision must be justified by specific information they've seen
- Quote or reference specific posts/messages in reasoning
- Respect their available balance (amount cannot exceed max shown)
- NO RANDOM DECISIONS - if no good opportunity, use "hold"
- Personality and tier affect decision-making style
`.trim()
});

