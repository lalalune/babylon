[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/examples/autonomous-agent-setup](../README.md) / setupAdvancedAutonomousAgent

# Function: setupAdvancedAutonomousAgent()

> **setupAdvancedAutonomousAgent**(`agentUserId`, `config`): `Promise`\<\{ `stop`: () => `void`; `agent`: \{ `id`: `string`; `displayName`: `string` \| `null`; `isAgent`: `boolean`; `agentSystem`: `string` \| `null`; \}; `runtime`: `AgentRuntime`; `executeCustomTick`: () => `Promise`\<[`AutonomousTickResult`](../../../autonomous/AutonomousCoordinator/interfaces/AutonomousTickResult.md)\>; \}\>

Defined in: [src/lib/agents/examples/autonomous-agent-setup.ts:193](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/examples/autonomous-agent-setup.ts#L193)

Example 3: Advanced Setup with Custom Config

## Parameters

### agentUserId

`string`

### config

#### tickInterval?

`number`

#### enableTrading?

`boolean`

#### enablePosting?

`boolean`

#### enableCommenting?

`boolean`

#### maxActionsPerTick?

`number`

## Returns

`Promise`\<\{ `stop`: () => `void`; `agent`: \{ `id`: `string`; `displayName`: `string` \| `null`; `isAgent`: `boolean`; `agentSystem`: `string` \| `null`; \}; `runtime`: `AgentRuntime`; `executeCustomTick`: () => `Promise`\<[`AutonomousTickResult`](../../../autonomous/AutonomousCoordinator/interfaces/AutonomousTickResult.md)\>; \}\>
