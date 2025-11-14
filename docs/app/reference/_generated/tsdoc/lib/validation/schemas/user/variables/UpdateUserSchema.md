[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/user](../README.md) / UpdateUserSchema

# Variable: UpdateUserSchema

> `const` **UpdateUserSchema**: `ZodObject`\<\{ `username`: `ZodOptional`\<`ZodString`\>; `displayName`: `ZodOptional`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>\>; `bio`: `ZodOptional`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>\>; `profileImageUrl`: `ZodOptional`\<`ZodString`\>; `coverImageUrl`: `ZodOptional`\<`ZodString`\>; `showTwitterPublic`: `ZodOptional`\<`ZodBoolean`\>; `showFarcasterPublic`: `ZodOptional`\<`ZodBoolean`\>; `showWalletPublic`: `ZodOptional`\<`ZodBoolean`\>; `onchainTxHash`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/user.ts:37](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/user.ts#L37)

Update user profile schema
