[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/types](../README.md) / IUnifiedDiscoveryService

# Interface: IUnifiedDiscoveryService

Defined in: [src/agents/agent0/types.ts:26](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L26)

Unified Discovery Service Interface
Defines the methods available on UnifiedDiscoveryService

## Methods

### discoverAgents()

> **discoverAgents**(`filters`): `Promise`\<`AgentProfile`[]\>

Defined in: [src/agents/agent0/types.ts:27](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L27)

#### Parameters

##### filters

[`DiscoveryFilters`](DiscoveryFilters.md)

#### Returns

`Promise`\<`AgentProfile`[]\>

***

### getAgent()

> **getAgent**(`agentId`): `Promise`\<`AgentProfile` \| `null`\>

Defined in: [src/agents/agent0/types.ts:28](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/types.ts#L28)

#### Parameters

##### agentId

`string`

#### Returns

`Promise`\<`AgentProfile` \| `null`\>
