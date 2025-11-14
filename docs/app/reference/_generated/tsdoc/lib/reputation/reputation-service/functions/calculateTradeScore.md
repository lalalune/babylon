[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/reputation-service](../README.md) / calculateTradeScore

# Function: calculateTradeScore()

> **calculateTradeScore**(`metrics`): `number`

Defined in: [src/lib/reputation/reputation-service.ts:480](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/reputation-service.ts#L480)

Calculate feedback score from trade performance metrics

Score components (0-100):
- ROI: 50% (return on investment)
- Timing: 25% (entry/exit timing quality)
- Risk management: 25% (position sizing, stop losses)

## Parameters

### metrics

[`TradeMetrics`](../interfaces/TradeMetrics.md)

Trade performance metrics

## Returns

`number`

Feedback score (0-100)
