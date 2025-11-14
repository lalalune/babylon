[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/game](../README.md) / UploadImageSchema

# Variable: UploadImageSchema

> `const` **UploadImageSchema**: `ZodObject`\<\{ `file`: `ZodCustom`\<`Blob` \| `File`, `Blob` \| `File`\>; `filename`: `ZodOptional`\<`ZodString`\>; `maxSizeKB`: `ZodDefault`\<`ZodNumber`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/game.ts:33](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/game.ts#L33)

Upload image schema (legacy - for file objects)
File/Blob objects are validated in the handler, so we use z.custom() for runtime validation
