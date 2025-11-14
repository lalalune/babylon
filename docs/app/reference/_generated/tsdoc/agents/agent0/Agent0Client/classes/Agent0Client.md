[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/Agent0Client](../README.md) / Agent0Client

# Class: Agent0Client

Defined in: [src/agents/agent0/Agent0Client.ts:36](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/Agent0Client.ts#L36)

Agent0 Client Interface
Defines the methods available on Agent0Client for external use

## Implements

- [`IAgent0Client`](../../types/interfaces/IAgent0Client.md)

## Constructors

### Constructor

> **new Agent0Client**(`config`): `Agent0Client`

Defined in: [src/agents/agent0/Agent0Client.ts:51](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/Agent0Client.ts#L51)

#### Parameters

##### config

###### network

`"sepolia"` \| `"mainnet"`

###### rpcUrl

`string`

###### privateKey

`string`

###### ipfsProvider?

`"node"` \| `"filecoinPin"` \| `"pinata"`

###### ipfsNodeUrl?

`string`

###### pinataJwt?

`string`

###### filecoinPrivateKey?

`string`

###### subgraphUrl?

`string`

#### Returns

`Agent0Client`

## Methods

### registerAgent()

> **registerAgent**(`params`): `Promise`\<[`Agent0RegistrationResult`](../../types/interfaces/Agent0RegistrationResult.md)\>

Defined in: [src/agents/agent0/Agent0Client.ts:107](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/Agent0Client.ts#L107)

Register an agent with Agent0 SDK

This will:
1. Register on-chain (ERC-8004)
2. Publish metadata to IPFS
3. Index in Agent0 subgraph

#### Parameters

##### params

[`Agent0RegistrationParams`](../../types/interfaces/Agent0RegistrationParams.md)

#### Returns

`Promise`\<[`Agent0RegistrationResult`](../../types/interfaces/Agent0RegistrationResult.md)\>

#### Implementation of

[`IAgent0Client`](../../types/interfaces/IAgent0Client.md).[`registerAgent`](../../types/interfaces/IAgent0Client.md#registeragent)

***

### registerBabylonGame()

> **registerBabylonGame**(): `Promise`\<[`Agent0RegistrationResult`](../../types/interfaces/Agent0RegistrationResult.md)\>

Defined in: [src/agents/agent0/Agent0Client.ts:181](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/Agent0Client.ts#L181)

Register Babylon game itself on agent0 (Ethereum)

This registers the GAME as an agent in the agent0 ecosystem for:
- Cross-game discovery
- External agent onboarding
- Interoperability with agent0 network

The game's metadata includes pointers to Base network where game operates

#### Returns

`Promise`\<[`Agent0RegistrationResult`](../../types/interfaces/Agent0RegistrationResult.md)\>

#### Implementation of

[`IAgent0Client`](../../types/interfaces/IAgent0Client.md).[`registerBabylonGame`](../../types/interfaces/IAgent0Client.md#registerbabylongame)

***

### searchAgents()

> **searchAgents**(`filters`): `Promise`\<[`Agent0SearchResult`](../../types/interfaces/Agent0SearchResult.md)[]\>

Defined in: [src/agents/agent0/Agent0Client.ts:225](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/Agent0Client.ts#L225)

Search for agents using Agent0 SDK

#### Parameters

##### filters

[`Agent0SearchFilters`](../../types/interfaces/Agent0SearchFilters.md)

#### Returns

`Promise`\<[`Agent0SearchResult`](../../types/interfaces/Agent0SearchResult.md)[]\>

#### Implementation of

[`IAgent0Client`](../../types/interfaces/IAgent0Client.md).[`searchAgents`](../../types/interfaces/IAgent0Client.md#searchagents)

***

### submitFeedback()

> **submitFeedback**(`params`): `Promise`\<`void`\>

Defined in: [src/agents/agent0/Agent0Client.ts:265](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/Agent0Client.ts#L265)

Submit feedback for an agent

#### Parameters

##### params

[`Agent0FeedbackParams`](../../types/interfaces/Agent0FeedbackParams.md)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IAgent0Client`](../../types/interfaces/IAgent0Client.md).[`submitFeedback`](../../types/interfaces/IAgent0Client.md#submitfeedback)

***

### getAgentProfile()

> **getAgentProfile**(`tokenId`): `Promise`\<[`Agent0AgentProfile`](../../types/interfaces/Agent0AgentProfile.md) \| `null`\>

Defined in: [src/agents/agent0/Agent0Client.ts:295](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/Agent0Client.ts#L295)

Get agent profile from Agent0 network

#### Parameters

##### tokenId

`number`

#### Returns

`Promise`\<[`Agent0AgentProfile`](../../types/interfaces/Agent0AgentProfile.md) \| `null`\>

#### Implementation of

[`IAgent0Client`](../../types/interfaces/IAgent0Client.md).[`getAgentProfile`](../../types/interfaces/IAgent0Client.md#getagentprofile)

***

### isAvailable()

> **isAvailable**(): `boolean`

Defined in: [src/agents/agent0/Agent0Client.ts:357](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/Agent0Client.ts#L357)

Check if Agent0 SDK is available

#### Returns

`boolean`

#### Implementation of

[`IAgent0Client`](../../types/interfaces/IAgent0Client.md).[`isAvailable`](../../types/interfaces/IAgent0Client.md#isavailable)

***

### getSDK()

> **getSDK**(): `SDK` \| `null`

Defined in: [src/agents/agent0/Agent0Client.ts:364](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/Agent0Client.ts#L364)

Get the underlying SDK instance

#### Returns

`SDK` \| `null`
