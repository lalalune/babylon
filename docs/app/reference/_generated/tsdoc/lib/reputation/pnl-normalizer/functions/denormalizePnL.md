[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/pnl-normalizer](../README.md) / denormalizePnL

# Function: denormalizePnL()

> **denormalizePnL**(`normalized`): `number`

Defined in: [src/lib/reputation/pnl-normalizer.ts:58](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/pnl-normalizer.ts#L58)

Denormalize a 0-1 score back to ROI percentage

Inverse sigmoid function: roi = -ln((1/score) - 1)

## Parameters

### normalized

`number`

Normalized score from 0 to 1

## Returns

`number`

ROI as percentage (e.g., 0.5 → 0%, 0.88 → ~100%)
