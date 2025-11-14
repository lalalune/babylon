[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/post](../README.md) / PostFeedQuerySchema

# Variable: PostFeedQuerySchema

> `const` **PostFeedQuerySchema**: `ZodObject`\<\{ `page`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `sortBy`: `ZodOptional`\<`ZodString`\>; `sortOrder`: `ZodDefault`\<`ZodEnum`\<\{ `asc`: `"asc"`; `desc`: `"desc"`; \}\>\>; `userId`: `ZodOptional`\<`ZodString`\>; `marketId`: `ZodOptional`\<`ZodString`\>; `onlyFollowing`: `ZodDefault`\<`ZodCoercedBoolean`\<`unknown`\>\>; `onlyFavorites`: `ZodDefault`\<`ZodCoercedBoolean`\<`unknown`\>\>; `minSentiment`: `ZodOptional`\<`ZodCoercedNumber`\<`unknown`\>\>; `maxSentiment`: `ZodOptional`\<`ZodCoercedNumber`\<`unknown`\>\>; `hasMedia`: `ZodOptional`\<`ZodCoercedBoolean`\<`unknown`\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/post.ts:81](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/post.ts#L81)

Post feed query schema
