[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/GameDiscovery](../README.md) / GameDiscoveryService

# Class: GameDiscoveryService

Defined in: [src/agents/agent0/GameDiscovery.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/GameDiscovery.ts#L42)

## Constructors

### Constructor

> **new GameDiscoveryService**(): `GameDiscoveryService`

Defined in: [src/agents/agent0/GameDiscovery.ts:46](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/GameDiscovery.ts#L46)

#### Returns

`GameDiscoveryService`

## Methods

### discoverGames()

> **discoverGames**(`filters`): `Promise`\<[`DiscoverableGame`](../interfaces/DiscoverableGame.md)[]\>

Defined in: [src/agents/agent0/GameDiscovery.ts:55](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/GameDiscovery.ts#L55)

Discover games by type (prediction markets, trading games, etc.)
This is what external agents call to find Babylon

#### Parameters

##### filters

###### type?

`string`

###### markets?

`string`[]

###### minReputation?

`number`

#### Returns

`Promise`\<[`DiscoverableGame`](../interfaces/DiscoverableGame.md)[]\>

***

### findBabylon()

> **findBabylon**(`maxRetries`): `Promise`\<[`DiscoverableGame`](../interfaces/DiscoverableGame.md) \| `null`\>

Defined in: [src/agents/agent0/GameDiscovery.ts:105](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/GameDiscovery.ts#L105)

Find Babylon specifically with retry logic

#### Parameters

##### maxRetries

`number` = `3`

#### Returns

`Promise`\<[`DiscoverableGame`](../interfaces/DiscoverableGame.md) \| `null`\>

***

### getGameByTokenId()

> **getGameByTokenId**(`tokenId`): `Promise`\<[`DiscoverableGame`](../interfaces/DiscoverableGame.md) \| `null`\>

Defined in: [src/agents/agent0/GameDiscovery.ts:249](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/GameDiscovery.ts#L249)

Get game metadata by token ID

#### Parameters

##### tokenId

`number`

#### Returns

`Promise`\<[`DiscoverableGame`](../interfaces/DiscoverableGame.md) \| `null`\>
