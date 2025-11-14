[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/user](../README.md) / UserResponseSchema

# Variable: UserResponseSchema

> `const` **UserResponseSchema**: `ZodObject`\<\{ `id`: `ZodString`; `walletAddress`: `ZodNullable`\<`ZodString`\>; `username`: `ZodNullable`\<`ZodString`\>; `displayName`: `ZodNullable`\<`ZodString`\>; `bio`: `ZodNullable`\<`ZodString`\>; `profileImageUrl`: `ZodNullable`\<`ZodString`\>; `coverImageUrl`: `ZodNullable`\<`ZodString`\>; `isActor`: `ZodBoolean`; `reputationPoints`: `ZodNumber`; `virtualBalance`: `ZodString`; `lifetimePnL`: `ZodString`; `onChainRegistered`: `ZodBoolean`; `nftTokenId`: `ZodNullable`\<`ZodNumber`\>; `profileComplete`: `ZodBoolean`; `hasFarcaster`: `ZodBoolean`; `hasTwitter`: `ZodBoolean`; `referralCode`: `ZodNullable`\<`ZodString`\>; `referralCount`: `ZodNumber`; `agent0TrustScore`: `ZodNumber`; `createdAt`: `ZodString`; `updatedAt`: `ZodString`; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/user.ts:184](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/user.ts#L184)

User response schema (for API responses)
