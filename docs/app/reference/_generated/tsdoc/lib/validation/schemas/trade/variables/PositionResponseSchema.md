[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / PositionResponseSchema

# Variable: PositionResponseSchema

> `const` **PositionResponseSchema**: `ZodObject`\<\{ `id`: `ZodString`; `poolId`: `ZodNullable`\<`ZodString`\>; `userId`: `ZodNullable`\<`ZodString`\>; `marketType`: `ZodString`; `ticker`: `ZodNullable`\<`ZodString`\>; `marketId`: `ZodNullable`\<`ZodString`\>; `side`: `ZodString`; `entryPrice`: `ZodNumber`; `currentPrice`: `ZodNumber`; `size`: `ZodNumber`; `leverage`: `ZodNullable`\<`ZodNumber`\>; `liquidationPrice`: `ZodNullable`\<`ZodNumber`\>; `unrealizedPnL`: `ZodNumber`; `realizedPnL`: `ZodNullable`\<`ZodNumber`\>; `margin`: `ZodOptional`\<`ZodNumber`\>; `maintenanceMargin`: `ZodOptional`\<`ZodNumber`\>; `openedAt`: `ZodString`; `closedAt`: `ZodNullable`\<`ZodString`\>; `updatedAt`: `ZodString`; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:182](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L182)

Position response schema
