[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / TradeExecutionResponseSchema

# Variable: TradeExecutionResponseSchema

> `const` **TradeExecutionResponseSchema**: `ZodObject`\<\{ `orderId`: `ZodString`; `status`: `ZodEnum`\<\{ `CANCELLED`: `"CANCELLED"`; `PENDING`: `"PENDING"`; `FILLED`: `"FILLED"`; `PARTIALLY_FILLED`: `"PARTIALLY_FILLED"`; `REJECTED`: `"REJECTED"`; \}\>; `filledSize`: `ZodNumber`; `filledPrice`: `ZodOptional`\<`ZodNumber`\>; `fees`: `ZodNumber`; `timestamp`: `ZodString`; `transactionHash`: `ZodOptional`\<`ZodString`\>; `errorMessage`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:168](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L168)

Trade execution response schema
