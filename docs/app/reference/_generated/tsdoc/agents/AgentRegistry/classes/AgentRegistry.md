[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [agents/AgentRegistry](../README.md) / AgentRegistry

# Class: AgentRegistry

Defined in: [src/agents/AgentRegistry.ts:20](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/AgentRegistry.ts#L20)

## Constructors

### Constructor

> **new AgentRegistry**(): `AgentRegistry`

#### Returns

`AgentRegistry`

## Methods

### search()

> **search**(`_params`): `AgentResult`[]

Defined in: [src/agents/AgentRegistry.ts:24](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/AgentRegistry.ts#L24)

Search for agents based on filters

#### Parameters

##### \_params

`SearchParams`

#### Returns

`AgentResult`[]

***

### getAgent()

> **getAgent**(`_agentId`): `AgentResult` \| `null`

Defined in: [src/agents/AgentRegistry.ts:33](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/AgentRegistry.ts#L33)

Get a single agent by ID

#### Parameters

##### \_agentId

`string`

#### Returns

`AgentResult` \| `null`

***

### getAllAgents()

> **getAllAgents**(): `Promise`\<`AgentResult`[]\>

Defined in: [src/agents/AgentRegistry.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/AgentRegistry.ts#L42)

Get all registered agents

#### Returns

`Promise`\<`AgentResult`[]\>
