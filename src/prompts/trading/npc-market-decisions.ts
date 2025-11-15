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
  version: '2.0.0',
  category: 'trading',
  description: 'Generate trading decisions for multiple NPCs in batch based on information they have access to',
  temperature: 0.8,
  maxTokens: 8000,
  
  template: `⚠️ CRITICAL: Respond ONLY with XML. Do NOT write reasoning or explanations. Start immediately with <decisions>

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
10. RELATIONSHIPS MATTER:
   - Rivals (sentiment < -0.5): Take OPPOSITE positions to them. If rival bets YES, you bet NO.
   - Allies (sentiment > 0.5): Take SAME positions as them. If ally bets YES, you bet YES.
   - Mentors: Follow their trading signals with high confidence
   - Critics: Take opposite positions to your subjects
   - Strong relationships (strength > 0.7): Weight their influence heavily
11. If an event involves your rival, bet AGAINST them benefiting
12. If an event involves your ally, bet WITH them benefiting

---

{{npcsList}}

---

VALUE RANGES:
- confidence: 0.0 (uncertain) to 1.0 (very certain)
- amount: number >= 0 (must be <= available balance, 0 if hold)

OUTPUT FORMAT - Start your response with this EXACT structure (no preamble):

⚠️ CRITICAL: Use the EXACT npcId from the NPC profile (the "ID:" field). Do NOT create new IDs or use names/slugs.

<decisions>
  <decision>
    <npcId>string</npcId>  <!-- MUST match the exact ID from the NPC profile above -->
    <npcName>string</npcName>
    <action>open_long | open_short | buy_yes | buy_no | close_position | hold</action>
    <marketType>perp | prediction | null</marketType>
    <ticker>string or null</ticker>
    <marketId>number or null</marketId>
    <positionId>string or null</positionId>
    <amount>number</amount>
    <confidence>0.0 to 1.0</confidence>
    <reasoning>Brief reason based on specific information</reasoning>
  </decision>
  ... repeat for all {{npcCount}} NPCs ...
</decisions>

⚠️ FORMAT REQUIREMENTS:
- Your FIRST character must be '<' (start XML immediately)
- Your LAST character must be '>' (end XML)
- NO text before <decisions> tag
- NO text after </decisions> tag
- NO explanations like "Okay, let's see..." or "Here is the XML..."
- NO thinking process - just output the XML directly
- Exactly {{npcCount}} <decision> elements inside <decisions> root

DECISION RULES:
- Each NPC decides independently based on THEIR information access
- Respect available balance (amount <= balance shown)
- Group chat = insider info edge
- Relationships matter: rivals bet opposite, allies bet same
- "hold" is valid - most NPCs should hold if no clear opportunity
- Personality and tier affect risk-taking
- ⚠️ CRITICAL: Use the EXACT npcId from the "ID:" field in each NPC's profile. Do NOT invent IDs or use slugified names.
`.trim()
});

