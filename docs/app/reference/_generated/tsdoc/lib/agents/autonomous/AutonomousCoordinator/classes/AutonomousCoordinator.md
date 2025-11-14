[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/autonomous/AutonomousCoordinator](../README.md) / AutonomousCoordinator

# Class: AutonomousCoordinator

Defined in: [src/lib/agents/autonomous/AutonomousCoordinator.ts:42](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousCoordinator.ts#L42)

## Constructors

### Constructor

> **new AutonomousCoordinator**(): `AutonomousCoordinator`

#### Returns

`AutonomousCoordinator`

## Methods

### executeAutonomousTick()

> **executeAutonomousTick**(`agentUserId`, `runtime`): `Promise`\<[`AutonomousTickResult`](../interfaces/AutonomousTickResult.md)\>

Defined in: [src/lib/agents/autonomous/AutonomousCoordinator.ts:47](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousCoordinator.ts#L47)

Execute complete autonomous tick for an agent
Coordinates all services and avoids duplication

#### Parameters

##### agentUserId

`string`

##### runtime

`IAgentRuntime`

#### Returns

`Promise`\<[`AutonomousTickResult`](../interfaces/AutonomousTickResult.md)\>

***

### executeTickForAllAgents()

> **executeTickForAllAgents**(`runtime`): `Promise`\<\{ `agentsProcessed`: `number`; `totalActions`: `number`; `errors`: `number`; \}\>

Defined in: [src/lib/agents/autonomous/AutonomousCoordinator.ts:170](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousCoordinator.ts#L170)

Execute autonomous tick for all active agents

#### Parameters

##### runtime

`IAgentRuntime`

#### Returns

`Promise`\<\{ `agentsProcessed`: `number`; `totalActions`: `number`; `errors`: `number`; \}\>
