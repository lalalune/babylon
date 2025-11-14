[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/post](../README.md) / CreatePostSchema

# Variable: CreatePostSchema

> `const` **CreatePostSchema**: `ZodObject`\<\{ `content`: `ZodPipe`\<`ZodString`, `ZodTransform`\<`string`, `string`\>\>; `marketId`: `ZodOptional`\<`ZodString`\>; `side`: `ZodOptional`\<`ZodEnum`\<\{ `YES`: `"YES"`; `NO`: `"NO"`; `LONG`: `"LONG"`; `SHORT`: `"SHORT"`; \}\>\>; `sentiment`: `ZodOptional`\<`ZodNumber`\>; `shareCount`: `ZodOptional`\<`ZodNumber`\>; `imageUrl`: `ZodOptional`\<`ZodString`\>; `repostOfId`: `ZodOptional`\<`ZodString`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/post.ts:20](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/post.ts#L20)

Create post schema
