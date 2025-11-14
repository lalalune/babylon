[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / CreateTradeOrderSchema

# Variable: CreateTradeOrderSchema

> `const` **CreateTradeOrderSchema**: `ZodObject`\<\{ `poolId`: `ZodOptional`\<`ZodString`\>; `marketType`: `ZodEnum`\<\{ `prediction`: `"prediction"`; `perp`: `"perp"`; `spot`: `"spot"`; \}\>; `ticker`: `ZodOptional`\<`ZodString`\>; `marketId`: `ZodOptional`\<`ZodString`\>; `side`: `ZodEnum`\<\{ `BUY`: `"BUY"`; `SELL`: `"SELL"`; \}\>; `orderType`: `ZodEnum`\<\{ `MARKET`: `"MARKET"`; `LIMIT`: `"LIMIT"`; `STOP`: `"STOP"`; `STOP_LIMIT`: `"STOP_LIMIT"`; \}\>; `size`: `ZodNumber`; `price`: `ZodOptional`\<`ZodNumber`\>; `stopPrice`: `ZodOptional`\<`ZodNumber`\>; `leverage`: `ZodDefault`\<`ZodNumber`\>; `timeInForce`: `ZodDefault`\<`ZodEnum`\<\{ `GTC`: `"GTC"`; `IOC`: `"IOC"`; `FOK`: `"FOK"`; `GTT`: `"GTT"`; \}\>\>; `expiresAt`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:19](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L19)

Create trade order schema
