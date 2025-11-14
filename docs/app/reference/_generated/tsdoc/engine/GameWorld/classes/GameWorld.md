[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/GameWorld](../README.md) / GameWorld

# Class: GameWorld

Defined in: [src/engine/GameWorld.ts:278](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L278)

Game World Generator

 GameWorld

## Description

Creates autonomous game worlds with NPCs, events, and narratives that agents
observe and bet on. Generates complete 30-day story arcs with predetermined
outcomes that unfold naturally through events and social interactions.

**Architecture:**
- Extends EventEmitter for real-time event streaming
- Uses FeedGenerator for social media simulation
- Optional LLM for rich content (falls back to templates)
- Deterministic outcome with organic information reveals

**Events Emitted:**
- `world:started` - World generation begins
- `day:begins` - New day starts
- `npc:action` - NPC takes action
- `npc:conversation` - NPCs converse
- `news:published` - News article published
- `rumor:spread` - Rumor circulates
- `clue:revealed` - Information revealed
- `development:occurred` - Development happens
- `outcome:revealed` - Final outcome revealed
- `world:ended` - Generation complete
- `feed:post` - Social media post created

**NPC Roles:**
- insider: Knows truth, high reliability
- expert: Analytical, moderate reliability
- journalist: Reports news, moderate reliability
- whistleblower: Reveals secrets, high reliability
- politician: Public statements, low reliability
- deceiver: Spreads misinformation, very low reliability

## Usage

Used for testing and simulation. GameEngine uses different architecture.

## Example

```typescript
const world = new GameWorld({ outcome: true, numNPCs: 10 }, llm);

world.on('feed:post', (post) => {
  console.log(`@${post.authorName}: ${post.content}`);
});

world.on('day:begins', (event) => {
  console.log(`--- Day ${event.data.day} ---`);
});

const result = await world.generate();
console.log(`Generated ${result.events.length} events over ${result.timeline.length} days`);
```

## Extends

- `EventEmitter`

## Constructors

### Constructor

> **new GameWorld**(`config`, `llm?`): `GameWorld`

Defined in: [src/engine/GameWorld.ts:305](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L305)

Create a new GameWorld generator

#### Parameters

##### config

[`WorldConfig`](../interfaces/WorldConfig.md)

World configuration options

##### llm?

`BabylonLLMClient`

Optional LLM client for rich content generation

#### Returns

`GameWorld`

#### Description

Initializes world generator with configuration. If LLM is provided, generates
rich, contextual content. Otherwise falls back to template-based generation.

#### Example

```typescript
// With LLM (rich content)
const world = new GameWorld({ outcome: true }, llmClient);

// Without LLM (template-based)
const world = new GameWorld({ outcome: false });
```

#### Overrides

`EventEmitter.constructor`

## Methods

### generate()

> **generate**(): `Promise`\<[`WorldState`](../interfaces/WorldState.md)\>

Defined in: [src/engine/GameWorld.ts:393](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameWorld.ts#L393)

Generate complete game world simulation

#### Returns

`Promise`\<[`WorldState`](../interfaces/WorldState.md)\>

Complete world state with 30-day timeline, events, and NPCs

#### Throws

Never throws - handles errors internally and uses fallbacks

#### Description

Generates a complete 30-day narrative world from start to finish. This is the
"actual reality" that agents observe through the social feed and bet on.

**Generation Process:**
1. **Setup**
   - Generate prediction question
   - Create NPCs with roles and reliability
   - Emit 'world:started' event

2. **Daily Generation** (30 days)
   - Generate phase-appropriate events (early/mid/late)
   - Generate feed posts from events (via FeedGenerator)
   - Generate group chat messages
   - Generate day summary
   - Calculate public sentiment
   - Emit events for monitoring

3. **Resolution**
   - Emit 'outcome:revealed' event
   - Finalize world state

**Event Generation:**
- Uses LLM for rich, contextual content
- Falls back to templates if LLM unavailable
- Events become more specific toward outcome as days progress

**Feed Generation:**
- NPCs react to events via FeedGenerator
- Posts include news, reactions, analysis, conspiracy theories
- Sentiment calculated from all posts

**What Agents See:**
- Feed posts (filtered view of events)
- Public events only (not secret meetings)
- NPC statements (may be misleading)
- News coverage (may be biased)

**What Agents DON'T See:**
- Predetermined outcome
- NPC reliability scores
- Truth values of statements
- Secret events

#### Usage

Used for testing, simulation, and offline world generation.

#### Example

```typescript
const world = new GameWorld({ outcome: true, numNPCs: 10 }, llm);

const state = await world.generate();

console.log(`Question: ${state.question}`);
console.log(`Truth: ${state.outcome ? 'YES' : 'NO'}`);
console.log(`NPCs: ${state.npcs.length}`);
console.log(`Events: ${state.events.length}`);
console.log(`Days: ${state.timeline.length}`);

// Analyze sentiment progression
state.timeline.forEach(day => {
  console.log(`Day ${day.day}: ${day.summary}`);
  console.log(`  Sentiment: ${day.publicSentiment.toFixed(2)}`);
  console.log(`  Events: ${day.events.length}`);
  console.log(`  Posts: ${day.feedPosts?.length || 0}`);
});
```
