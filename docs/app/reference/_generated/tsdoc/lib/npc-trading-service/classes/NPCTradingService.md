[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/npc-trading-service](../README.md) / NPCTradingService

# Class: NPCTradingService

Defined in: [src/lib/npc-trading-service.ts:45](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc-trading-service.ts#L45)

## Constructors

### Constructor

> **new NPCTradingService**(): `NPCTradingService`

#### Returns

`NPCTradingService`

## Methods

### analyzePostAndTrade()

> `static` **analyzePostAndTrade**(`postId`, `postContent`, `npcActorId`, `marketContext`): `Promise`\<`void`\>

Defined in: [src/lib/npc-trading-service.ts:49](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc-trading-service.ts#L49)

Analyze a post and determine if NPC should trade

#### Parameters

##### postId

`string`

##### postContent

`string`

##### npcActorId

`string`

##### marketContext

`MarketContext`

#### Returns

`Promise`\<`void`\>

***

### processRecentPosts()

> `static` **processRecentPosts**(`marketContext`): `Promise`\<`void`\>

Defined in: [src/lib/npc-trading-service.ts:431](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/npc-trading-service.ts#L431)

Process all recent posts and execute NPC trades

#### Parameters

##### marketContext

`MarketContext`

#### Returns

`Promise`\<`void`\>
