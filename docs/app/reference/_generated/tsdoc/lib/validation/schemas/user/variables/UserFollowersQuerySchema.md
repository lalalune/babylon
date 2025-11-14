[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/user](../README.md) / UserFollowersQuerySchema

# Variable: UserFollowersQuerySchema

> `const` **UserFollowersQuerySchema**: `ZodObject`\<\{ `page`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `sortBy`: `ZodOptional`\<`ZodString`\>; `sortOrder`: `ZodDefault`\<`ZodEnum`\<\{ `asc`: `"asc"`; `desc`: `"desc"`; \}\>\>; `includeMutual`: `ZodDefault`\<`ZodCoercedBoolean`\<`unknown`\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/user.ts:230](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/user.ts#L230)

User followers/following query schema
