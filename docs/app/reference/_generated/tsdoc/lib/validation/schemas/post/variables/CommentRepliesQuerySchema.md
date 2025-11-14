[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/post](../README.md) / CommentRepliesQuerySchema

# Variable: CommentRepliesQuerySchema

> `const` **CommentRepliesQuerySchema**: `ZodObject`\<\{ `page`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `limit`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; `sortBy`: `ZodOptional`\<`ZodString`\>; `sortOrder`: `ZodDefault`\<`ZodEnum`\<\{ `asc`: `"asc"`; `desc`: `"desc"`; \}\>\>; `commentId`: `ZodString`; `depth`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/post.ts:104](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/post.ts#L104)

Comment replies query schema
