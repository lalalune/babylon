[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/runtime/AgentRuntimeManager](../README.md) / AgentRuntimeManager

# Class: AgentRuntimeManager

Defined in: [src/lib/agents/runtime/AgentRuntimeManager.ts:17](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/runtime/AgentRuntimeManager.ts#L17)

## Methods

### getInstance()

> `static` **getInstance**(): `AgentRuntimeManager`

Defined in: [src/lib/agents/runtime/AgentRuntimeManager.ts:24](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/runtime/AgentRuntimeManager.ts#L24)

#### Returns

`AgentRuntimeManager`

***

### getRuntime()

> **getRuntime**(`agentUserId`): `Promise`\<`AgentRuntime`\>

Defined in: [src/lib/agents/runtime/AgentRuntimeManager.ts:34](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/runtime/AgentRuntimeManager.ts#L34)

Get or create a runtime for a specific agent (agent is a User with isAgent=true)

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<`AgentRuntime`\>

***

### clearRuntime()

> **clearRuntime**(`agentUserId`): `void`

Defined in: [src/lib/agents/runtime/AgentRuntimeManager.ts:188](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/runtime/AgentRuntimeManager.ts#L188)

Remove runtime from cache

#### Parameters

##### agentUserId

`string`

#### Returns

`void`

***

### clearAllRuntimes()

> **clearAllRuntimes**(): `void`

Defined in: [src/lib/agents/runtime/AgentRuntimeManager.ts:195](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/runtime/AgentRuntimeManager.ts#L195)

#### Returns

`void`

***

### getRuntimeCount()

> **getRuntimeCount**(): `number`

Defined in: [src/lib/agents/runtime/AgentRuntimeManager.ts:200](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/runtime/AgentRuntimeManager.ts#L200)

#### Returns

`number`

***

### hasRuntime()

> **hasRuntime**(`agentUserId`): `boolean`

Defined in: [src/lib/agents/runtime/AgentRuntimeManager.ts:204](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/runtime/AgentRuntimeManager.ts#L204)

#### Parameters

##### agentUserId

`string`

#### Returns

`boolean`
