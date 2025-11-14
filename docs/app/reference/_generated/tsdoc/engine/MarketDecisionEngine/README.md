[**babylon v0.1.0**](../../README.md)

***

[babylon](../../README.md) / engine/MarketDecisionEngine

# engine/MarketDecisionEngine

Market Decision Engine - NPC Trading Decision Generator

## Description

Generates autonomous trading decisions for all NPCs using LLM-powered analysis.
Creates realistic market behavior where NPCs trade based on information, relationships,
and personality rather than following predetermined patterns.

**Core Functionality:**
- Generates trading decisions for all trading-enabled NPCs
- Uses LLM to analyze market context and make human-like decisions
- Batches NPCs together to minimize LLM costs (90% reduction vs individual calls)
- Token-aware with automatic chunking for large batches
- Validates decisions against constraints (balance, market availability)

**Decision Types:**
- `open_long` / `open_short` - Open perpetual futures positions
- `buy_yes` / `buy_no` - Buy prediction market shares
- `close_position` - Close existing position
- `hold` - No action this tick

**Context Provided to LLM:**
- NPC profile (personality, tier, balance)
- Relationships with other NPCs (allies/rivals affect decisions)
- Recent posts and articles (public information)
- Group chat messages (insider information)
- Recent events (world developments)
- Available markets (perps and predictions)
- Current positions (P&L, sizing)

**Batching Strategy:**
- Groups NPCs into batches that fit token limits
- Typical: 5-15 NPCs per batch depending on context size
- Preserves individual context for each NPC
- LLM generates array of decisions (one per NPC)

**Validation:**
- Rejects trades exceeding NPC balance
- Verifies market/ticker existence
- Validates action types
- Checks position ownership for closes
- Returns only valid decisions

## See

 - TradeExecutionService - Executes validated decisions
 - [MarketContextService](../../lib/services/market-context-service/classes/MarketContextService.md) - Builds NPC context
 - GameEngine - Calls generateBatchDecisions() each tick

## Example

```typescript
const engine = new MarketDecisionEngine(llm, contextService);

// Generate decisions for all NPCs
const decisions = await engine.generateBatchDecisions();
// => [
//   { npcId: 'alice', action: 'buy_yes', marketId: 5, amount: 100, ... },
//   { npcId: 'bob', action: 'hold', ... },
//   { npcId: 'charlie', action: 'open_long', ticker: 'TECH', amount: 500, ... }
// ]

// Execute the trades
await tradeExecutionService.executeDecisionBatch(decisions);
```

## Classes

- [MarketDecisionEngine](classes/MarketDecisionEngine.md)
