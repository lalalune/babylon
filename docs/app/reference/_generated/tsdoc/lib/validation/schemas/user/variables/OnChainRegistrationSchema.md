[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/user](../README.md) / OnChainRegistrationSchema

# Variable: OnChainRegistrationSchema

> `const` **OnChainRegistrationSchema**: `ZodObject`\<\{ `walletAddress`: `ZodOptional`\<`ZodString`\>; `username`: `ZodOptional`\<`ZodString`\>; `displayName`: `ZodOptional`\<`ZodString`\>; `bio`: `ZodOptional`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>\>; `profileImageUrl`: `ZodOptional`\<`ZodString`\>; `coverImageUrl`: `ZodOptional`\<`ZodString`\>; `endpoint`: `ZodOptional`\<`ZodString`\>; `referralCode`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/user.ts:145](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/user.ts#L145)

On-chain registration schema
