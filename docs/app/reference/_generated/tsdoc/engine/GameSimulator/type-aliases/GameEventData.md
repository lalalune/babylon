[**babylon v0.1.0**](../../../README.md)

***

[babylon](../../../README.md) / [engine/GameSimulator](../README.md) / GameEventData

# Type Alias: GameEventData

> **GameEventData** = \{ `id`: `string`; `question`: `string`; \} \| \{ `day`: `number`; \} \| \{ `agentId`: `string`; `clue`: `string`; `pointsToward`: `boolean`; \} \| \{ `agentId`: `string`; `bet`: `string`; `position`: `"YES"` \| `"NO"`; \} \| \{ `agentId`: `string`; `post`: `string`; \} \| \{ `from`: `string`; `to`: `string`; `message`: `string`; \} \| [`MarketState`](../interfaces/MarketState.md) \| \{ `outcome`: `boolean`; \} \| \{ `outcome`: `boolean`; `winners`: `string`[]; \} \| `Record`\<`string`, `JsonValue`\>

Defined in: [src/engine/GameSimulator.ts:133](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/engine/GameSimulator.ts#L133)

Event data types for different events
