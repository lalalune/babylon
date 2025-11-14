[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/ReputationBridge](../README.md) / ReputationBridge

# Class: ReputationBridge

Defined in: [src/agents/agent0/ReputationBridge.ts:14](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/ReputationBridge.ts#L14)

Reputation Bridge Interface
Aggregates reputation from multiple sources

## Implements

- [`IReputationBridge`](../../types/interfaces/IReputationBridge.md)

## Constructors

### Constructor

> **new ReputationBridge**(`erc8004Registry?`): `ReputationBridge`

Defined in: [src/agents/agent0/ReputationBridge.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/ReputationBridge.ts#L18)

#### Parameters

##### erc8004Registry?

[`RegistryClient`](../../../../lib/a2a/blockchain/registry-client/classes/RegistryClient.md)

#### Returns

`ReputationBridge`

## Methods

### getAggregatedReputation()

> **getAggregatedReputation**(`tokenId`): `Promise`\<[`AggregatedReputation`](../../types/interfaces/AggregatedReputation.md)\>

Defined in: [src/agents/agent0/ReputationBridge.ts:26](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/ReputationBridge.ts#L26)

Get aggregated reputation from both ERC-8004 and Agent0

#### Parameters

##### tokenId

`number`

#### Returns

`Promise`\<[`AggregatedReputation`](../../types/interfaces/AggregatedReputation.md)\>

#### Implementation of

[`IReputationBridge`](../../types/interfaces/IReputationBridge.md).[`getAggregatedReputation`](../../types/interfaces/IReputationBridge.md#getaggregatedreputation)

***

### syncReputationToAgent0()

> **syncReputationToAgent0**(`tokenId`, `agent0Client`): `Promise`\<`void`\>

Defined in: [src/agents/agent0/ReputationBridge.ts:162](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/ReputationBridge.ts#L162)

Sync local reputation to Agent0 network
This can be called periodically to keep both systems in sync

#### Parameters

##### tokenId

`number`

##### agent0Client

###### submitFeedback

(`params`) => `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
