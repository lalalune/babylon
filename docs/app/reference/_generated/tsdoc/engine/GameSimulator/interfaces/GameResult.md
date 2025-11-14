[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/GameSimulator](../README.md) / GameResult

# Interface: GameResult

Defined in: [src/engine/GameSimulator.ts:103](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L103)

Complete game result with full event history

 GameResult

## Description

Contains the complete state and history of a simulated game from start to finish.
Includes all events, final agent states, market data, and winner information.

## Properties

### id

> **id**: `string`

Defined in: [src/engine/GameSimulator.ts:104](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L104)

Unique snowflake ID for this game

***

### question

> **question**: `string`

Defined in: [src/engine/GameSimulator.ts:105](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L105)

The prediction market question text

***

### outcome

> **outcome**: `boolean`

Defined in: [src/engine/GameSimulator.ts:106](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L106)

Final outcome (true = YES, false = NO)

***

### startTime

> **startTime**: `number`

Defined in: [src/engine/GameSimulator.ts:107](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L107)

Unix timestamp when game started

***

### endTime

> **endTime**: `number`

Defined in: [src/engine/GameSimulator.ts:108](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L108)

Unix timestamp when game ended

***

### events

> **events**: [`GameEvent`](GameEvent.md)[]

Defined in: [src/engine/GameSimulator.ts:109](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L109)

Complete chronological event log

***

### agents

> **agents**: [`AgentState`](AgentState.md)[]

Defined in: [src/engine/GameSimulator.ts:110](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L110)

Final state of all agents

***

### market

> **market**: [`MarketState`](MarketState.md)

Defined in: [src/engine/GameSimulator.ts:111](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L111)

Final market state (prices, shares, volume)

***

### reputationChanges

> **reputationChanges**: [`ReputationChange`](ReputationChange.md)[]

Defined in: [src/engine/GameSimulator.ts:112](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L112)

Reputation deltas for all agents

***

### winners

> **winners**: `string`[]

Defined in: [src/engine/GameSimulator.ts:113](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L113)

Array of agent IDs who bet correctly
