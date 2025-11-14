[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/game](../README.md) / AwardPointsSchema

# Variable: AwardPointsSchema

> `const` **AwardPointsSchema**: `ZodObject`\<\{ `userId`: `ZodString`; `points`: `ZodNumber`; `reason`: `ZodEnum`\<\{ `username`: `"username"`; `referral`: `"referral"`; `trade`: `"trade"`; `profile_completion`: `"profile_completion"`; `wallet_connect`: `"wallet_connect"`; `profile_image`: `"profile_image"`; `social_connect`: `"social_connect"`; `achievement`: `"achievement"`; `bonus`: `"bonus"`; `penalty`: `"penalty"`; \}\>; `description`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/game.ts:64](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/game.ts#L64)

Award points schema
