[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [lib/serverless-game-tick](../README.md) / executeGameTick

# Function: executeGameTick()

> **executeGameTick**(): `Promise`\<[`GameTickResult`](../interfaces/GameTickResult.md)\>

Defined in: [src/lib/serverless-game-tick.ts:62](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/serverless-game-tick.ts#L62)

Execute a single game tick
Designed to complete within 3 minutes (180 seconds)
Uses parallelization for posts, articles, and other operations to maximize throughput
Guarantees critical operations (market decisions) always execute via budget reserve

## Returns

`Promise`\<[`GameTickResult`](../interfaces/GameTickResult.md)\>
