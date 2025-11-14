[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/types](../README.md) / Agent0SearchResult

# Interface: Agent0SearchResult

Defined in: [src/agents/agent0/types.ts:69](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L69)

Agent0 Search Result

## Properties

### tokenId

> **tokenId**: `number`

Defined in: [src/agents/agent0/types.ts:70](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L70)

***

### name

> **name**: `string`

Defined in: [src/agents/agent0/types.ts:71](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L71)

***

### walletAddress

> **walletAddress**: `string`

Defined in: [src/agents/agent0/types.ts:72](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L72)

***

### metadataCID

> **metadataCID**: `string`

Defined in: [src/agents/agent0/types.ts:73](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L73)

***

### capabilities

> **capabilities**: `object`

Defined in: [src/agents/agent0/types.ts:74](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L74)

#### strategies

> **strategies**: `string`[]

#### markets

> **markets**: `string`[]

#### actions

> **actions**: `string`[]

#### version

> **version**: `string`

#### x402Support?

> `optional` **x402Support**: `boolean`

#### platform?

> `optional` **platform**: `string`

#### userType?

> `optional` **userType**: `string`

#### gameNetwork?

> `optional` **gameNetwork**: `object`

##### gameNetwork.chainId

> **chainId**: `number`

##### gameNetwork.registryAddress

> **registryAddress**: `string`

##### gameNetwork.reputationAddress?

> `optional` **reputationAddress**: `string`

##### gameNetwork.marketAddress?

> `optional` **marketAddress**: `string`

***

### reputation

> **reputation**: `object`

Defined in: [src/agents/agent0/types.ts:75](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L75)

#### trustScore

> **trustScore**: `number`

#### accuracyScore

> **accuracyScore**: `number`
