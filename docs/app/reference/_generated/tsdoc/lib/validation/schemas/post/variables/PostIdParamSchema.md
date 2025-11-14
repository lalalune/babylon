[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/post](../README.md) / PostIdParamSchema

# Variable: PostIdParamSchema

> `const` **PostIdParamSchema**: `ZodObject`\<\{ `id`: `ZodString`; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/post.ts:13](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/post.ts#L13)

Post ID parameter schema
Accepts both UUID and game-generated post IDs
Game post IDs have format: {gameId}-{authorId}-{timestamp}-{random}
