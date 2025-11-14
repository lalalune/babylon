[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/types](../README.md) / Agent0AgentProfile

# Interface: Agent0AgentProfile

Defined in: [src/agents/agent0/types.ts:84](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L84)

Agent0 Agent Profile

## Properties

### tokenId

> **tokenId**: `number`

Defined in: [src/agents/agent0/types.ts:85](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L85)

***

### name

> **name**: `string`

Defined in: [src/agents/agent0/types.ts:86](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L86)

***

### walletAddress

> **walletAddress**: `string`

Defined in: [src/agents/agent0/types.ts:87](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L87)

***

### metadataCID

> **metadataCID**: `string`

Defined in: [src/agents/agent0/types.ts:88](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L88)

***

### capabilities

> **capabilities**: `object`

Defined in: [src/agents/agent0/types.ts:89](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L89)

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

Defined in: [src/agents/agent0/types.ts:90](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L90)

#### trustScore

> **trustScore**: `number`

#### accuracyScore

> **accuracyScore**: `number`
