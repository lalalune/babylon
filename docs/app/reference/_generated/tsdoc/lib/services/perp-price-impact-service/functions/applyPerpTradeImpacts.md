[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/services/perp-price-impact-service](../README.md) / applyPerpTradeImpacts

# Function: applyPerpTradeImpacts()

> **applyPerpTradeImpacts**(`trades`): `Promise`\<`void`\>

Defined in: [src/lib/services/perp-price-impact-service.ts:56](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/services/perp-price-impact-service.ts#L56)

Apply price impacts for user-generated perp trades.
Mirrors the logic used by GameEngine for NPC trades.

## Parameters

### trades

[`TradeImpactInput`](../../market-impact-service/interfaces/TradeImpactInput.md)[]

## Returns

`Promise`\<`void`\>
