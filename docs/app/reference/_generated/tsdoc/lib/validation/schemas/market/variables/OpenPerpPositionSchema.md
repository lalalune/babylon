[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/market](../README.md) / OpenPerpPositionSchema

# Variable: OpenPerpPositionSchema

> `const` **OpenPerpPositionSchema**: `ZodObject`\<\{ `ticker`: `ZodString`; `side`: `ZodEnum`\<\{ `LONG`: `"LONG"`; `SHORT`: `"SHORT"`; \}\>; `size`: `ZodString`; `leverage`: `ZodNumber`; `slippage`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/market.ts:16](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/market.ts#L16)

Open perp position schema
