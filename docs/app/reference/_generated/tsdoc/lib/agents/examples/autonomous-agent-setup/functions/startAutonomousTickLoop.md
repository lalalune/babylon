[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/agents/examples/autonomous-agent-setup](../README.md) / startAutonomousTickLoop

# Function: startAutonomousTickLoop()

> **startAutonomousTickLoop**(`agentUserId`, `tickIntervalMinutes`): `Promise`\<\{ `stop`: () => `void`; `agent`: \{ `id`: `string`; `displayName`: `string` \| `null`; `isAgent`: `boolean`; `agentSystem`: `string` \| `null`; \}; `runtime`: `AgentRuntime`; \}\>

Defined in: [src/lib/agents/examples/autonomous-agent-setup.ts:120](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/agents/examples/autonomous-agent-setup.ts#L120)

Example 2: Start Autonomous Tick Loop

## Parameters

### agentUserId

`string`

### tickIntervalMinutes

`number` = `5`

## Returns

`Promise`\<\{ `stop`: () => `void`; `agent`: \{ `id`: `string`; `displayName`: `string` \| `null`; `isAgent`: `boolean`; `agentSystem`: `string` \| `null`; \}; `runtime`: `AgentRuntime`; \}\>
