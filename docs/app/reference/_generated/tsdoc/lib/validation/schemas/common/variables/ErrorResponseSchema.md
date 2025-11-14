[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/common](../README.md) / ErrorResponseSchema

# Variable: ErrorResponseSchema

> `const` **ErrorResponseSchema**: `ZodObject`\<\{ `error`: `ZodObject`\<\{ `message`: `ZodString`; `code`: `ZodString`; `violations`: `ZodOptional`\<`ZodArray`\<`ZodObject`\<\{ `field`: `ZodString`; `message`: `ZodString`; \}, `$strip`\>\>\>; `context`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodUnknown`\>\>; \}, `$strip`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/common.ts:317](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/common.ts#L317)

Generic error response schema
