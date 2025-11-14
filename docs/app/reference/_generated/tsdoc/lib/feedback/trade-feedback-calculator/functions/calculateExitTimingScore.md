[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/feedback/trade-feedback-calculator](../README.md) / calculateExitTimingScore

# Function: calculateExitTimingScore()

> **calculateExitTimingScore**(`position`, `marketResolutionDate`): `number`

Defined in: [src/lib/feedback/trade-feedback-calculator.ts:83](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/trade-feedback-calculator.ts#L83)

Calculate exit timing score

For positions that were closed before resolution, analyzes exit timing.

## Parameters

### position

`TradePosition`

Trade position data

### marketResolutionDate

`Date`

When the market resolved

## Returns

`number`

Score from 0-1
