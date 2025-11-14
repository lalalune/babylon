[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/pnl-normalizer](../README.md) / calculateSharpeRatio

# Function: calculateSharpeRatio()

> **calculateSharpeRatio**(`returns`, `riskFreeRate`): `number` \| `null`

Defined in: [src/lib/reputation/pnl-normalizer.ts:114](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/pnl-normalizer.ts#L114)

Calculate Sharpe Ratio (risk-adjusted returns)

Sharpe Ratio measures excess return per unit of risk (volatility).
Higher values indicate better risk-adjusted performance.

## Parameters

### returns

`number`[]

Array of return values (ROI per trade)

### riskFreeRate

`number` = `0.02`

Risk-free rate (default 0.02 for 2% annual)

## Returns

`number` \| `null`

Sharpe ratio (higher is better)
