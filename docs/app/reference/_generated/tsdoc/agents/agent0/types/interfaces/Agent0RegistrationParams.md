[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/types](../README.md) / Agent0RegistrationParams

# Interface: Agent0RegistrationParams

Defined in: [src/agents/agent0/types.ts:34](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L34)

Agent0 Registration Parameters

## Properties

### name

> **name**: `string`

Defined in: [src/agents/agent0/types.ts:35](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L35)

***

### description

> **description**: `string`

Defined in: [src/agents/agent0/types.ts:36](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L36)

***

### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/agents/agent0/types.ts:37](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L37)

***

### walletAddress

> **walletAddress**: `string`

Defined in: [src/agents/agent0/types.ts:38](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L38)

***

### mcpEndpoint?

> `optional` **mcpEndpoint**: `string`

Defined in: [src/agents/agent0/types.ts:39](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L39)

***

### a2aEndpoint?

> `optional` **a2aEndpoint**: `string`

Defined in: [src/agents/agent0/types.ts:40](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L40)

***

### capabilities

> **capabilities**: `object`

Defined in: [src/agents/agent0/types.ts:41](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L41)

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
