[**babylon v0.1.0**](../../../../README.md)

***

[babylon](../../../../README.md) / [lib/reputation/reputation-service](../README.md) / calculateGameScore

# Function: calculateGameScore()

> **calculateGameScore**(`metrics`): `number`

Defined in: [src/lib/reputation/reputation-service.ts:445](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/reputation/reputation-service.ts#L445)

Calculate feedback score from game performance metrics

Score components (0-100):
- PNL performance: 40% (normalized return on starting balance)
- Decision quality: 30% (correct decisions / total decisions)
- Risk management: 20% (positions managed effectively)
- Game outcome: 10% (win/loss bonus)

## Parameters

### metrics

[`GameMetrics`](../interfaces/GameMetrics.md)

Game performance metrics

## Returns

`number`

Feedback score (0-100)
