[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/market-context-service](../README.md) / MarketContextService

# Class: MarketContextService

Defined in: [src/lib/services/market-context-service.ts:38](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/market-context-service.ts#L38)

## Constructors

### Constructor

> **new MarketContextService**(): `MarketContextService`

#### Returns

`MarketContextService`

## Methods

### buildContextForAllNPCs()

> **buildContextForAllNPCs**(): `Promise`\<`Map`\<`string`, `NPCMarketContext`\>\>

Defined in: [src/lib/services/market-context-service.ts:43](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/market-context-service.ts#L43)

Build market context for all NPCs in the system
Optimized to minimize database queries

#### Returns

`Promise`\<`Map`\<`string`, `NPCMarketContext`\>\>

***

### buildContextForNPC()

> **buildContextForNPC**(`npcId`): `Promise`\<`NPCMarketContext`\>

Defined in: [src/lib/services/market-context-service.ts:150](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/market-context-service.ts#L150)

Build context for a specific NPC with relationship data

#### Parameters

##### npcId

`string`

#### Returns

`Promise`\<`NPCMarketContext`\>
