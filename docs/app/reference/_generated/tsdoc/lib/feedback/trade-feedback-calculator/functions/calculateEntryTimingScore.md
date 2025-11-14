[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/feedback/trade-feedback-calculator](../README.md) / calculateEntryTimingScore

# Function: calculateEntryTimingScore()

> **calculateEntryTimingScore**(`position`, `marketResolutionDate`): `number`

Defined in: [src/lib/feedback/trade-feedback-calculator.ts:35](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/feedback/trade-feedback-calculator.ts#L35)

Calculate timing score for trade entry

Analyzes how well-timed the entry was relative to market resolution.
Earlier profitable positions show good predictive ability.

## Parameters

### position

`TradePosition`

Trade position data

### marketResolutionDate

`Date`

When the market resolved

## Returns

`number`

Score from 0-1 (higher is better timing)
