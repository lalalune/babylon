[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/trade](../README.md) / OrderBookSchema

# Variable: OrderBookSchema

> `const` **OrderBookSchema**: `ZodObject`\<\{ `marketType`: `ZodString`; `ticker`: `ZodNullable`\<`ZodString`\>; `marketId`: `ZodNullable`\<`ZodString`\>; `bids`: `ZodArray`\<`ZodObject`\<\{ `price`: `ZodNumber`; `size`: `ZodNumber`; `orders`: `ZodOptional`\<`ZodNumber`\>; \}, `$strip`\>\>; `asks`: `ZodArray`\<`ZodObject`\<\{ `price`: `ZodNumber`; `size`: `ZodNumber`; `orders`: `ZodOptional`\<`ZodNumber`\>; \}, `$strip`\>\>; `timestamp`: `ZodString`; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/trade.ts:207](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/trade.ts#L207)

Order book schema
