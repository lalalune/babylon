[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/reputation-service](../README.md) / generateGameCompletionFeedback

# Function: generateGameCompletionFeedback()

> **generateGameCompletionFeedback**(`agentId`, `gameId`, `performanceMetrics`): `Promise`\<\{ \}\>

Defined in: [src/lib/reputation/reputation-service.ts:509](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/reputation-service.ts#L509)

Generate automatic feedback when agent completes a game

Creates feedback record and updates agent metrics atomically.

## Parameters

### agentId

`string`

Agent user ID

### gameId

`string`

Game identifier

### performanceMetrics

[`GameMetrics`](../interfaces/GameMetrics.md)

Game performance data

## Returns

`Promise`\<\{ \}\>

Created feedback record
