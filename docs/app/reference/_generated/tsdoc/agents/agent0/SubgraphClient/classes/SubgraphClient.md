[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/SubgraphClient](../README.md) / SubgraphClient

# Class: SubgraphClient

Defined in: [src/agents/agent0/SubgraphClient.ts:56](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/SubgraphClient.ts#L56)

## Constructors

### Constructor

> **new SubgraphClient**(): `SubgraphClient`

Defined in: [src/agents/agent0/SubgraphClient.ts:59](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/SubgraphClient.ts#L59)

#### Returns

`SubgraphClient`

## Methods

### getAgent()

> **getAgent**(`tokenId`): `Promise`\<[`SubgraphAgent`](../interfaces/SubgraphAgent.md)\>

Defined in: [src/agents/agent0/SubgraphClient.ts:120](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/SubgraphClient.ts#L120)

Get agent by token ID

#### Parameters

##### tokenId

`number`

#### Returns

`Promise`\<[`SubgraphAgent`](../interfaces/SubgraphAgent.md)\>

***

### searchAgents()

> **searchAgents**(`filters`): `Promise`\<[`SubgraphAgent`](../interfaces/SubgraphAgent.md)[]\>

Defined in: [src/agents/agent0/SubgraphClient.ts:149](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/SubgraphClient.ts#L149)

Search agents by filters

#### Parameters

##### filters

###### type?

`string`

###### strategies?

`string`[]

###### markets?

`string`[]

###### minTrustScore?

`number`

###### limit?

`number`

#### Returns

`Promise`\<[`SubgraphAgent`](../interfaces/SubgraphAgent.md)[]\>

***

### getGamePlatforms()

> **getGamePlatforms**(`filters?`): `Promise`\<[`SubgraphAgent`](../interfaces/SubgraphAgent.md)[]\>

Defined in: [src/agents/agent0/SubgraphClient.ts:213](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/SubgraphClient.ts#L213)

Get all game platforms

#### Parameters

##### filters?

###### markets?

`string`[]

###### minTrustScore?

`number`

#### Returns

`Promise`\<[`SubgraphAgent`](../interfaces/SubgraphAgent.md)[]\>

***

### getAgentFeedback()

> **getAgentFeedback**(`tokenId`): `Promise`\<`object`[]\>

Defined in: [src/agents/agent0/SubgraphClient.ts:228](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/SubgraphClient.ts#L228)

Get agent feedback

#### Parameters

##### tokenId

`number`

#### Returns

`Promise`\<`object`[]\>
