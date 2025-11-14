[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/feedback/trade-feedback-calculator](../README.md) / calculateTradeMetrics

# Function: calculateTradeMetrics()

> **calculateTradeMetrics**(`positionId`): `Promise`\<[`TradeMetrics`](../../../reputation/reputation-service/interfaces/TradeMetrics.md) \| `null`\>

Defined in: [src/lib/feedback/trade-feedback-calculator.ts:161](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/trade-feedback-calculator.ts#L161)

Calculate comprehensive trade metrics

Analyzes a closed trade and returns detailed performance metrics.

## Parameters

### positionId

`string`

Position ID to analyze

## Returns

`Promise`\<[`TradeMetrics`](../../../reputation/reputation-service/interfaces/TradeMetrics.md) \| `null`\>

TradeMetrics or null if position not found
