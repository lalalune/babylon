[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/market](../README.md) / UserPositionsQuerySchema

# Variable: UserPositionsQuerySchema

> `const` **UserPositionsQuerySchema**: `ZodObject`\<\{ `userId`: `ZodString`; `type`: `ZodDefault`\<`ZodEnum`\<\{ `prediction`: `"prediction"`; `all`: `"all"`; `perp`: `"perp"`; \}\>\>; `status`: `ZodDefault`\<`ZodEnum`\<\{ `all`: `"all"`; `open`: `"open"`; `closed`: `"closed"`; \}\>\>; `page`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/market.ts:83](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/market.ts#L83)

User positions query schema
