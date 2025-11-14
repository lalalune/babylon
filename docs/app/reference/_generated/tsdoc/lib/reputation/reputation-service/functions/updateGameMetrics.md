[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/reputation-service](../README.md) / updateGameMetrics

# Function: updateGameMetrics()

> **updateGameMetrics**(`userId`, `gameScore`, `won`): `Promise`\<\{ \}\>

Defined in: [src/lib/reputation/reputation-service.ts:114](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/reputation-service.ts#L114)

Update agent performance metrics based on completed game

## Parameters

### userId

`string`

User/agent ID

### gameScore

`number`

Game performance score (0-100)

### won

`boolean`

Whether the game was won

## Returns

`Promise`\<\{ \}\>

Updated metrics
