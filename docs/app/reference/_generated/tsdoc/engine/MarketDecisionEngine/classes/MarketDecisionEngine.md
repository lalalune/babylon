[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/MarketDecisionEngine](../README.md) / MarketDecisionEngine

# Class: MarketDecisionEngine

Defined in: [src/engine/MarketDecisionEngine.ts:118](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/MarketDecisionEngine.ts#L118)

Market Decision Engine

 MarketDecisionEngine

## Description

Generates trading decisions for NPCs using LLM-powered market analysis.
Automatically handles batching and token management to process all NPCs
efficiently while staying within model context limits.

**Key Responsibilities:**
- Generate realistic trading decisions based on NPC context
- Batch NPCs to minimize LLM API costs
- Manage token budgets automatically
- Validate all decisions against constraints
- Handle both individual and batch generation

**Architecture:**
- Uses `gpt-4o-mini` by default for reliability
- Dynamically calculates batch sizes based on token limits
- Falls back to individual processing if batches fail
- Strict validation prevents invalid trades

## Usage

Created once by GameEngine and called each tick to generate NPC trading decisions.

## Constructors

### Constructor

> **new MarketDecisionEngine**(`llm`, `contextService`, `options`): `MarketDecisionEngine`

Defined in: [src/engine/MarketDecisionEngine.ts:157](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/MarketDecisionEngine.ts#L157)

Create a new MarketDecisionEngine

#### Parameters

##### llm

`BabylonLLMClient`

Babylon LLM client for decision generation

##### contextService

[`MarketContextService`](../../../lib/services/market-context-service/classes/MarketContextService.md)

Service for building NPC market context

##### options

Optional configuration overrides

###### model?

`string`

LLM model to use (default: 'gpt-4o-mini')

###### maxOutputTokens?

`number`

Maximum tokens for response (default: 4000)

#### Returns

`MarketDecisionEngine`

#### Description

Initializes the engine with token management configuration. Automatically
calculates safe context limits based on model and output requirements.

**Model Selection:**
- Default: `gpt-4o-mini` (reliable, tested, fast)
- Groq models avoid due to naming inconsistencies
- Can override but must handle token limits carefully

**Token Budget:**
- Automatically calculated from model limits
- Reserves space for output tokens
- Estimates ~400 tokens per NPC context
- Safely handles 5-15 NPCs per batch typically

#### Example

```typescript
const engine = new MarketDecisionEngine(
  llmClient,
  contextService,
  { 
    model: 'gpt-4o-mini',
    maxOutputTokens: 4000 
  }
);
```

## Methods

### generateBatchDecisions()

> **generateBatchDecisions**(): `Promise`\<`TradingDecision`[]\>

Defined in: [src/engine/MarketDecisionEngine.ts:222](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/MarketDecisionEngine.ts#L222)

Generate trading decisions for all NPCs

#### Returns

`Promise`\<`TradingDecision`[]\>

Array of validated trading decisions

#### Description

Main entry point for NPC decision generation. Automatically handles:
- Fetching context for all trading-enabled NPCs
- Splitting into batches if needed for token limits
- Generating decisions via LLM
- Validating all decisions
- Fallback to individual processing on batch failure

**Process:**
1. Fetch context for all NPCs via MarketContextService
2. Calculate batch size based on token budget
3. Process NPCs in batches via LLM
4. Validate each decision against constraints
5. Return only valid decisions

**Performance:**
- Typical: 1-3 LLM calls for 50 NPCs
- Fallback: Individual calls if batching fails
- ~2-5 seconds for full decision generation

**Error Handling:**
- Batch failures trigger individual retry
- Individual failures logged but don't fail entire generation
- Always returns best-effort decision array

#### Example

```typescript
const decisions = await engine.generateBatchDecisions();

console.log(`Generated ${decisions.length} decisions`);
console.log(`Trades: ${decisions.filter(d => d.action !== 'hold').length}`);
console.log(`Holds: ${decisions.filter(d => d.action === 'hold').length}`);
```

***

### generateDecisionsForNPCs()

> **generateDecisionsForNPCs**(`npcIds`): `Promise`\<`TradingDecision`[]\>

Defined in: [src/engine/MarketDecisionEngine.ts:286](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/MarketDecisionEngine.ts#L286)

Generate decisions for specific NPCs

#### Parameters

##### npcIds

`string`[]

#### Returns

`Promise`\<`TradingDecision`[]\>

***

### generateSingleDecision()

> **generateSingleDecision**(`npcId`): `Promise`\<`TradingDecision`\>

Defined in: [src/engine/MarketDecisionEngine.ts:656](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/MarketDecisionEngine.ts#L656)

Fallback: Generate decision for a single NPC

#### Parameters

##### npcId

`string`

#### Returns

`Promise`\<`TradingDecision`\>
