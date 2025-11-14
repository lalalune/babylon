[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/feedback/trade-feedback-calculator](../README.md) / calculateRiskScore

# Function: calculateRiskScore()

> **calculateRiskScore**(`position`, `userTotalBalance`): `number`

Defined in: [src/lib/feedback/trade-feedback-calculator.ts:127](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/trade-feedback-calculator.ts#L127)

Calculate risk management score

Analyzes position sizing and risk taken relative to available capital.

## Parameters

### position

`TradePosition`

Trade position data

### userTotalBalance

`number`

User's total available balance at trade time

## Returns

`number`

Score from 0-1
