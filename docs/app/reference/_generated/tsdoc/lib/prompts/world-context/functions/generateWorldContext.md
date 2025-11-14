[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/prompts/world-context](../README.md) / generateWorldContext

# Function: generateWorldContext()

> **generateWorldContext**(`options`): `Promise`\<\{ `worldActors`: `string`; `currentMarkets`: `string`; `activePredictions`: `string`; `recentTrades`: `string`; \}\>

Defined in: [src/lib/prompts/world-context.ts:229](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/prompts/world-context.ts#L229)

Generates complete world context for feed prompts
Note: This is async because it fetches from database

## Parameters

### options

[`WorldContextOptions`](../interfaces/WorldContextOptions.md) = `{}`

## Returns

`Promise`\<\{ `worldActors`: `string`; `currentMarkets`: `string`; `activePredictions`: `string`; `recentTrades`: `string`; \}\>
