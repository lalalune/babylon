[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/a2a/blockchain/registry-client](../README.md) / RegistryClient

# Class: RegistryClient

Defined in: [src/lib/a2a/blockchain/registry-client.ts:47](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L47)

## Constructors

### Constructor

> **new RegistryClient**(`config`): `RegistryClient`

Defined in: [src/lib/a2a/blockchain/registry-client.ts:53](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L53)

#### Parameters

##### config

[`RegistryConfig`](../interfaces/RegistryConfig.md)

#### Returns

`RegistryClient`

## Methods

### getAgentProfile()

> **getAgentProfile**(`tokenId`): `Promise`\<`AgentProfile` \| `null`\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:74](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L74)

Get agent profile by token ID

#### Parameters

##### tokenId

`number`

#### Returns

`Promise`\<`AgentProfile` \| `null`\>

***

### getAgentProfileByAddress()

> **getAgentProfileByAddress**(`address`): `Promise`\<`AgentProfile` \| `null`\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:101](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L101)

Get agent profile by address

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`AgentProfile` \| `null`\>

***

### getAgentReputation()

> **getAgentReputation**(`tokenId`): `Promise`\<`AgentReputation`\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:117](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L117)

Get agent reputation

#### Parameters

##### tokenId

`number`

#### Returns

`Promise`\<`AgentReputation`\>

***

### discoverAgents()

> **discoverAgents**(`filters?`): `Promise`\<`AgentProfile`[]\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:141](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L141)

Discover agents by filters

#### Parameters

##### filters?

###### strategies?

`string`[]

###### minReputation?

`number`

###### markets?

`string`[]

#### Returns

`Promise`\<`AgentProfile`[]\>

***

### verifyAgent()

> **verifyAgent**(`address`, `tokenId`): `Promise`\<`boolean`\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:236](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L236)

Verify agent address owns the token ID

#### Parameters

##### address

`string`

##### tokenId

`number`

#### Returns

`Promise`\<`boolean`\>

***

### isEndpointActive()

> **isEndpointActive**(`endpoint`): `Promise`\<`boolean`\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:251](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L251)

Check if endpoint is active

#### Parameters

##### endpoint

`string`

#### Returns

`Promise`\<`boolean`\>

***

### register()

> **register**(`agentId`, `data`): `Promise`\<`void`\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:267](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L267)

Register agent (required by RegistryClient interface)
Note: This is a blockchain-based registry, so registration happens on-chain
This method is provided for interface compatibility but may not be fully implemented

#### Parameters

##### agentId

`string`

##### data

`Record`\<`string`, `JsonValue`\>

#### Returns

`Promise`\<`void`\>

***

### unregister()

> **unregister**(`agentId`): `Promise`\<`void`\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:277](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L277)

Unregister agent (required by RegistryClient interface)

#### Parameters

##### agentId

`string`

#### Returns

`Promise`\<`void`\>

***

### getAgents()

> **getAgents**(): `Promise`\<`object`[]\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:286](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L286)

Get all agents (required by RegistryClient interface)

#### Returns

`Promise`\<`object`[]\>

***

### getAgent()

> **getAgent**(`agentId`): `Promise`\<\{\[`key`: `string`\]: `JsonValue`; `agentId`: `string`; \} \| `null`\>

Defined in: [src/lib/a2a/blockchain/registry-client.ts:316](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/a2a/blockchain/registry-client.ts#L316)

Get agent by ID (required by RegistryClient interface)

#### Parameters

##### agentId

`string`

#### Returns

`Promise`\<\{\[`key`: `string`\]: `JsonValue`; `agentId`: `string`; \} \| `null`\>
