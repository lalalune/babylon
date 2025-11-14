[**babylon v0.1.0**](../../../../../README.md)

***

[babylon](../../../../../README.md) / [lib/validation/schemas/common](../README.md) / SuccessResponseSchema

# Variable: SuccessResponseSchema

> `const` **SuccessResponseSchema**: `ZodObject`\<\{ `success`: `ZodLiteral`\<`true`\>; `message`: `ZodOptional`\<`ZodString`\>; `data`: `ZodOptional`\<`ZodUnknown`\>; \}, `$strip`\>

Defined in: [src/lib/validation/schemas/common.ts:308](https://github.com/lalalune/babylon/blob/309d41be44719cd3238d25a6c463d399f70ddf34/src/lib/validation/schemas/common.ts#L308)

Generic success response schema
Uses z.unknown() for data to allow any JSON-serializable value while maintaining type safety
