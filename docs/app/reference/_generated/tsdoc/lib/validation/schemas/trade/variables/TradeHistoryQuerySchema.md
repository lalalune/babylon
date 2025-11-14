[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / TradeHistoryQuerySchema

# Variable: TradeHistoryQuerySchema

> `const` **TradeHistoryQuerySchema**: `ZodObject`\<\{ `poolId`: `ZodOptional`\<`ZodString`\>; `userId`: `ZodOptional`\<`ZodString`\>; `marketType`: `ZodOptional`\<`ZodEnum`\<\{ `prediction`: `"prediction"`; `perp`: `"perp"`; `spot`: `"spot"`; \}\>\>; `ticker`: `ZodOptional`\<`ZodString`\>; `startDate`: `ZodOptional`\<`ZodString`\>; `endDate`: `ZodOptional`\<`ZodString`\>; `side`: `ZodOptional`\<`ZodEnum`\<\{ `BUY`: `"BUY"`; `SELL`: `"SELL"`; \}\>\>; `includeMetadata`: `ZodDefault`\<`ZodBoolean`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:139](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L139)

Trade history query schema
