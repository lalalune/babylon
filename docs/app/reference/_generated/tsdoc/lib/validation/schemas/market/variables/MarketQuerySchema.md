[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/market](../README.md) / MarketQuerySchema

# Variable: MarketQuerySchema

> `const` **MarketQuerySchema**: `ZodObject`\<\{ `page`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `sortBy`: `ZodOptional`\<`ZodString`\>; `sortOrder`: `ZodDefault`\<`ZodEnum`\<\{ `asc`: `"asc"`; `desc`: `"desc"`; \}\>\>; `status`: `ZodOptional`\<`ZodEnum`\<\{ `ACTIVE`: `"ACTIVE"`; `RESOLVED`: `"RESOLVED"`; `CANCELLED`: `"CANCELLED"`; \}\>\>; `category`: `ZodOptional`\<`ZodString`\>; `minLiquidity`: `ZodOptional`\<`ZodCoercedNumber`\<`unknown`\>\>; `maxLiquidity`: `ZodOptional`\<`ZodCoercedNumber`\<`unknown`\>\>; `search`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/market.ts:72](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/market.ts#L72)

Market query schema
