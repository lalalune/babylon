[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/common](../README.md) / LeaderboardQuerySchema

# Variable: LeaderboardQuerySchema

> `const` **LeaderboardQuerySchema**: `ZodObject`\<\{ `page`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `pageSize`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `minPoints`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `pointsType`: `ZodOptional`\<`ZodEnum`\<\{ `all`: `"all"`; `earned`: `"earned"`; `referral`: `"referral"`; \}\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/common.ts:341](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/common.ts#L341)

Leaderboard query parameters schema
