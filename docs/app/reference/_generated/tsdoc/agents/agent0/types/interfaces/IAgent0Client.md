[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/types](../README.md) / IAgent0Client

# Interface: IAgent0Client

Defined in: [src/agents/agent0/types.ts:13](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L13)

Agent0 Client Interface
Defines the methods available on Agent0Client for external use

## Methods

### registerAgent()

> **registerAgent**(`params`): `Promise`\<[`Agent0RegistrationResult`](Agent0RegistrationResult.md)\>

Defined in: [src/agents/agent0/types.ts:14](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L14)

#### Parameters

##### params

[`Agent0RegistrationParams`](Agent0RegistrationParams.md)

#### Returns

`Promise`\<[`Agent0RegistrationResult`](Agent0RegistrationResult.md)\>

***

### registerBabylonGame()

> **registerBabylonGame**(): `Promise`\<[`Agent0RegistrationResult`](Agent0RegistrationResult.md)\>

Defined in: [src/agents/agent0/types.ts:15](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L15)

#### Returns

`Promise`\<[`Agent0RegistrationResult`](Agent0RegistrationResult.md)\>

***

### searchAgents()

> **searchAgents**(`filters`): `Promise`\<[`Agent0SearchResult`](Agent0SearchResult.md)[]\>

Defined in: [src/agents/agent0/types.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L16)

#### Parameters

##### filters

[`Agent0SearchFilters`](Agent0SearchFilters.md)

#### Returns

`Promise`\<[`Agent0SearchResult`](Agent0SearchResult.md)[]\>

***

### submitFeedback()

> **submitFeedback**(`params`): `Promise`\<`void`\>

Defined in: [src/agents/agent0/types.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L17)

#### Parameters

##### params

[`Agent0FeedbackParams`](Agent0FeedbackParams.md)

#### Returns

`Promise`\<`void`\>

***

### getAgentProfile()

> **getAgentProfile**(`tokenId`): `Promise`\<[`Agent0AgentProfile`](Agent0AgentProfile.md) \| `null`\>

Defined in: [src/agents/agent0/types.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L18)

#### Parameters

##### tokenId

`number`

#### Returns

`Promise`\<[`Agent0AgentProfile`](Agent0AgentProfile.md) \| `null`\>

***

### isAvailable()

> **isAvailable**(): `boolean`

Defined in: [src/agents/agent0/types.ts:19](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L19)

#### Returns

`boolean`
