[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/FeedGenerator](../README.md) / FeedGenerator

# Class: FeedGenerator

Defined in: [src/engine/FeedGenerator.ts:204](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L204)

Feed Generator

 FeedGenerator

## Description

Transforms world events into organic social media discourse using LLM-powered
content generation. Creates realistic feed cascades where different actors react
to events based on their personality, emotional state, and relationships.

**Architecture:**
- Stateful: Maintains actor moods, relationships, organizations
- Batched LLM calls for 90% cost reduction
- Retry logic for reliability
- Validation for content quality

**State Management:**
- Actor emotional states (mood, luck)
- Relationship graph (allies, rivals, etc.)
- Organization affiliations
- Group chat context for insider perspectives

**Content Types Generated:**
- News breaking (media orgs, journalists)
- Direct reactions (involved parties)
- Company PR (corporate responses)
- Government statements (regulatory responses)
- Expert commentary (outside analysis)
- Conspiracy theories (contrarian takes)
- Thread replies (conversations)
- Ambient posts (general musings)

## Usage

Instantiated by GameEngine and GameWorld for feed generation.

## Extends

- `EventEmitter`

## Constructors

### Constructor

> **new FeedGenerator**(`llm?`): `FeedGenerator`

Defined in: [src/engine/FeedGenerator.ts:220](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L220)

Create a new FeedGenerator

#### Parameters

##### llm?

`BabylonLLMClient`

Optional LLM client for content generation

#### Returns

`FeedGenerator`

#### Description

If LLM is not provided, generation methods will return empty arrays or throw.
In production, always provide an LLM client.

#### Overrides

`EventEmitter.constructor`

## Methods

### setActorGroupContexts()

> **setActorGroupContexts**(`contexts`): `void`

Defined in: [src/engine/FeedGenerator.ts:246](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L246)

Set actor group chat contexts

#### Parameters

##### contexts

`Map`\<`string`, `string`\>

Map of actorId to group chat context string

#### Returns

`void`

#### Description

Group chat context includes all groups the actor is in plus recent messages.
This context influences their public posts (e.g., "my sources say...").

#### Usage

Called by GameEngine before each feed generation.

#### Example

```typescript
const contexts = new Map([
  ['actor-1', 'Member of: Tech Insiders, Wall Street Pros\nRecent: "Merger looking good"'],
  ['actor-2', 'Member of: Political Circle\nRecent: "Investigation ongoing"']
]);
feed.setActorGroupContexts(contexts);
```

***

### setOrganizations()

> **setOrganizations**(`organizations`): `void`

Defined in: [src/engine/FeedGenerator.ts:262](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L262)

Set organizations for this game

#### Parameters

##### organizations

[`Organization`](../interfaces/Organization.md)[]

Array of all game organizations

#### Returns

`void`

#### Description

Organizations include media companies, tech companies, government agencies, etc.
Used for generating company responses and determining affiliations.

#### Usage

Called once during GameEngine initialization.

***

### setActorStates()

> **setActorStates**(`states`): `void`

Defined in: [src/engine/FeedGenerator.ts:287](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L287)

Set actor emotional states for current day

#### Parameters

##### states

`Map`\<`string`, [`ActorState`](../interfaces/ActorState.md)\>

Map of actorId to emotional state (mood, luck)

#### Returns

`void`

#### Description

Actor states are updated daily based on events and trading outcomes.
These states influence post tone, sentiment, and content.

#### Usage

Called by GameEngine each day before feed generation.

#### Example

```typescript
const states = new Map([
  ['actor-1', { mood: 0.8, luck: 'high' }],
  ['actor-2', { mood: -0.5, luck: 'low' }]
]);
feed.setActorStates(states);
```

***

### setRelationships()

> **setRelationships**(`relationships`): `void`

Defined in: [src/engine/FeedGenerator.ts:309](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L309)

Set relationships between actors

#### Parameters

##### relationships

Array of actor relationships (supports both formats)

[`ActorRelationship`](../interfaces/ActorRelationship.md)[] | `ActorConnection`[]

#### Returns

`void`

#### Description

Relationships affect how actors reference each other in posts and reactions.
Supports both ActorRelationship (new) and ActorConnection (legacy) formats
for backward compatibility.

**Relationship Effects:**
- Rivals: Critical, competitive posts
- Allies: Supportive, collaborative posts
- Neutral: Objective, balanced posts

#### Usage

Called once during GameEngine initialization and updated as relationships evolve.

***

### generateDayFeed()

> **generateDayFeed**(`day`, `worldEvents`, `allActors`, `outcome`): `Promise`\<[`FeedPost`](../interfaces/FeedPost.md)[]\>

