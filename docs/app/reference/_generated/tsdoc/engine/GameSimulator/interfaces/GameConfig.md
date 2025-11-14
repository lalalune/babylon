[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/GameSimulator](../README.md) / GameConfig

# Interface: GameConfig

Defined in: [src/engine/GameSimulator.ts:75](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L75)

Configuration options for game simulation

 GameConfig

## Properties

### outcome

> **outcome**: `boolean`

Defined in: [src/engine/GameSimulator.ts:76](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L76)

Predetermined outcome (true = YES, false = NO)

***

### numAgents?

> `optional` **numAgents**: `number`

Defined in: [src/engine/GameSimulator.ts:77](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L77)

Number of AI agents (2-20, default 5)

***

### duration?

> `optional` **duration**: `number`

Defined in: [src/engine/GameSimulator.ts:78](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L78)

Game duration in days (default 30)

***

### liquidityB?

> `optional` **liquidityB**: `number`

Defined in: [src/engine/GameSimulator.ts:79](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L79)

LMSR liquidity parameter (default 100, higher = less price movement)

***

### insiderPercentage?

> `optional` **insiderPercentage**: `number`

Defined in: [src/engine/GameSimulator.ts:80](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L80)

Percentage of agents who are insiders (0-1, default 0.3)
