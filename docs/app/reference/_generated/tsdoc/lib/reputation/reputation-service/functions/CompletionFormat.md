[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/reputation-service](../README.md) / CompletionFormat

# Function: CompletionFormat()

> **CompletionFormat**(`agentId`, `tradeId`, `performanceMetrics`): `Promise`\<\{ \}\>

Defined in: [src/lib/reputation/reputation-service.ts:569](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/reputation-service.ts#L569)

Generate automatic feedback for trade execution

## Parameters

### agentId

`string`

Agent user ID

### tradeId

`string`

Trade identifier

### performanceMetrics

[`TradeMetrics`](../interfaces/TradeMetrics.md)

Trade performance data

## Returns

`Promise`\<\{ \}\>

Created feedback record
