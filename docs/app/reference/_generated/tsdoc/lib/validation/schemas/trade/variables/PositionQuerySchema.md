[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / PositionQuerySchema

# Variable: PositionQuerySchema

> `const` **PositionQuerySchema**: `ZodObject`\<\{ `poolId`: `ZodOptional`\<`ZodString`\>; `userId`: `ZodOptional`\<`ZodString`\>; `marketType`: `ZodOptional`\<`ZodEnum`\<\{ `prediction`: `"prediction"`; `perp`: `"perp"`; `spot`: `"spot"`; \}\>\>; `ticker`: `ZodOptional`\<`ZodString`\>; `marketId`: `ZodOptional`\<`ZodString`\>; `status`: `ZodOptional`\<`ZodEnum`\<\{ `OPEN`: `"OPEN"`; `CLOSED`: `"CLOSED"`; `LIQUIDATED`: `"LIQUIDATED"`; \}\>\>; `includeHistory`: `ZodDefault`\<`ZodBoolean`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:126](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L126)

Position query schema
