[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/pnl-normalizer](../README.md) / calculateConfidenceScore

# Function: calculateConfidenceScore()

> **calculateConfidenceScore**(`sampleSize`): `number`

Defined in: [src/lib/reputation/pnl-normalizer.ts:158](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/pnl-normalizer.ts#L158)

Calculate confidence score based on sample size

Uses Wilson score interval to determine confidence in reputation score.
More data = higher confidence.

## Parameters

### sampleSize

`number`

Number of feedback/trades used for score

## Returns

`number`

Confidence score (0-1), where 1 = highly confident