Defined in: [src/engine/FeedGenerator.ts:375](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L375)

Generate complete feed for a game day

#### Parameters

##### day

`number`

Game day number (1-30)

##### worldEvents

[`WorldEvent`](../../GameWorld/interfaces/WorldEvent.md)[]

Events that occurred this day

##### allActors

[`Actor`](../interfaces/Actor.md)[]

All game actors

##### outcome

`boolean`

Predetermined question outcome (for narrative coherence)

#### Returns

`Promise`\<[`FeedPost`](../interfaces/FeedPost.md)[]\>

Array of feed posts sorted chronologically

#### Description

Generates a full day's worth of social media activity by creating cascading
reactions to world events. Simulates realistic information flow where events
trigger media coverage, reactions, analysis, and discussions.

**Information Cascade (Like Real Social Media):**
1. **Event Occurs** - WorldEvent happens (players never see directly)
2. **Media Breaks Story** - Journalists and news orgs report
3. **Involved Parties React** - Defensive if bad, celebratory if good
4. **Companies Respond** - PR statements from affiliated orgs
5. **Experts Analyze** - Outside commentators weigh in
6. **Conspiracy Theories** - Contrarians spin wild narratives
7. **Threads Develop** - Replies and conversations emerge
8. **Ambient Noise** - Unrelated posts throughout the day

**Generation Process:**
- For each event: Generate full cascade (2-4 batched LLM calls)
- Add ambient posts for each hour (24 batched LLM calls)
- Generate replies to 30-50% of posts (batched)
- Sort by timestamp for chronological feed

**Batching Optimization:**
- Event cascade: 4-5 LLM calls (vs 10-15 individual)
- Ambient: 24 calls (vs 200+ individual)
- Total: ~200 calls per game (vs 2000+)
- 90% cost reduction, same quality

**Content Quality:**
- 100% LLM-generated (no templates)
- Per-actor context preserved in batches
- Mood, luck, relationships affect content
- Group chat insights reflected in posts

**Outcome Parameter:**
Used for narrative coherence and atmospheric context, not for determining
event truthfulness (events have their own pointsToward values).

#### Example

```typescript
const posts = await feed.generateDayFeed(
  15, // Day 15
  [event1, event2, event3], // World events
  allActors,
  true // Outcome is YES (for narrative coherence)
);

console.log(`Generated ${posts.length} posts for Day 15`);

// Posts are sorted chronologically
posts.forEach(post => {
  console.log(`${post.timestamp}: @${post.authorName} - ${post.content}`);
});
```

***

### generateJournalistPost()

> **generateJournalistPost**(`journalist`, `event`, `outcome`): `Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

Defined in: [src/engine/FeedGenerator.ts:932](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L932)

Generate journalist breaking news post
Journalists report events objectively (with slight bias)
Public for external use and testing

#### Parameters

##### journalist

[`Actor`](../interfaces/Actor.md)

##### event

[`WorldEvent`](../../GameWorld/interfaces/WorldEvent.md)

##### outcome

`boolean`

#### Returns

`Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

***

### generateMediaPost()

> **generateMediaPost**(`media`, `event`, `allActors`, `outcome`): `Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

Defined in: [src/engine/FeedGenerator.ts:990](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L990)

Generate media organization post
Media breaks stories with bias, often citing anonymous sources
Public for external use and testing

#### Parameters

##### media

[`Organization`](../interfaces/Organization.md)

##### event

[`WorldEvent`](../../GameWorld/interfaces/WorldEvent.md)

##### allActors

[`Actor`](../interfaces/Actor.md)[]

##### outcome

`boolean`

#### Returns

`Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

***

### generateDirectReaction()

> **generateDirectReaction**(`actor`, `event`, `outcome`): `Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

Defined in: [src/engine/FeedGenerator.ts:1227](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L1227)

Generate direct reaction from involved party
Defensive if bad, celebratory if good, motivated by self-interest
Public for external use and testing
Uses event.pointsToward when available, outcome for narrative coherence otherwise

#### Parameters

##### actor

[`Actor`](../interfaces/Actor.md)

##### event

[`WorldEvent`](../../GameWorld/interfaces/WorldEvent.md)

##### outcome

`boolean`

#### Returns

`Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

***

### generateCommentary()

> **generateCommentary**(`actor`, `event`, `outcome`): `Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

Defined in: [src/engine/FeedGenerator.ts:1307](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L1307)

Generate expert/commentator analysis
Outsiders analyzing what happened
Public for external use and testing

#### Parameters

##### actor

[`Actor`](../interfaces/Actor.md)

##### event

[`WorldEvent`](../../GameWorld/interfaces/WorldEvent.md)

##### outcome

`boolean`

#### Returns

`Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

