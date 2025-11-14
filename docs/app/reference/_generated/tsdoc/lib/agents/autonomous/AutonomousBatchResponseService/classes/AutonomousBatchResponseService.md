[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/autonomous/AutonomousBatchResponseService](../README.md) / AutonomousBatchResponseService

# Class: AutonomousBatchResponseService

Defined in: [src/lib/agents/autonomous/AutonomousBatchResponseService.ts:41](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousBatchResponseService.ts#L41)

## Constructors

### Constructor

> **new AutonomousBatchResponseService**(): `AutonomousBatchResponseService`

#### Returns

`AutonomousBatchResponseService`

## Methods

### gatherPendingInteractions()

> **gatherPendingInteractions**(`agentUserId`): `Promise`\<`PendingInteraction`[]\>

Defined in: [src/lib/agents/autonomous/AutonomousBatchResponseService.ts:45](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousBatchResponseService.ts#L45)

Gather all pending interactions that might need responses

#### Parameters

##### agentUserId

`string`

#### Returns

`Promise`\<`PendingInteraction`[]\>

***

### evaluateInteractions()

> **evaluateInteractions**(`agentUserId`, `_runtime`, `interactions`): `Promise`\<`ResponseDecision`[]\>

Defined in: [src/lib/agents/autonomous/AutonomousBatchResponseService.ts:204](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousBatchResponseService.ts#L204)

Evaluate which interactions warrant a response using AI

#### Parameters

##### agentUserId

`string`

##### \_runtime

`IAgentRuntime`

##### interactions

`PendingInteraction`[]

#### Returns

`Promise`\<`ResponseDecision`[]\>

***

### executeResponses()

> **executeResponses**(`agentUserId`, `_runtime`, `interactions`, `decisions`): `Promise`\<`number`\>

Defined in: [src/lib/agents/autonomous/AutonomousBatchResponseService.ts:295](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousBatchResponseService.ts#L295)

Generate and post responses for approved interactions

#### Parameters

##### agentUserId

`string`

##### \_runtime

`IAgentRuntime`

##### interactions

`PendingInteraction`[]

##### decisions

`ResponseDecision`[]

#### Returns

`Promise`\<`number`\>

***

### processBatch()

> **processBatch**(`agentUserId`, `_runtime`): `Promise`\<`number`\>

Defined in: [src/lib/agents/autonomous/AutonomousBatchResponseService.ts:423](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousBatchResponseService.ts#L423)

Main entry point: Process all pending interactions in batch

#### Parameters

##### agentUserId

`string`

##### \_runtime

`IAgentRuntime`

#### Returns

`Promise`\<`number`\>
