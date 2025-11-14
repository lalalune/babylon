[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/user](../README.md) / CompleteOnboardingSchema

# Variable: CompleteOnboardingSchema

> `const` **CompleteOnboardingSchema**: `ZodObject`\<\{ `username`: `ZodString`; `displayName`: `ZodOptional`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>\>; `bio`: `ZodOptional`\<`ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>\>; `profileImageUrl`: `ZodOptional`\<`ZodString`\>; `referralCode`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/user.ts:134](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/user.ts#L134)

User onboarding completion schema
