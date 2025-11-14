[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/pnl-normalizer](../README.md) / normalizePnL

# Function: normalizePnL()

> **normalizePnL**(`pnl`, `totalInvested`): `number`

Defined in: [src/lib/reputation/pnl-normalizer.ts:26](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/pnl-normalizer.ts#L26)

Normalize PNL to 0-1 scale using sigmoid function

The sigmoid function converts unbounded ROI values to a 0-1 scale:
- ROI = 0% → 0.5 (neutral)
- ROI = +100% → ~0.88 (very good)
- ROI = -50% → ~0.27 (bad)
- ROI = +200% → ~0.95 (excellent)
- ROI = -75% → ~0.11 (very bad)

Formula: 1 / (1 + e^(-roi))

## Parameters

### pnl

Profit or loss amount (can be negative)

`number` | `Decimal`

### totalInvested

Total amount invested

`number` | `Decimal`

## Returns

`number`

Normalized score from 0 to 1
