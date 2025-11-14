[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/market-impact-service](../README.md) / aggregateTradeImpacts

# Function: aggregateTradeImpacts()

> **aggregateTradeImpacts**(`trades`): `Map`\<`string`, [`AggregatedImpact`](../interfaces/AggregatedImpact.md)\>

Defined in: [src/lib/services/market-impact-service.ts:22](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/market-impact-service.ts#L22)

Aggregate trades into per-market impact buckets that capture directional volume

## Parameters

### trades

[`TradeImpactInput`](../interfaces/TradeImpactInput.md)[]

## Returns

`Map`\<`string`, [`AggregatedImpact`](../interfaces/AggregatedImpact.md)\>
