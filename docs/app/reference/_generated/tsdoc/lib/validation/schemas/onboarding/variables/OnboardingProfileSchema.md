[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/onboarding](../README.md) / OnboardingProfileSchema

# Variable: OnboardingProfileSchema

> `const` **OnboardingProfileSchema**: `ZodObject`\<\{ `username`: `ZodString`; `displayName`: `ZodString`; `bio`: `ZodUnion`\<\[`ZodOptional`\<`ZodString`\>, `ZodPipe`\<`ZodLiteral`\<`""`\>, `ZodTransform`\<`undefined`, `""`\>\>\]\>; `profileImageUrl`: `ZodNullable`\<`ZodUnion`\<\[`ZodOptional`\<`ZodString`\>, `ZodPipe`\<`ZodLiteral`\<`""`\>, `ZodTransform`\<`undefined`, `""`\>\>\]\>\>; `coverImageUrl`: `ZodNullable`\<`ZodUnion`\<\[`ZodOptional`\<`ZodString`\>, `ZodPipe`\<`ZodLiteral`\<`""`\>, `ZodTransform`\<`undefined`, `""`\>\>\]\>\>; `referralCode`: `ZodUnion`\<\[`ZodOptional`\<`ZodString`\>, `ZodPipe`\<`ZodLiteral`\<`""`\>, `ZodTransform`\<`undefined`, `""`\>\>\]\>; `importedFrom`: `ZodNullable`\<`ZodOptional`\<`ZodEnum`\<\{ `twitter`: `"twitter"`; `farcaster`: `"farcaster"`; \}\>\>\>; `twitterId`: `ZodNullable`\<`ZodOptional`\<`ZodString`\>\>; `twitterUsername`: `ZodNullable`\<`ZodOptional`\<`ZodString`\>\>; `farcasterFid`: `ZodNullable`\<`ZodOptional`\<`ZodString`\>\>; `farcasterUsername`: `ZodNullable`\<`ZodOptional`\<`ZodString`\>\>; `tosAccepted`: `ZodOptional`\<`ZodBoolean`\>; `privacyPolicyAccepted`: `ZodOptional`\<`ZodBoolean`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/onboarding.ts:4](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/onboarding.ts#L4)
