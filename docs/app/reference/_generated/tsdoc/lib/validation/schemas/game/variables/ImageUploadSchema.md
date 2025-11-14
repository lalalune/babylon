[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/game](../README.md) / ImageUploadSchema

# Variable: ImageUploadSchema

> `const` **ImageUploadSchema**: `ZodObject`\<\{ `file`: `ZodNullable`\<`ZodObject`\<\{ `size`: `ZodNumber`; `type`: `ZodString`; \}, `$strip`\>\>; `type`: `ZodOptional`\<`ZodEnum`\<\{ `post`: `"post"`; `profile`: `"profile"`; `cover`: `"cover"`; \}\>\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/game.ts:18](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/game.ts#L18)

Image upload schema (for multipart form data)
