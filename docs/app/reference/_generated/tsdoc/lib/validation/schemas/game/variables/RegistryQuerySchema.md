[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/game](../README.md) / RegistryQuerySchema

# Variable: RegistryQuerySchema

> `const` **RegistryQuerySchema**: `ZodObject`\<\{ `onChainOnly`: `ZodOptional`\<`ZodCoercedBoolean`\<`unknown`\>\>; `sortBy`: `ZodDefault`\<`ZodEnum`\<\{ `username`: `"username"`; `createdAt`: `"createdAt"`; `nftTokenId`: `"nftTokenId"`; \}\>\>; `sortOrder`: `ZodDefault`\<`ZodEnum`\<\{ `asc`: `"asc"`; `desc`: `"desc"`; \}\>\>; `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `offset`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/game.ts:53](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/game.ts#L53)

Registry query schema
