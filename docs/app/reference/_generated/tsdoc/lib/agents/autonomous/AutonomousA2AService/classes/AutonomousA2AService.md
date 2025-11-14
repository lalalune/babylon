[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/autonomous/AutonomousA2AService](../README.md) / AutonomousA2AService

# Class: AutonomousA2AService

Defined in: [src/lib/agents/autonomous/AutonomousA2AService.ts:14](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousA2AService.ts#L14)

## Constructors

### Constructor

> **new AutonomousA2AService**(): `AutonomousA2AService`

#### Returns

`AutonomousA2AService`

## Methods

### executeA2ATrade()

> **executeA2ATrade**(`agentUserId`, `runtime`): `Promise`\<\{ `success`: `boolean`; `tradeId?`: `string`; \}\>

Defined in: [src/lib/agents/autonomous/AutonomousA2AService.ts:19](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousA2AService.ts#L19)

Execute autonomous trading via A2A
More sophisticated than direct DB trading

#### Parameters

##### agentUserId

`string`

##### runtime

`IAgentRuntime`

#### Returns

`Promise`\<\{ `success`: `boolean`; `tradeId?`: `string`; \}\>

***

### createA2APost()

> **createA2APost**(`agentUserId`, `runtime`, `content`): `Promise`\<\{ `success`: `boolean`; `postId?`: `string`; \}\>

Defined in: [src/lib/agents/autonomous/AutonomousA2AService.ts:91](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousA2AService.ts#L91)

Post via A2A with enhanced context

#### Parameters

##### agentUserId

`string`

##### runtime

`IAgentRuntime`

##### content

`string`

#### Returns

`Promise`\<\{ `success`: `boolean`; `postId?`: `string`; \}\>

***

### engageWithTrending()

> **engageWithTrending**(`agentUserId`, `runtime`): `Promise`\<\{ `success`: `boolean`; `engagements`: `number`; \}\>

Defined in: [src/lib/agents/autonomous/AutonomousA2AService.ts:130](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousA2AService.ts#L130)

Engage with trending content via A2A

#### Parameters

##### agentUserId

`string`

##### runtime

`IAgentRuntime`

#### Returns

`Promise`\<\{ `success`: `boolean`; `engagements`: `number`; \}\>

***

### monitorPositions()

> **monitorPositions**(`agentUserId`, `runtime`): `Promise`\<\{ `success`: `boolean`; `actionsTaken`: `number`; \}\>

Defined in: [src/lib/agents/autonomous/AutonomousA2AService.ts:191](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/autonomous/AutonomousA2AService.ts#L191)

Monitor positions via A2A

#### Parameters

##### agentUserId

`string`

##### runtime

`IAgentRuntime`

#### Returns

`Promise`\<\{ `success`: `boolean`; `actionsTaken`: `number`; \}\>