***

### generateConspiracyPost()

> **generateConspiracyPost**(`actor`, `event`, `outcome`): `Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

Defined in: [src/engine/FeedGenerator.ts:1380](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L1380)

Generate conspiracy theory / wild spin
These actors create alternative narratives
Public for external use and testing

#### Parameters

##### actor

[`Actor`](../interfaces/Actor.md)

##### event

[`WorldEvent`](../../GameWorld/interfaces/WorldEvent.md)

##### outcome

`boolean`

#### Returns

`Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

***

### generateAmbientPost()

> **generateAmbientPost**(`actor`, `day`, `outcome`): `Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

Defined in: [src/engine/FeedGenerator.ts:1785](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L1785)

Generate ambient post (general musing, not tied to events)
Public for external use and testing

#### Parameters

##### actor

[`Actor`](../interfaces/Actor.md)

##### day

`number`

##### outcome

`boolean`

#### Returns

`Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

***

### generateEconomicFeedPosts()

> **generateEconomicFeedPosts**(`priceUpdate`, `company`, `day`, `allActors`): `Promise`\<[`FeedPost`](../interfaces/FeedPost.md)[]\>

Defined in: [src/engine/FeedGenerator.ts:1864](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L1864)

Generate feed posts for stock price movements
Creates company announcements, ticker posts, and analyst reactions
Public for external use by price engines

#### Parameters

##### priceUpdate

`PriceUpdate`

##### company

[`Organization`](../interfaces/Organization.md)

##### day

`number`

##### allActors

[`Actor`](../interfaces/Actor.md)[]

#### Returns

`Promise`\<[`FeedPost`](../interfaces/FeedPost.md)[]\>

***

### generateDayTransitionPost()

> **generateDayTransitionPost**(`day`, `previousDayEvents`, `questions`, `allActors`): `Promise`\<[`FeedPost`](../interfaces/FeedPost.md) \| `null`\>

Defined in: [src/engine/FeedGenerator.ts:1992](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L1992)

Generate a day transition post marking the start of a new day
Creates a narrative summary that acknowledges the previous day and sets tone for today
Public for external use by game generators

#### Parameters

##### day

`number`

##### previousDayEvents

[`WorldEvent`](../../GameWorld/interfaces/WorldEvent.md)[]

##### questions

`Question`[]

##### allActors

[`Actor`](../interfaces/Actor.md)[]

#### Returns

`Promise`\<[`FeedPost`](../interfaces/FeedPost.md) \| `null`\>

***

### generateQuestionResolutionPost()

> **generateQuestionResolutionPost**(`question`, `resolutionEventDescription`, `day`, `winningPercentage`): `Promise`\<[`FeedPost`](../interfaces/FeedPost.md) \| `null`\>

Defined in: [src/engine/FeedGenerator.ts:2060](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L2060)

Generate a feed post announcing a question resolution
Creates a public announcement when a prediction market question resolves
Public for external use by game generators

#### Parameters

##### question

`Question`

##### resolutionEventDescription

`string`

##### day

`number`

##### winningPercentage

`number` = `50`

#### Returns

`Promise`\<[`FeedPost`](../interfaces/FeedPost.md) \| `null`\>

***

### generateMinuteAmbientPost()

> **generateMinuteAmbientPost**(`actor`, `timestamp`): `Promise`\<\{ `content`: `string`; `sentiment`: `number`; `energy`: `number`; \}\>

Defined in: [src/engine/FeedGenerator.ts:2103](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L2103)

Generate minute-level ambient post for continuous mode
Uses actor personality and current context for realistic posts

#### Parameters

##### actor

###### id

`string`

###### name

`string`

###### description?

`string`

###### role?

`string`

###### mood?

`number`

##### timestamp

`Date`

#### Returns

`Promise`\<\{ `content`: `string`; `sentiment`: `number`; `energy`: `number`; \}\>

***

### generateReply()

> **generateReply**(`actor`, `originalPost`): `Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>

Defined in: [src/engine/FeedGenerator.ts:2158](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/FeedGenerator.ts#L2158)

Generate reply to another post
React based on personality, mood, and relationship
Public for external use and testing

#### Parameters

##### actor

[`Actor`](../interfaces/Actor.md)

##### originalPost

[`FeedPost`](../interfaces/FeedPost.md)

#### Returns

`Promise`\<\{ `post`: `string`; `sentiment`: `number`; `clueStrength`: `number`; `pointsToward`: `boolean` \| `null`; \}\>
