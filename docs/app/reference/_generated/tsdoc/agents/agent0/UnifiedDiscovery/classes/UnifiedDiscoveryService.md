[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [agents/agent0/UnifiedDiscovery](../README.md) / UnifiedDiscoveryService

# Class: UnifiedDiscoveryService

Defined in: [src/agents/agent0/UnifiedDiscovery.ts:22](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/UnifiedDiscovery.ts#L22)

Unified Discovery Service Interface
Defines the methods available on UnifiedDiscoveryService

## Implements

- [`IUnifiedDiscoveryService`](../../types/interfaces/IUnifiedDiscoveryService.md)

## Constructors

### Constructor

> **new UnifiedDiscoveryService**(`localRegistry`, `subgraphClient`, `reputationBridge?`): `UnifiedDiscoveryService`

Defined in: [src/agents/agent0/UnifiedDiscovery.ts:27](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/UnifiedDiscovery.ts#L27)

#### Parameters

##### localRegistry

[`AgentRegistry`](../../../AgentRegistry/classes/AgentRegistry.md)

##### subgraphClient

[`SubgraphClient`](../../SubgraphClient/classes/SubgraphClient.md)

##### reputationBridge?

[`IReputationBridge`](../../types/interfaces/IReputationBridge.md) | `null`

#### Returns

`UnifiedDiscoveryService`

## Methods

### discoverAgents()

> **discoverAgents**(`filters`): `Promise`\<`AgentProfile`[]\>

Defined in: [src/agents/agent0/UnifiedDiscovery.ts:40](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/UnifiedDiscovery.ts#L40)

Discover agents from both local registry and Agent0 network

#### Parameters

##### filters

[`DiscoveryFilters`](../../types/interfaces/DiscoveryFilters.md)

#### Returns

`Promise`\<`AgentProfile`[]\>

#### Implementation of

[`IUnifiedDiscoveryService`](../../types/interfaces/IUnifiedDiscoveryService.md).[`discoverAgents`](../../types/interfaces/IUnifiedDiscoveryService.md#discoveragents)

***

### getAgent()

> **getAgent**(`agentId`): `Promise`\<`AgentProfile`\>

Defined in: [src/agents/agent0/UnifiedDiscovery.ts:143](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/agents/agent0/UnifiedDiscovery.ts#L143)

Get agent by ID (searches both local and external)

#### Parameters

##### agentId

`string`

#### Returns

`Promise`\<`AgentProfile`\>

#### Implementation of

[`IUnifiedDiscoveryService`](../../types/interfaces/IUnifiedDiscoveryService.md).[`getAgent`](../../types/interfaces/IUnifiedDiscoveryService.md#getagent)
